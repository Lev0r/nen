/**
 * Sync NE GRAI + Steam curator vetting sources.
 * Used by scripts/sync-dev-sources.mjs (local JSON files) and Cloud Functions (Firestore).
 */
const { readFileSync, writeFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');
const AdmZip = require('adm-zip');
const { getFirestore } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { normalizeDevName } = require('./devSources');
const { CURATORS, getCuratorKeys } = require('./curatorRegistry');
const { fetchJsonWithRetry } = require('./steamCache');
const { DEFAULT_APP_ID } = require('./configPaths');
const {
  loadExistingCuratorStates,
  writeDevSourcesToFirestore,
} = require('./devSourceStore');
const { rebuildMaintenanceAudit } = require('./maintenanceStore');

const NE_GRAI_XPI =
  'https://addons.mozilla.org/firefox/downloads/latest/ne-hrai-tracker-steam/latest.xpi';

const STEAM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DATA_DIR = join(__dirname, 'data');
const PAGE_SIZE = 50;
const CURATOR_META_NOTE =
  'Only not_recommended + informational app IDs flag RU; recommended = curator clearance after dev check.';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAllowedEmails() {
  return [process.env.ALLOWED_EMAIL_0, process.env.ALLOWED_EMAIL_1].filter(Boolean);
}

function assertAllowedUser(auth) {
  if (!auth?.token?.email) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const allowed = getAllowedEmails();
  if (allowed.length >= 2 && !allowed.includes(auth.token.email)) {
    throw new HttpsError('permission-denied', 'Your email is not authorized.');
  }
}

async function downloadNeGraiList() {
  const res = await fetch(NE_GRAI_XPI);
  if (!res.ok) throw new Error(`NE GRAI XPI download failed (${res.status})`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry('content.js');
  if (!entry) throw new Error('content.js not found in NE GRAI XPI');

  const content = entry.getData().toString('utf8');
  const match = content.match(/const initialList\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not parse initialList from NE GRAI extension');

  const names = eval(match[1]);
  const versionMatch = content.match(/"version"\s*:\s*"([^"]+)"/);
  const version = versionMatch?.[1] || null;

  return {
    names: [...new Set(names.map((n) => String(n).trim()).filter(Boolean))].sort(),
    updatedAt: new Date().toISOString(),
    version,
    source: 'ПОГРАЙ/НЕ ГРАЙ Firefox extension (addons.mozilla.org/ne-hrai-tracker-steam)',
  };
}

/** Steam curator rec types that mean "avoid / RU-related". */
const CURATOR_NEGATIVE_REC_TYPES = new Set(['not_recommended', 'informational']);

/** Curator explicitly cleared the game after a developer background check. */
const CURATOR_POSITIVE_REC_TYPES = new Set(['recommended']);

function parseCuratorRecommendations(html) {
  /** @type {Map<string, string>} */
  const apps = new Map();
  const blocks = String(html || '').split('class="recommendation"').slice(1);

  for (const block of blocks) {
    const appMatch = block.match(/data-ds-appid="(\d+)"/);
    const typeMatch = block.match(/class='color_([^']+)'>/);
    if (!appMatch || !typeMatch) continue;

    const appId = appMatch[1];
    const recType = typeMatch[1];
    const existing = apps.get(appId);

    if (!existing) {
      apps.set(appId, recType);
      continue;
    }

    // If Steam ever shows conflicting rows, negative vetting wins over clearance.
    if (
      CURATOR_NEGATIVE_REC_TYPES.has(recType) &&
      CURATOR_POSITIVE_REC_TYPES.has(existing)
    ) {
      apps.set(appId, recType);
    }
  }

  return apps;
}

async function fetchCuratorPage(curatorId, start = 0, pageSize = PAGE_SIZE) {
  const url =
    `https://store.steampowered.com/curator/${curatorId}/ajaxgetfilteredrecommendations/render/` +
    `?query=&start=${start}&count=${pageSize}&sort=0`;
  const res = await fetch(url, { headers: { 'User-Agent': STEAM_UA } });
  if (!res.ok) throw new Error(`Curator ${curatorId} page failed (${res.status})`);

  const data = await res.json();
  const html = String(data.results_html || '');
  return {
    totalCount: Number(data.total_count) || 0,
    apps: parseCuratorRecommendations(html),
    htmlEmpty: !html.trim(),
  };
}

function emptyCuratorState(curator) {
  return {
    id: curator.id,
    label: curator.label,
    totalCount: 0,
    fetchedCount: 0,
    complete: false,
    lastSyncedAt: null,
    flaggedAppIds: [],
    clearedAppIds: [],
  };
}

function cloneCuratorState(entry, curator) {
  if (!entry) return emptyCuratorState(curator);
  return {
    id: entry.id || curator.id,
    label: entry.label || curator.label,
    totalCount: Number(entry.totalCount) || 0,
    fetchedCount: Number(entry.fetchedCount) || 0,
    complete: Boolean(entry.complete),
    lastSyncedAt: entry.lastSyncedAt || null,
    flaggedAppIds: [...(entry.flaggedAppIds || [])],
    clearedAppIds: [...(entry.clearedAppIds || [])],
  };
}

function mergePageAppsIntoState(state, pageApps) {
  const flagged = new Set(state.flaggedAppIds || []);
  const cleared = new Set(state.clearedAppIds || []);

  for (const [appId, recType] of pageApps) {
    const id = String(appId || '').trim();
    if (!id) continue;

    if (CURATOR_NEGATIVE_REC_TYPES.has(recType)) {
      flagged.add(id);
      cleared.delete(id);
      continue;
    }

    if (CURATOR_POSITIVE_REC_TYPES.has(recType) && !flagged.has(id)) {
      cleared.add(id);
    }
  }

  state.flaggedAppIds = [...flagged].sort();
  state.clearedAppIds = [...cleared].sort();
}

/**
 * Incrementally sync one curator list, resuming from stored Firestore/file state.
 * @returns {Promise<{ key: string, skipped: boolean, pagesFetched: number, state: object }>}
 */
async function syncOneCuratorIncremental(key, storedEntry, options = {}) {
  const curator = CURATORS[key];
  const forceFull = Boolean(options.forceFull);
  const maxPages = Number.isFinite(options.maxPages) ? options.maxPages : Infinity;

  const probe = await fetchCuratorPage(curator.id, 0);
  const totalCount = probe.totalCount;

  if (
    !forceFull &&
    storedEntry?.complete &&
    Number(storedEntry.totalCount) === totalCount
  ) {
    return { key, skipped: true, pagesFetched: 0, state: storedEntry };
  }

  let state = forceFull ? emptyCuratorState(curator) : cloneCuratorState(storedEntry, curator);
  let startAt = forceFull ? 0 : Number(state.fetchedCount) || 0;

  if (!forceFull && Number(storedEntry?.totalCount) > totalCount && totalCount >= 0) {
    state = emptyCuratorState(curator);
    startAt = 0;
  }

  state.id = curator.id;
  state.label = curator.label;
  state.totalCount = totalCount;

  if (totalCount === 0) {
    state.flaggedAppIds = [];
    state.clearedAppIds = [];
    state.fetchedCount = 0;
    state.complete = true;
    state.lastSyncedAt = new Date().toISOString();
    return { key, skipped: false, pagesFetched: 0, state };
  }

  if (startAt >= totalCount && !state.complete) {
    state.fetchedCount = totalCount;
    state.complete = true;
    state.lastSyncedAt = new Date().toISOString();
    return { key, skipped: false, pagesFetched: 0, state };
  }

  let pagesFetched = 0;
  let start = startAt;

  while (start < totalCount && pagesFetched < maxPages) {
    const page = start === 0 ? probe : await fetchCuratorPage(curator.id, start);
    mergePageAppsIntoState(state, page.apps);
    pagesFetched += 1;
    start += PAGE_SIZE;

    if (page.htmlEmpty && start < totalCount) break;
    if (start < totalCount && pagesFetched < maxPages) {
      await sleep(200);
    }
  }

  state.fetchedCount = Math.min(start, totalCount);
  state.complete = state.fetchedCount >= totalCount;
  state.lastSyncedAt = new Date().toISOString();

  return { key, skipped: false, pagesFetched, state };
}

function preserveCuratorState(existingCurators, key) {
  const curator = CURATORS[key];
  return existingCurators[key]
    ? cloneCuratorState(existingCurators[key], curator)
    : emptyCuratorState(curator);
}

/**
 * Incrementally sync all curators, skipping unchanged complete lists when possible.
 * @param {Record<string, object>} [existingCurators]
 * @param {{ maxCurators?: number, maxPages?: number, forceFull?: boolean, existingMeta?: object }} [options]
 */
async function syncCuratorAppIdsIncremental(existingCurators = {}, options = {}) {
  const maxCurators = Number.isFinite(options.maxCurators) ? options.maxCurators : Infinity;
  const maxPages = Number.isFinite(options.maxPages) ? options.maxPages : Infinity;
  /** @type {Record<string, object>} */
  const curators = {};
  const progress = {
    skipped: [],
    updated: [],
    pending: [],
    curatorsProcessed: 0,
  };

  let worked = 0;
  const keys = getCuratorKeys();
  let stopAfterCurator = false;

  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];

    if (worked >= maxCurators || stopAfterCurator) {
      for (let j = index; j < keys.length; j += 1) {
        curators[keys[j]] = preserveCuratorState(existingCurators, keys[j]);
      }
      break;
    }

    const result = await syncOneCuratorIncremental(key, existingCurators[key], {
      forceFull: options.forceFull,
      maxPages,
    });

    if (result.skipped) {
      progress.skipped.push(key);
      curators[key] = result.state;
      continue;
    }

    worked += 1;
    progress.curatorsProcessed += 1;
    curators[key] = result.state;

    if (result.state.complete) {
      progress.updated.push(key);
    } else {
      progress.pending.push(key);
    }

    if (!result.state.complete && result.pagesFetched >= maxPages) {
      stopAfterCurator = true;
    }
  }

  for (const key of keys) {
    if (!curators[key]) {
      curators[key] = preserveCuratorState(existingCurators, key);
    }
  }

  const anyChange =
    progress.updated.length > 0 ||
    progress.pending.length > 0 ||
    progress.curatorsProcessed > 0;

  return {
    curators,
    meta: {
      updatedAt: anyChange ? new Date().toISOString() : new Date().toISOString(),
      note: CURATOR_META_NOTE,
      incremental: true,
    },
    progress,
  };
}

async function fetchAppDevelopers(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=ua&l=english`;
  const json = await fetchJsonWithRetry(url, { maxAttempts: 5 });
  const entry = json?.[appId];
  if (!entry?.success) return null;

  const data = entry.data || {};
  const names = [...(data.developers || []), ...(data.publishers || [])]
    .map((n) => String(n).trim())
    .filter(Boolean);
  return [...new Set(names)];
}

function indexDeveloperNames(developers, key, appId, names) {
  for (const name of names) {
    const normalized = normalizeDevName(name);
    if (!normalized) continue;

    if (!developers[normalized]) {
      developers[normalized] = {
        name,
        curators: [key],
        appIds: [appId],
        appCount: 1,
      };
    } else {
      if (!developers[normalized].curators.includes(key)) {
        developers[normalized].curators.push(key);
      }
      if (!developers[normalized].appIds.includes(appId)) {
        developers[normalized].appIds.push(appId);
        developers[normalized].appCount += 1;
      }
    }
  }
}

async function buildCuratorDeveloperIndex(appIdsData, curatorDelayMs = 800) {
  const developers = {};
  const curatorApps = {};

  for (const [key, entry] of Object.entries(appIdsData.curators)) {
    const appIds = entry.flaggedAppIds || entry.appIds || [];
    curatorApps[key] = {
      id: entry.id,
      label: entry.label,
      appCount: appIds.length,
      clearedAppCount: entry.clearedAppIds?.length || 0,
    };

    for (let i = 0; i < appIds.length; i += 1) {
      const appId = appIds[i];
      try {
        const names = await fetchAppDevelopers(appId);
        if (names?.length) indexDeveloperNames(developers, key, appId, names);
      } catch (err) {
        console.warn(`app ${appId}: ${err.message}`);
      }
      await sleep(curatorDelayMs);
    }
  }

  return {
    developers,
    meta: {
      updatedAt: new Date().toISOString(),
      curators: curatorApps,
      developerCount: Object.keys(developers).length,
    },
  };
}

/**
 * @param {{ skipNeGrai?: boolean, skipCurators?: boolean, buildDevIndex?: boolean, curatorDelayMs?: number, maxCurators?: number, maxPages?: number, forceFull?: boolean, existingMeta?: object }} [options]
 * @param {Record<string, object>} [existingCurators]
 */
async function fetchDevSourcePayload(options = {}, existingCurators = {}) {
  const payload = {};

  if (!options.skipNeGrai) {
    payload.neGrai = await downloadNeGraiList();
  }

  if (!options.skipCurators) {
    const result = await syncCuratorAppIdsIncremental(existingCurators, options);
    payload.curatorAppIds = {
      curators: result.curators,
      meta: result.meta,
    };
    payload.curatorSyncProgress = result.progress;
    if (options.buildDevIndex) {
      payload.curatorDevelopers = await buildCuratorDeveloperIndex(
        payload.curatorAppIds,
        options.curatorDelayMs
      );
    }
  }

  return payload;
}

function writeDevSourcesToFiles(payload, dataDir = DATA_DIR) {
  mkdirSync(dataDir, { recursive: true });

  if (payload.neGrai) {
    writeFileSync(
      join(dataDir, 'ne-grai-russian-publishers.json'),
      JSON.stringify(payload.neGrai, null, 2)
    );
  }

  if (payload.curatorAppIds) {
    writeFileSync(
      join(dataDir, 'curator-flagged-appids.json'),
      JSON.stringify(payload.curatorAppIds, null, 2)
    );
  }

  if (payload.curatorDevelopers) {
    writeFileSync(
      join(dataDir, 'curator-flagged-developers.json'),
      JSON.stringify(payload.curatorDevelopers, null, 2)
    );
  }
}

function summarizeDevSourceStats(payload) {
  /** @type {Record<string, number|boolean>} */
  const stats = {
    neGraiCount: payload.neGrai?.names?.length || 0,
    devIndexCount: payload.curatorDevelopers?.meta?.developerCount || 0,
  };

  for (const key of getCuratorKeys()) {
    const entry = payload.curatorAppIds?.curators?.[key];
    stats[`${key}FlaggedCount`] = entry?.flaggedAppIds?.length || 0;
    stats[`${key}ClearedCount`] = entry?.clearedAppIds?.length || 0;
    stats[`${key}TotalCount`] = entry?.totalCount ?? 0;
    stats[`${key}FetchedCount`] = entry?.fetchedCount ?? 0;
    stats[`${key}Complete`] = Boolean(entry?.complete);
  }

  return stats;
}

function buildSyncProgressStats(payload) {
  const progress = payload.curatorSyncProgress || {};
  const pending = progress.pending || [];
  return {
    curatorsSkipped: progress.skipped || [],
    curatorsUpdated: progress.updated || [],
    curatorsPending: pending,
    curatorsProcessed: progress.curatorsProcessed || 0,
    syncComplete: pending.length === 0,
  };
}

async function syncDevSourcesToFirestore(appId = DEFAULT_APP_ID, options = {}) {
  const db = getFirestore();
  const existingCurators = await loadExistingCuratorStates(db, appId);

  const payload = await fetchDevSourcePayload(options, existingCurators);
  await writeDevSourcesToFirestore(appId, payload);
  await rebuildMaintenanceAudit(db, appId);
  const stats = summarizeDevSourceStats(payload);
  return {
    ...stats,
    ...buildSyncProgressStats(payload),
    payload,
  };
}

async function syncDevSourcesToFiles(options = {}, dataDir = DATA_DIR) {
  let existingCurators = {};
  let existingMeta;
  const curatorPath = join(dataDir, 'curator-flagged-appids.json');

  if (!options.forceFull && existsSync(curatorPath)) {
    try {
      const data = JSON.parse(readFileSync(curatorPath, 'utf8'));
      existingCurators = data.curators || {};
      existingMeta = data.meta;
    } catch (err) {
      console.warn('Could not read existing curator JSON, starting fresh:', err.message);
    }
  }

  const payload = await fetchDevSourcePayload(
    { ...options, existingMeta },
    existingCurators
  );
  writeDevSourcesToFiles(payload, dataDir);
  return {
    ...summarizeDevSourceStats(payload),
    ...buildSyncProgressStats(payload),
    dataDir,
  };
}

const syncDevSources = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
    cors: true,
  },
  async (request) => {
    assertAllowedUser(request.auth);
    const appId = request.data?.appId || DEFAULT_APP_ID;
    const data = request.data || {};

    try {
      const stats = await syncDevSourcesToFirestore(appId, {
        buildDevIndex: Boolean(data.buildDevIndex),
        maxCurators: data.maxCurators,
        maxPages: data.maxPages,
        forceFull: Boolean(data.forceFull),
        skipNeGrai: Boolean(data.skipNeGrai),
        skipCurators: Boolean(data.skipCurators),
      });
      return stats;
    } catch (err) {
      console.error('syncDevSources failed:', err);
      throw new HttpsError('internal', err.message || 'Failed to sync developer sources.');
    }
  }
);

const syncDevSourcesScheduled = onSchedule(
  {
    schedule: 'every 168 hours',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    try {
      const stats = await syncDevSourcesToFirestore(DEFAULT_APP_ID);
      const curatorSummary = getCuratorKeys()
        .map((key) => {
          const complete = stats[`${key}Complete`] ? 'ok' : 'pending';
          return `${key} flagged ${stats[`${key}FlaggedCount`] || 0} (${complete})`;
        })
        .join(', ');
      console.log(
        `syncDevSourcesScheduled: NE GRAI ${stats.neGraiCount}, ${curatorSummary}, ` +
          `skipped=${(stats.curatorsSkipped || []).join(',') || 'none'}, ` +
          `pending=${(stats.curatorsPending || []).join(',') || 'none'}`
      );
    } catch (err) {
      console.error('syncDevSourcesScheduled failed:', err);
      throw err;
    }
  }
);

module.exports = {
  fetchDevSourcePayload,
  syncCuratorAppIdsIncremental,
  syncOneCuratorIncremental,
  syncDevSourcesToFiles,
  syncDevSourcesToFirestore,
  writeDevSourcesToFiles,
  summarizeDevSourceStats,
  buildSyncProgressStats,
  syncDevSources,
  syncDevSourcesScheduled,
};

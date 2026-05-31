/**
 * Sync NE GRAI + Steam curator vetting sources.
 * Used by scripts/sync-dev-sources.mjs (local JSON files) and Cloud Functions (Firestore).
 */
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const AdmZip = require('adm-zip');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { normalizeDevName } = require('./devSources');
const { fetchJsonWithRetry } = require('./steamCache');
const { getConfigDocPath, DEFAULT_APP_ID } = require('./devBgCheck');

const NE_GRAI_XPI =
  'https://addons.mozilla.org/firefox/downloads/latest/ne-hrai-tracker-steam/latest.xpi';

const CURATORS = {
  playua: { id: '42985013', label: 'Обережно, русняві ігри (PlayUA)' },
  avoidRu: { id: '45452241', label: 'Avoid russian games' },
};

const STEAM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DATA_DIR = join(__dirname, 'data');

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

async function fetchCuratorApps(curatorId) {
  /** @type {Map<string, string>} */
  const apps = new Map();
  let start = 0;
  const pageSize = 50;
  let total = Infinity;

  while (start < total) {
    const url = `https://store.steampowered.com/curator/${curatorId}/ajaxgetfilteredrecommendations/render/?query=&start=${start}&count=${pageSize}&sort=0`;
    const res = await fetch(url, { headers: { 'User-Agent': STEAM_UA } });
    if (!res.ok) throw new Error(`Curator ${curatorId} page failed (${res.status})`);

    const data = await res.json();
    total = Number(data.total_count) || 0;
    const html = String(data.results_html || '');
    for (const [appId, recType] of parseCuratorRecommendations(html)) {
      apps.set(appId, recType);
    }

    start += pageSize;
    if (!html.trim()) break;
    await sleep(200);
  }

  return Object.fromEntries(apps);
}

function splitCuratorApps(apps) {
  const flaggedAppIds = [];
  const clearedAppIds = [];

  for (const [appId, recType] of Object.entries(apps || {})) {
    if (CURATOR_NEGATIVE_REC_TYPES.has(recType)) flaggedAppIds.push(appId);
    else if (CURATOR_POSITIVE_REC_TYPES.has(recType)) clearedAppIds.push(appId);
  }

  flaggedAppIds.sort();
  clearedAppIds.sort();
  return { flaggedAppIds, clearedAppIds };
}

async function syncCuratorAppIds() {
  const curators = {};
  for (const [key, curator] of Object.entries(CURATORS)) {
    const apps = await fetchCuratorApps(curator.id);
    const { flaggedAppIds, clearedAppIds } = splitCuratorApps(apps);
    curators[key] = {
      id: curator.id,
      label: curator.label,
      apps,
      flaggedAppIds,
      clearedAppIds,
    };
  }

  return {
    curators,
    meta: {
      updatedAt: new Date().toISOString(),
      note:
        'Only not_recommended + informational app IDs flag RU; recommended = curator clearance after dev check.',
    },
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
 * @param {{ skipNeGrai?: boolean, skipCurators?: boolean, buildDevIndex?: boolean, curatorDelayMs?: number }} [options]
 */
async function fetchDevSourcePayload(options = {}) {
  const payload = {};

  if (!options.skipNeGrai) {
    payload.neGrai = await downloadNeGraiList();
  }

  if (!options.skipCurators) {
    payload.curatorAppIds = await syncCuratorAppIds();
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

async function writeDevSourcesToFirestore(appId, payload) {
  const db = getFirestore();
  const sources = {
    syncedAt: FieldValue.serverTimestamp(),
  };

  if (payload.neGrai) sources.neGrai = payload.neGrai;
  if (payload.curatorAppIds) sources.curatorAppIds = payload.curatorAppIds;
  if (payload.curatorDevelopers) sources.curatorDevelopers = payload.curatorDevelopers;

  await db.doc(getConfigDocPath(appId)).set(
    {
      devBgCheck: {
        sources,
      },
    },
    { merge: true }
  );

  return {
    neGraiCount: payload.neGrai?.names?.length || 0,
    playuaFlaggedCount: payload.curatorAppIds?.curators?.playua?.flaggedAppIds?.length || 0,
    playuaClearedCount: payload.curatorAppIds?.curators?.playua?.clearedAppIds?.length || 0,
    avoidRuFlaggedCount: payload.curatorAppIds?.curators?.avoidRu?.flaggedAppIds?.length || 0,
    avoidRuClearedCount: payload.curatorAppIds?.curators?.avoidRu?.clearedAppIds?.length || 0,
    devIndexCount: payload.curatorDevelopers?.meta?.developerCount || 0,
  };
}

async function syncDevSourcesToFirestore(appId = DEFAULT_APP_ID, options = {}) {
  const payload = await fetchDevSourcePayload(options);
  const stats = await writeDevSourcesToFirestore(appId, payload);
  return { ...stats, payload };
}

async function syncDevSourcesToFiles(options = {}, dataDir = DATA_DIR) {
  const payload = await fetchDevSourcePayload(options);
  writeDevSourcesToFiles(payload, dataDir);
  return {
    neGraiCount: payload.neGrai?.names?.length || 0,
    playuaFlaggedCount: payload.curatorAppIds?.curators?.playua?.flaggedAppIds?.length || 0,
    playuaClearedCount: payload.curatorAppIds?.curators?.playua?.clearedAppIds?.length || 0,
    avoidRuFlaggedCount: payload.curatorAppIds?.curators?.avoidRu?.flaggedAppIds?.length || 0,
    avoidRuClearedCount: payload.curatorAppIds?.curators?.avoidRu?.clearedAppIds?.length || 0,
    devIndexCount: payload.curatorDevelopers?.meta?.developerCount || 0,
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

    try {
      const stats = await syncDevSourcesToFirestore(appId, {
        buildDevIndex: Boolean(request.data?.buildDevIndex),
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
      console.log(
        `syncDevSourcesScheduled: NE GRAI ${stats.neGraiCount}, ` +
          `PlayUA flagged ${stats.playuaFlaggedCount}, Avoid RU flagged ${stats.avoidRuFlaggedCount} / cleared ${stats.avoidRuClearedCount}`
      );
    } catch (err) {
      console.error('syncDevSourcesScheduled failed:', err);
      throw err;
    }
  }
);

module.exports = {
  fetchDevSourcePayload,
  syncDevSourcesToFiles,
  syncDevSourcesToFirestore,
  writeDevSourcesToFiles,
  syncDevSources,
  syncDevSourcesScheduled,
};

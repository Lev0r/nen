/**
 * Developer vetting sources (restricted list for deterministic lookups).
 *
 * Runtime reads Firestore config/dev-sources-* only (via ensureLiveDevSources).
 * Local JSON in functions/data/ is optional dev export — see scripts/sync-dev-sources.mjs.
 */
const { loadDevSourcesBundle, SCHEMA_VERSION } = require('./devSourceStore');
const {
  CURATORS,
  getCuratorKeys,
  buildCuratorSourceLabels,
  buildCuratorSourceUrls,
  primaryCuratorSourceId,
} = require('./curatorRegistry');

const SOURCE_IDS = {
  NE_GRAI: 'ne_grai',
  DOU: 'gamedev_dou',
  CURATOR_PLAYUA: CURATORS.playua.sourceId,
  CURATOR_AVOID_RU: CURATORS.avoidRu.sourceId,
  CURATOR_SICH1: CURATORS.sich1.sourceId,
  CURATOR_SICH2: CURATORS.sich2.sourceId,
  CURATOR_SICH3: CURATORS.sich3.sourceId,
  CURATOR_SICH4: CURATORS.sich4.sourceId,
  CURATOR_SICH5: CURATORS.sich5.sourceId,
};

const SOURCE_LABELS = {
  [SOURCE_IDS.NE_GRAI]: 'База даних розширення «НЕ ГРАЙ» (проєкт «ГРАЙ»)',
  [SOURCE_IDS.DOU]: 'GameDev DOU (gamedev.dou.ua)',
  ...buildCuratorSourceLabels(),
};

const SOURCE_URLS = buildCuratorSourceUrls();

/** Sources that get a clickable citation link in RU alert text. */
const LINKED_SOURCE_IDS = new Set(getCuratorKeys().map((key) => CURATORS[key].sourceId));

let neGraiSet = null;
let curatorMeta = null;
let curatorDevIndex = null;
/** @type {Record<string, { flagged: Set<string>, cleared: Set<string> }> | null} */
let curatorAppIds = null;
let loadedSourcesKey = null;
let warnedMissingNeGrai = false;
let warnedMissingCuratorAppIds = false;
let warnedMissingCuratorIndex = false;

function applyNeGraiData(data) {
  const names = Array.isArray(data) ? data : data?.names || [];
  neGraiSet = {
    names,
    normalized: new Set(names.map(normalizeNeGraiName).filter(Boolean)),
    updatedAt: data?.updatedAt || null,
    version: data?.version || null,
  };
}

function buildCuratorAppSets(entry) {
  const flagged = new Set();
  const cleared = new Set();

  for (const appId of entry?.flaggedAppIds || []) {
    const id = String(appId).trim();
    if (id) flagged.add(id);
  }
  for (const appId of entry?.clearedAppIds || []) {
    const id = String(appId).trim();
    if (id) cleared.add(id);
  }

  return { flagged, cleared };
}

function applyCuratorAppIdsData(data) {
  /** @type {Record<string, { flagged: Set<string>, cleared: Set<string> }>} */
  const curators = {};
  for (const key of getCuratorKeys()) {
    curators[key] = buildCuratorAppSets(data?.curators?.[key]);
  }
  curatorAppIds = {
    ...curators,
    meta: data?.meta || {},
  };
}

function applyCuratorDevelopersData(data) {
  curatorMeta = data?.meta || {};
  curatorDevIndex = new Map();
  for (const [normalized, entry] of Object.entries(data?.developers || {})) {
    curatorDevIndex.set(normalized, entry);
  }
}

/**
 * Apply a full or partial dev-sources payload (used by ensureLiveDevSources and local test scripts).
 */
function applyDevSourcesPayload(payload = {}) {
  if (payload.neGrai) {
    applyNeGraiData(payload.neGrai);
  }
  if (payload.curatorAppIds) {
    applyCuratorAppIdsData(payload.curatorAppIds);
  }
  if (payload.curatorDevelopers) {
    applyCuratorDevelopersData(payload.curatorDevelopers);
  }
}

/**
 * Load split dev source docs from Firestore (schema v2).
 */
async function ensureLiveDevSources(db, appId = 'default_app') {
  if (!db || !appId) return;

  const bundle = await loadDevSourcesBundle(db, appId);
  if (!bundle) return;

  const syncedAt = bundle.meta?.syncedAt;
  const key =
    syncedAt && typeof syncedAt.toMillis === 'function'
      ? String(syncedAt.toMillis())
      : String(syncedAt || bundle.meta?.neGraiUpdatedAt || '');
  if (!key || loadedSourcesKey === key) return;

  applyDevSourcesPayload({
    neGrai: bundle.neGrai,
    curatorAppIds: {
      curators: bundle.curators,
      meta: {
        updatedAt: bundle.meta?.syncedAt,
        schemaVersion: SCHEMA_VERSION,
      },
    },
    curatorDevelopers: bundle.devIndex,
  });
  loadedSourcesKey = key;
}

function resetDevSourcesCache() {
  neGraiSet = null;
  curatorMeta = null;
  curatorDevIndex = null;
  curatorAppIds = null;
  loadedSourcesKey = null;
  warnedMissingNeGrai = false;
  warnedMissingCuratorAppIds = false;
  warnedMissingCuratorIndex = false;
}

function baseNormalizeDevName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,'"()]/g, '')
    .trim();
}

function normalizeDevName(name) {
  return baseNormalizeDevName(name)
    .replace(/\s+(inc|llc|ltd|corp|corporation|studio|studios|games|entertainment)$/i, '')
    .trim();
}

/** NE GRAI exact match: trim/case/punctuation only — no suffix strip (avoids pine/robot collisions). */
function normalizeNeGraiName(name) {
  return baseNormalizeDevName(name);
}

function namesMatch(a, b) {
  const na = normalizeDevName(a);
  const nb = normalizeDevName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

function sourceMarkdownLink(sourceId, label = SOURCE_LABELS[sourceId]) {
  if (!LINKED_SOURCE_IDS.has(sourceId)) return label || '';
  const url = SOURCE_URLS[sourceId];
  if (!url || !label) return label || '';
  return `[${label}](${url})`;
}

function steamAppMarkdownLink(appId) {
  const id = String(appId || '').trim();
  if (!id) return '';
  return `[app/${id}](https://store.steampowered.com/app/${id}/)`;
}

function curatorMarkdownLinks(curatorKeys) {
  return (curatorKeys || [])
    .map((key) => {
      const curator = CURATORS[key];
      if (!curator) return key;
      return `[${curator.sourceLabel}](${curator.url})`;
    })
    .join('; ');
}

function getNeGraiSet() {
  if (neGraiSet) return neGraiSet;

  if (!warnedMissingNeGrai) {
    console.warn(
      'devSources: NE GRAI list not loaded — sync dev sources to Firestore or call ensureLiveDevSources'
    );
    warnedMissingNeGrai = true;
  }
  neGraiSet = {
    names: [],
    normalized: new Set(),
    updatedAt: null,
    version: null,
  };
  return neGraiSet;
}

function getCuratorAppIds() {
  if (curatorAppIds) return curatorAppIds;

  if (!warnedMissingCuratorAppIds) {
    console.warn(
      'devSources: curator app IDs not loaded — sync dev sources to Firestore or call ensureLiveDevSources'
    );
    warnedMissingCuratorAppIds = true;
  }

  /** @type {Record<string, { flagged: Set<string>, cleared: Set<string> }>} */
  const empty = {};
  for (const key of getCuratorKeys()) {
    empty[key] = { flagged: new Set(), cleared: new Set() };
  }
  curatorAppIds = { ...empty, meta: {} };
  return curatorAppIds;
}

function lookupCuratorsByAppId(appId) {
  const sets = getCuratorAppIds();
  const id = String(appId || '').trim();
  if (!id) return null;

  for (const key of getCuratorKeys()) {
    const curator = CURATORS[key];
    const entry = sets[key];
    if (!entry?.flagged?.has(id)) continue;

    return {
      isRussianRelated: true,
      source: curator.sourceId,
      appId: id,
      explanation: `${sourceMarkdownLink(curator.sourceId)} (not recommended or informational)`,
    };
  }

  return null;
}

/**
 * Curator explicitly recommended this app after a developer background check.
 * Does not override NE GRAI — use only as a negative-source absence signal.
 */
function lookupCuratorClearanceByAppId(appId) {
  const sets = getCuratorAppIds();
  const id = String(appId || '').trim();
  if (!id) return null;

  for (const key of getCuratorKeys()) {
    const curator = CURATORS[key];
    const entry = sets[key];
    if (!entry?.cleared?.has(id)) continue;

    return {
      source: curator.sourceId,
      appId: id,
      explanation: `${sourceMarkdownLink(curator.sourceId)}: game ${steamAppMarkdownLink(id)} recommended after developer check`,
    };
  }

  return null;
}

function lookupCuratorsByDeveloperApps(developerName, appIds = []) {
  for (const appId of appIds) {
    const hit = lookupCuratorsByAppId(appId);
    if (hit) return hit;
  }
  return null;
}

function getCuratorIndex() {
  if (curatorDevIndex) return curatorDevIndex;

  if (!warnedMissingCuratorIndex) {
    console.warn(
      'devSources: curator developer index not loaded — optional; sync with --build-dev-index or ensureLiveDevSources'
    );
    warnedMissingCuratorIndex = true;
  }
  curatorDevIndex = new Map();
  return curatorDevIndex;
}

function lookupNeGrai(developerName) {
  const set = getNeGraiSet();
  const normalized = normalizeNeGraiName(developerName);
  if (!normalized || !set.normalized.has(normalized)) return null;

  // Exact normalized match only — no substring fuzzy match (namesMatch caused false positives
  // like Iron Gate AB ↔ IRON GAMES) and no suffix stripping (Pine Studio ↔ Pine Games).
  return {
    isRussianRelated: true,
    source: SOURCE_IDS.NE_GRAI,
    explanation: 'developer found in "Не Грай" database',
  };
}

function lookupCurators(developerName, options = {}) {
  const appIds = options.appIds || [];
  if (!options.skipAppIdLookup) {
    const byApps = lookupCuratorsByDeveloperApps(developerName, appIds);
    if (byApps) return byApps;
  }

  const index = getCuratorIndex();
  const normalized = normalizeDevName(developerName);

  const direct = index.get(normalized);
  if (direct) {
    const curatorLinks = curatorMarkdownLinks(direct.curators);
    return {
      isRussianRelated: true,
      source: primaryCuratorSourceId(direct.curators) || SOURCE_IDS.CURATOR_PLAYUA,
      explanation: `${curatorLinks} (not recommended or informational)`,
    };
  }

  for (const [, entry] of index) {
    if (namesMatch(entry.name, developerName)) {
      const curatorLinks = curatorMarkdownLinks(entry.curators);
      return {
        isRussianRelated: true,
        source: primaryCuratorSourceId(entry.curators) || SOURCE_IDS.CURATOR_PLAYUA,
        explanation: `${curatorLinks} (not recommended or informational)`,
      };
    }
  }

  return null;
}

/**
 * Deterministic lookup across synced sources. Returns null if not listed.
 */
function lookupDeterministicSources(developerName, options = {}) {
  const neGrai = lookupNeGrai(developerName);
  if (neGrai) return neGrai;

  const curator = lookupCurators(developerName, options);
  if (curator) return curator;

  return null;
}

function vettingNameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[/\\.[\]*`]/g, '_')
    .replace(/\s+/g, ' ');
}

function collectVettingNames(game) {
  const seen = new Set();
  const names = [];

  for (const name of [
    ...(game?.steamStatic?.developers || []),
    ...(game?.steamStatic?.publishers || []),
  ]) {
    const trimmed = String(name || '').trim();
    if (!trimmed) continue;

    const key = vettingNameKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }

  return names;
}

function allBundledSourcesNegative(developerName, options = {}) {
  return !lookupNeGrai(developerName) && !lookupCurators(developerName, options);
}

function getSourceMetadata() {
  const neGrai = getNeGraiSet();
  const appIds = getCuratorAppIds();
  getCuratorIndex();

  /** @type {Record<string, { flaggedCount: number, clearedCount: number }>} */
  const byCurator = {};
  for (const key of getCuratorKeys()) {
    byCurator[key] = {
      flaggedCount: appIds[key]?.flagged?.size || 0,
      clearedCount: appIds[key]?.cleared?.size || 0,
    };
  }

  return {
    neGrai: {
      count: neGrai.names.length,
      updatedAt: neGrai.updatedAt,
      version: neGrai.version,
    },
    curators: {
      appIdsUpdatedAt: appIds.meta?.updatedAt || null,
      byCurator,
      devIndexCount: curatorDevIndex?.size || 0,
      devIndexUpdatedAt: curatorMeta?.updatedAt || null,
    },
  };
}

module.exports = {
  SOURCE_IDS,
  SOURCE_LABELS,
  SOURCE_URLS,
  CURATORS,
  normalizeDevName,
  namesMatch,
  loadNeGraiSet: getNeGraiSet,
  loadCuratorAppIds: getCuratorAppIds,
  loadCuratorIndex: getCuratorIndex,
  lookupNeGrai,
  lookupCurators,
  lookupCuratorsByAppId,
  lookupCuratorClearanceByAppId,
  lookupCuratorsByDeveloperApps,
  lookupDeterministicSources,
  collectVettingNames,
  allBundledSourcesNegative,
  getSourceMetadata,
  ensureLiveDevSources,
  resetDevSourcesCache,
  applyDevSourcesPayload,
};

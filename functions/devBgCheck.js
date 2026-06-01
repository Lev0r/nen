/**
 * Developer background-check cache (config schema v3).
 *
 * Path: artifacts/{appId}/public/data/config/dev-bg-check
 * Field: developers.{cacheKey}
 */
const { FieldValue } = require('firebase-admin/firestore');
const {
  DEFAULT_APP_ID,
  DEV_BG_CHECK_DOC_ID,
  configDocPath,
} = require('./configPaths');

/** Stable Firestore map key — lowercase, unsafe chars replaced. */
function devCacheKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[/\\.[\]*`]/g, '_')
    .replace(/\s+/g, ' ');
}

function normalizeDevEntry(name, result) {
  return {
    name: String(name).trim(),
    isRussianRelated: Boolean(result?.isRussianRelated),
    explanation: String(result?.explanation || '').trim(),
    checkedAt: FieldValue.serverTimestamp(),
  };
}

async function loadDevCacheFromFirestore(db, appId = DEFAULT_APP_ID) {
  const snap = await db.doc(configDocPath(appId, DEV_BG_CHECK_DOC_ID)).get();
  const developers = snap.data()?.developers;
  if (!developers || typeof developers !== 'object') {
    return {};
  }
  return developers;
}

/**
 * In-memory map: cacheKey -> { name, isRussianRelated, explanation, checkedAt? }
 * Merges Firestore cache when db provided and memory is empty.
 */
async function ensureMemoryCache(memoryCache, db, appId) {
  if (memoryCache.size > 0 || !db) {
    return memoryCache;
  }
  const stored = await loadDevCacheFromFirestore(db, appId);
  for (const [key, entry] of Object.entries(stored)) {
    if (entry?.name) {
      memoryCache.set(key, entry);
    }
  }
  return memoryCache;
}

function lookupCachedDeveloper(name, memoryCache) {
  const key = devCacheKey(name);
  const entry = memoryCache.get(key);
  if (!entry) return null;
  return {
    key,
    name: entry.name || name,
    isRussianRelated: Boolean(entry.isRussianRelated),
    explanation: String(entry.explanation || '').trim(),
  };
}

async function persistDeveloperResults(db, appId, results, memoryCache) {
  if (!db || !results?.length) return;

  const configRef = db.doc(configDocPath(appId, DEV_BG_CHECK_DOC_ID));
  const existing = (await configRef.get()).data()?.developers || {};
  const merged = { ...existing };

  for (const { key, name, isRussianRelated, explanation } of results) {
    const entry = normalizeDevEntry(name, { isRussianRelated, explanation });
    memoryCache.set(key, { ...entry, checkedAt: new Date() });
    merged[key] = entry;
  }

  await configRef.set({ developers: merged }, { merge: true });
}

function aggregateVettingFromCache(developerNames, memoryCache) {
  const flags = [];
  const seenLines = new Set();
  const seenDevKeys = new Set();

  for (const name of developerNames) {
    const trimmed = String(name || '').trim();
    if (!trimmed) continue;

    const key = devCacheKey(trimmed);
    if (seenDevKeys.has(key)) continue;
    seenDevKeys.add(key);

    const cached = lookupCachedDeveloper(trimmed, memoryCache);
    if (cached?.isRussianRelated) {
      const line = `${cached.name}: ${cached.explanation}`;
      if (seenLines.has(line)) continue;
      seenLines.add(line);
      flags.push(line);
    }
  }

  if (flags.length === 0) {
    return { ruDeveloperAlert: false, ruDeveloperExplanation: '' };
  }

  return {
    ruDeveloperAlert: true,
    ruDeveloperExplanation: flags.join(' | '),
  };
}

/**
 * Apply RU vetting to a game: curator app-id list, NE GRAI, dev cache, per-dev lookup.
 */
function aggregateGameVetting(game, memoryCache) {
  const { lookupDeterministicSources, lookupCuratorsByAppId, collectVettingNames } =
    require('./devSources');
  const flags = [];
  const seenLines = new Set();
  const seenDevKeys = new Set();

  const addFlag = (text) => {
    const line = String(text || '').trim();
    if (!line || seenLines.has(line)) return;
    seenLines.add(line);
    flags.push(line);
  };

  const appId = game?.id != null ? String(game.id) : '';
  let appCuratorHit = null;
  if (appId) {
    appCuratorHit = lookupCuratorsByAppId(appId);
    if (appCuratorHit) addFlag(appCuratorHit.explanation);
  }

  const appIds = appId ? [appId] : [];
  const lookupOptions = {
    appIds,
    skipAppIdLookup: Boolean(appCuratorHit),
  };

  for (const trimmed of collectVettingNames(game)) {
    const key = devCacheKey(trimmed);
    if (seenDevKeys.has(key)) continue;
    seenDevKeys.add(key);

    const cached = lookupCachedDeveloper(trimmed, memoryCache);
    if (cached?.isRussianRelated) {
      addFlag(`${cached.name}: ${cached.explanation}`);
      continue;
    }

    const hit = lookupDeterministicSources(trimmed, lookupOptions);
    if (hit) addFlag(`${trimmed}: ${hit.explanation}`);
  }

  if (flags.length === 0) {
    return { ruDeveloperAlert: false, ruDeveloperExplanation: '' };
  }

  return {
    ruDeveloperAlert: true,
    ruDeveloperExplanation: flags.join(' | '),
  };
}

const SOURCE_LAYER_LABELS = {
  'curator-app-id': 'Curator app list',
  'dev-cache': 'Developer cache',
  'ne-grai': 'NE GRAI',
  curators: 'Curator dev index',
  'source-list': 'Source lookup',
};

/**
 * Explain per-layer vetting decision for CLI dry-run / debugging.
 */
function explainGameVetting(game, memoryCache) {
  const {
    lookupDeterministicSources,
    lookupCuratorsByAppId,
    lookupNeGrai,
    lookupCurators,
    collectVettingNames,
  } = require('./devSources');
  const trace = [];

  const appId = game?.id != null ? String(game.id) : '';
  let appHit = null;
  if (appId) {
    appHit = lookupCuratorsByAppId(appId);
    trace.push({
      layer: 'curator-app-id',
      hit: Boolean(appHit),
      detail: appHit?.explanation || 'app not on any curator flagged list',
    });
  }

  const appIds = appId ? [appId] : [];
  const lookupOptions = {
    appIds,
    skipAppIdLookup: Boolean(appHit),
  };

  for (const trimmed of collectVettingNames(game)) {

    const cached = lookupCachedDeveloper(trimmed, memoryCache);
    if (cached) {
      trace.push({
        layer: 'dev-cache',
        developer: trimmed,
        hit: cached.isRussianRelated,
        detail: cached.isRussianRelated
          ? cached.explanation
          : 'developer cache: cleared (not RU)',
      });
      if (cached.isRussianRelated) continue;
    }

    const neGrai = lookupNeGrai(trimmed);
    if (neGrai) {
      trace.push({
        layer: 'ne-grai',
        developer: trimmed,
        hit: true,
        detail: neGrai.explanation,
      });
      continue;
    }

    const curator = lookupCurators(trimmed, lookupOptions);
    if (curator) {
      trace.push({
        layer: 'curators',
        developer: trimmed,
        hit: true,
        detail: curator.explanation,
      });
      continue;
    }

    const hit = lookupDeterministicSources(trimmed, lookupOptions);
    if (hit) {
      trace.push({
        layer: 'source-list',
        developer: trimmed,
        hit: true,
        detail: hit.explanation,
      });
    } else if (!cached) {
      trace.push({
        layer: 'source-list',
        developer: trimmed,
        hit: false,
        detail: 'not in NE GRAI or curator lists',
      });
    }
  }

  const vetting = aggregateGameVetting(game, memoryCache);
  return { ...vetting, trace };
}

function formatVettingTraceLine(entry) {
  const label = SOURCE_LAYER_LABELS[entry.layer] || entry.layer;
  const who = entry.developer ? ` «${entry.developer}»` : '';
  const status = entry.hit ? 'FLAG' : 'clear';
  return `    ${label}${who}: ${status} — ${entry.detail}`;
}

function collectUncachedDevelopers(developerNames, memoryCache) {
  const seen = new Set();
  const uncached = [];

  for (const name of developerNames) {
    const trimmed = String(name || '').trim();
    if (!trimmed) continue;

    const key = devCacheKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);

    if (!lookupCachedDeveloper(trimmed, memoryCache)) {
      uncached.push(trimmed);
    }
  }

  return uncached;
}

module.exports = {
  DEV_BG_CHECK_DOC_ID,
  DEFAULT_APP_ID,
  devCacheKey,
  loadDevCacheFromFirestore,
  ensureMemoryCache,
  lookupCachedDeveloper,
  persistDeveloperResults,
  aggregateVettingFromCache,
  aggregateGameVetting,
  explainGameVetting,
  formatVettingTraceLine,
  collectUncachedDevelopers,
  normalizeDevEntry,
};

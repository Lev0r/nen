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

  for (const name of developerNames) {
    const cached = lookupCachedDeveloper(name, memoryCache);
    if (cached?.isRussianRelated) {
      flags.push(`${cached.name}: ${cached.explanation}`);
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
  const { lookupDeterministicSources, lookupCuratorsByAppId } = require('./devSources');
  const flags = [];
  const seen = new Set();

  const addFlag = (text) => {
    const line = String(text || '').trim();
    if (!line || seen.has(line)) return;
    seen.add(line);
    flags.push(line);
  };

  const appId = game?.id != null ? String(game.id) : '';
  if (appId) {
    const appHit = lookupCuratorsByAppId(appId);
    if (appHit) addFlag(appHit.explanation);
  }

  const appIds = appId ? [appId] : [];
  for (const name of game?.steamStatic?.developers || []) {
    const trimmed = String(name || '').trim();
    if (!trimmed) continue;

    const cached = lookupCachedDeveloper(trimmed, memoryCache);
    if (cached?.isRussianRelated) {
      addFlag(`${cached.name}: ${cached.explanation}`);
      continue;
    }

    const hit = lookupDeterministicSources(trimmed, { appIds });
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
  collectUncachedDevelopers,
  normalizeDevEntry,
};

/**
 * Developer background-check cache stored on config/default (same doc as gfnCatalog).
 *
 * Path: artifacts/{appId}/public/data/config/default
 * Field: devBgCheck.developers.{cacheKey}
 */
const { FieldValue } = require('firebase-admin/firestore');

const CONFIG_DOC_ID = 'default';
const DEFAULT_APP_ID = 'default_app';

function getConfigDocPath(appId = DEFAULT_APP_ID) {
  return `artifacts/${appId}/public/data/config/${CONFIG_DOC_ID}`;
}

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
  const snap = await db.doc(getConfigDocPath(appId)).get();
  const developers = snap.data()?.devBgCheck?.developers;
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

  const payload = {};
  for (const { key, name, isRussianRelated, explanation } of results) {
    const entry = normalizeDevEntry(name, { isRussianRelated, explanation });
    memoryCache.set(key, { ...entry, checkedAt: new Date() });
    payload[key] = entry;
  }

  await db.doc(getConfigDocPath(appId)).set(
    {
      devBgCheck: {
        developers: payload,
      },
    },
    { merge: true }
  );
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
  CONFIG_DOC_ID,
  DEFAULT_APP_ID,
  getConfigDocPath,
  devCacheKey,
  loadDevCacheFromFirestore,
  ensureMemoryCache,
  lookupCachedDeveloper,
  persistDeveloperResults,
  aggregateVettingFromCache,
  collectUncachedDevelopers,
  normalizeDevEntry,
};

/**
 * Developer vetting via bundled sources (NE GRAI + Steam curators).
 * Results are cached in config/dev-bg-check.developers.
 */
const {
  devCacheKey,
  ensureMemoryCache,
  persistDeveloperResults,
  aggregateVettingFromCache,
  collectUncachedDevelopers,
} = require('./devBgCheck');
const { lookupDeterministicSources, ensureLiveDevSources } = require('./devSources');

function negativeBundledResult(name) {
  return {
    key: devCacheKey(name),
    name,
    isRussianRelated: false,
    explanation: '',
    source: 'bundled_sources',
  };
}

function resolveUncachedDevelopers(uncachedNames, options = {}) {
  const devAppIdMap = options.devAppIdMap || {};
  const resolved = [];

  for (const name of uncachedNames) {
    const appIds = devAppIdMap[name] || [];
    const hit = lookupDeterministicSources(name, { appIds });
    if (hit) {
      resolved.push({
        key: devCacheKey(name),
        name,
        isRussianRelated: hit.isRussianRelated,
        explanation: hit.explanation,
        source: hit.source,
      });
    } else {
      resolved.push(negativeBundledResult(name));
    }
  }

  return resolved;
}

async function vetUncachedDevelopers(uncachedNames, options) {
  const { db, appId, memoryCache, dryRun = false } = options;
  const stats = {
    cached: 0,
    sourceHits: 0,
    bundledClears: 0,
  };

  if (!uncachedNames.length) {
    return stats;
  }

  const resolved = resolveUncachedDevelopers(uncachedNames, options);
  stats.sourceHits += resolved.filter((r) => r.source && r.source !== 'bundled_sources').length;
  stats.bundledClears += resolved.filter((r) => r.source === 'bundled_sources').length;

  if (dryRun) {
    for (const entry of resolved) {
      memoryCache.set(entry.key, {
        name: entry.name,
        isRussianRelated: entry.isRussianRelated,
        explanation: entry.explanation,
        checkedAt: new Date(),
      });
    }
    console.log(
      `  DRY-RUN source lookup: ${stats.sourceHits} flagged, ${stats.bundledClears} cleared (in-memory only, no Firestore writes)`
    );
    return stats;
  }

  if (db && appId) {
    await persistDeveloperResults(db, appId, resolved, memoryCache);
  } else {
    for (const entry of resolved) {
      memoryCache.set(entry.key, {
        name: entry.name,
        isRussianRelated: entry.isRussianRelated,
        explanation: entry.explanation,
        checkedAt: new Date(),
      });
    }
  }

  stats.cached += resolved.length;
  return stats;
}

/**
 * Vet game developers with Firestore-backed cache and bundled source lists.
 *
 * @param {string[]} developers
 * @param {{ db?, appId?, memoryCache?, dryRun?, devAppIdMap?, forceRefresh? }} [options]
 */
async function vetAllDevelopers(developers, options = {}) {
  if (!developers?.length) {
    return {
      ruDeveloperAlert: false,
      ruDeveloperExplanation: '',
      stats: {
        cacheHits: 0,
        cached: 0,
        sourceHits: 0,
        bundledClears: 0,
      },
    };
  }

  const unique = [...new Set(developers.filter(Boolean).map((d) => String(d).trim()))];
  const memoryCache = options.memoryCache || new Map();
  const { db, appId, dryRun = false, forceRefresh = false } = options;

  if (db && appId) {
    await ensureMemoryCache(memoryCache, db, appId);
    await ensureLiveDevSources(db, appId);
  }

  const uncached = forceRefresh
    ? unique
    : collectUncachedDevelopers(unique, memoryCache);
  const cacheHits = forceRefresh ? 0 : unique.length - uncached.length;

  let vetStats = {
    cacheHits,
    cached: 0,
    sourceHits: 0,
    bundledClears: 0,
  };

  if (uncached.length) {
    const batchStats = await vetUncachedDevelopers(uncached, {
      db,
      appId,
      memoryCache,
      dryRun,
      devAppIdMap: options.devAppIdMap,
    });
    vetStats = { cacheHits, ...batchStats };
  }

  const vetting = aggregateVettingFromCache(unique, memoryCache);
  return { ...vetting, stats: vetStats, memoryCache };
}

module.exports = {
  vetAllDevelopers,
};

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { assertAllowedUser } = require('./lib/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { STEAM_WISHLIST_CANDIDATES_DOC_ID, configDocPath } = require('./configPaths');
const {
  DEFAULT_APP_ID,
  gamesCollectionPath,
  gameDocPath,
} = require('./lib/firestorePaths');
const {
  buildErrorEntryId,
  rebuildMaintenanceAudit,
  upsertMaintenanceError,
  clearMaintenanceError,
} = require('./maintenanceStore');
const { getConfiguredSteamIds, getWishlist } = require('./steamWebApi');
const { getSteamAppMeta } = require('./steamAppMetaCache');
const { fetchSteamGame } = require('./steam');
const { enrichAndPersistFromSteam } = require('./gamePersist');

function toWishlistSet(appIds) {
  return new Set((appIds || []).map((id) => Number(id)));
}

async function recordUserWishlistError(db, appId, userKey, errorMessage) {
  const message = `User ${userKey} wishlist: ${errorMessage}`;
  await upsertMaintenanceError(db, appId, {
    severity: 'warning',
    source: 'steam-wishlist',
    gameId: null,
    gameName: null,
    message,
    errorKey: `${userKey}-wishlist`,
    detail: null,
  });
}

async function clearUserWishlistError(db, appId, userKey) {
  const entryId = buildErrorEntryId(
    'steam-wishlist',
    null,
    `${userKey}-wishlist`,
    `User ${userKey} wishlist`
  );
  await clearMaintenanceError(db, appId, entryId);
}

async function writeSteamWishlistCandidates(db, appId, payload) {
  await db.doc(configDocPath(appId, STEAM_WISHLIST_CANDIDATES_DOC_ID)).set(
    {
      syncedAt: FieldValue.serverTimestamp(),
      candidates: payload.candidates,
      user0WishlistCount: payload.user0WishlistCount,
      user1WishlistCount: payload.user1WishlistCount,
      preFilterCandidateCount: payload.preFilterCandidateCount,
      nonCoopSkipped: payload.nonCoopSkipped,
      scrapeFailed: payload.scrapeFailed,
      dlcSkipped: payload.dlcSkipped,
      nonGameSkipped: payload.nonGameSkipped,
      cacheHits: payload.cacheHits,
      cacheMisses: payload.cacheMisses,
      candidateCount: payload.candidateCount,
      importedCount: payload.importedCount,
      importErrors: payload.importErrors,
      errors: payload.errors,
    },
    { merge: false }
  );
}

function buildCandidates(user0Set, user1Set, libraryIds) {
  const librarySet = new Set(libraryIds.map(String));
  const candidateIds = new Set();

  if (user0Set) {
    for (const appId of user0Set) candidateIds.add(appId);
  }
  if (user1Set) {
    for (const appId of user1Set) candidateIds.add(appId);
  }

  const candidates = [];
  for (const appId of candidateIds) {
    const idStr = String(appId);
    if (librarySet.has(idStr)) continue;
    candidates.push({
      appId,
      onWishlistUser0: user0Set ? user0Set.has(appId) : false,
      onWishlistUser1: user1Set ? user1Set.has(appId) : false,
    });
  }

  candidates.sort((a, b) => a.appId - b.appId);
  return candidates;
}

async function filterCoopWishlistCandidates(candidates, db, appId) {
  const filtered = [];
  let nonCoopSkipped = 0;
  let scrapeFailed = 0;
  let dlcSkipped = 0;
  let nonGameSkipped = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  for (const candidate of candidates) {
    const meta = await getSteamAppMeta(db, appId, candidate.appId);
    if (!meta) {
      scrapeFailed += 1;
      continue;
    }

    if (meta.cacheHit) cacheHits += 1;
    if (meta.cacheMiss) cacheMisses += 1;

    if (meta.storeType !== 'game') {
      if (meta.storeType === 'dlc') {
        dlcSkipped += 1;
      } else {
        nonGameSkipped += 1;
      }
      continue;
    }

    if (!meta.hasCoop) {
      nonCoopSkipped += 1;
      continue;
    }

    filtered.push({
      ...candidate,
      name: meta.name,
    });
  }

  return {
    filtered,
    nonCoopSkipped,
    scrapeFailed,
    dlcSkipped,
    nonGameSkipped,
    cacheHits,
    cacheMisses,
  };
}

async function autoImportWishlistCandidates(db, appId, candidates) {
  let importedCount = 0;
  let importErrors = 0;

  for (const candidate of candidates) {
    const steamAppId = String(candidate.appId);
    const existing = await db.doc(gameDocPath(appId, steamAppId)).get();
    if (existing.exists) {
      continue;
    }

    try {
      const game = await fetchSteamGame(steamAppId);
      await enrichAndPersistFromSteam(db, game, appId);
      importedCount += 1;
    } catch (err) {
      importErrors += 1;
      console.error(`syncSteamWishlists autoImport failed for ${steamAppId}:`, err);
      await upsertMaintenanceError(db, appId, {
        severity: 'warning',
        source: 'steam-wishlist',
        gameId: steamAppId,
        gameName: candidate.name || null,
        message: err.message || 'Failed to auto-import wishlist game',
        errorKey: null,
        detail: null,
      });
    }
  }

  return { importedCount, importErrors };
}

async function syncSteamWishlistsCore(appId = DEFAULT_APP_ID, { autoImport = false } = {}) {
  const db = getFirestore();
  const { user0: steamId0, user1: steamId1 } = getConfiguredSteamIds();

  let user0WishlistSet = null;
  let user1WishlistSet = null;
  let user0WishlistCount = 0;
  let user1WishlistCount = 0;
  let errors = 0;

  if (!steamId0) {
    await recordUserWishlistError(db, appId, 0, 'STEAM_ID_0 not configured');
    errors += 1;
  } else {
    const result0 = await getWishlist(steamId0);
    if (result0.error) {
      await recordUserWishlistError(db, appId, 0, result0.error);
      errors += 1;
    } else {
      user0WishlistSet = toWishlistSet(result0.appIds);
      user0WishlistCount = user0WishlistSet.size;
      await clearUserWishlistError(db, appId, 0);
    }
  }

  if (!steamId1) {
    await recordUserWishlistError(db, appId, 1, 'STEAM_ID_1 not configured');
    errors += 1;
  } else {
    const result1 = await getWishlist(steamId1);
    if (result1.error) {
      await recordUserWishlistError(db, appId, 1, result1.error);
      errors += 1;
    } else {
      user1WishlistSet = toWishlistSet(result1.appIds);
      user1WishlistCount = user1WishlistSet.size;
      await clearUserWishlistError(db, appId, 1);
    }
  }

  let candidates = [];
  let preFilterCandidateCount = 0;
  let nonCoopSkipped = 0;
  let scrapeFailed = 0;
  let dlcSkipped = 0;
  let nonGameSkipped = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  if (user0WishlistSet || user1WishlistSet) {
    const snapshot = await db.collection(gamesCollectionPath(appId)).get();
    const libraryIds = snapshot.docs.map((doc) => doc.id);
    const rawCandidates = buildCandidates(user0WishlistSet, user1WishlistSet, libraryIds);
    preFilterCandidateCount = rawCandidates.length;

    const coopResult = await filterCoopWishlistCandidates(rawCandidates, db, appId);
    candidates = coopResult.filtered;
    nonCoopSkipped = coopResult.nonCoopSkipped;
    scrapeFailed = coopResult.scrapeFailed;
    dlcSkipped = coopResult.dlcSkipped;
    nonGameSkipped = coopResult.nonGameSkipped;
    cacheHits = coopResult.cacheHits;
    cacheMisses = coopResult.cacheMisses;
    errors += scrapeFailed;
  }

  let importedCount = 0;
  let importErrors = 0;
  if (autoImport && candidates.length > 0) {
    const importResult = await autoImportWishlistCandidates(db, appId, candidates);
    importedCount = importResult.importedCount;
    importErrors = importResult.importErrors;
    errors += importErrors;
  }

  const stats = {
    candidates,
    user0WishlistCount,
    user1WishlistCount,
    preFilterCandidateCount,
    nonCoopSkipped,
    scrapeFailed,
    dlcSkipped,
    nonGameSkipped,
    cacheHits,
    cacheMisses,
    candidateCount: candidates.length,
    importedCount,
    importErrors,
    errors,
  };

  console.log(
    `syncSteamWishlists: user0WishlistCount=${user0WishlistCount}, user1WishlistCount=${user1WishlistCount}, preFilterCandidateCount=${preFilterCandidateCount}, candidateCount=${stats.candidateCount}, nonCoopSkipped=${nonCoopSkipped}, dlcSkipped=${dlcSkipped}, nonGameSkipped=${nonGameSkipped}, cacheHits=${cacheHits}, cacheMisses=${cacheMisses}, scrapeFailed=${scrapeFailed}, importedCount=${importedCount}, importErrors=${importErrors}, errors=${errors}`
  );

  await writeSteamWishlistCandidates(db, appId, stats);
  await rebuildMaintenanceAudit(db, appId);
  return stats;
}

async function syncSteamWishlistsCallable(request) {
  assertAllowedUser(request.auth);

  const appId = request.data?.appId || DEFAULT_APP_ID;

  try {
    return await syncSteamWishlistsCore(appId, { autoImport: false });
  } catch (err) {
    console.error('syncSteamWishlists failed:', err);
    throw new HttpsError('internal', err.message || 'Failed to sync Steam wishlists.');
  }
}

const syncSteamWishlists = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 300,
    memory: '512MiB',
    cors: true,
  },
  syncSteamWishlistsCallable
);

module.exports = {
  syncSteamWishlists,
  syncSteamWishlistsCore,
};

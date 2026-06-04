const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { assertAllowedUser } = require('./lib/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { STEAM_OWNERSHIP_SYNC_DOC_ID, configDocPath } = require('./lib/firestorePaths');
const { DEFAULT_APP_ID, gamesCollectionPath } = require('./lib/firestorePaths');
const {
  buildErrorEntryId,
  rebuildMaintenanceAudit,
  upsertMaintenanceError,
  clearMaintenanceError,
} = require('./maintenanceStore');
const { getConfiguredSteamIds, getOwnedGames } = require('./steamWebApi');

function toOwnedSet(appIds) {
  return new Set((appIds || []).map((id) => String(id)));
}

function playtimeMinutesForUser(ownedSet, playtimeByAppId, appId) {
  if (!ownedSet || !playtimeByAppId) return undefined;
  if (!ownedSet.has(appId)) return undefined;
  const minutes = playtimeByAppId[appId];
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : 0;
}

async function recordUserOwnedGamesError(db, appId, userKey, errorMessage) {
  const message = `User ${userKey} owned games: ${errorMessage}`;
  await upsertMaintenanceError(db, appId, {
    severity: 'warning',
    source: 'steam-ownership',
    gameId: null,
    gameName: null,
    message,
    errorKey: `${userKey}-owned-games`,
    detail: null,
  });
}

async function clearUserOwnedGamesError(db, appId, userKey) {
  const entryId = buildErrorEntryId(
    'steam-ownership',
    null,
    `${userKey}-owned-games`,
    `User ${userKey} owned games`
  );
  await clearMaintenanceError(db, appId, entryId);
}

async function writeSteamOwnershipSyncMeta(db, appId, stats) {
  await db.doc(configDocPath(appId, STEAM_OWNERSHIP_SYNC_DOC_ID)).set(
    {
      syncedAt: FieldValue.serverTimestamp(),
      user0OwnedCount: stats.user0OwnedCount,
      user1OwnedCount: stats.user1OwnedCount,
      gamesUpdated: stats.gamesUpdated,
      gamesChecked: stats.gamesChecked,
      errors: stats.errors,
    },
    { merge: true }
  );
}

async function syncSteamOwnershipCore(appId = DEFAULT_APP_ID) {
  const db = getFirestore();
  const { user0: steamId0, user1: steamId1 } = getConfiguredSteamIds();

  let user0OwnedSet = null;
  let user1OwnedSet = null;
  let user0PlaytimeByAppId = null;
  let user1PlaytimeByAppId = null;
  let user0OwnedCount = 0;
  let user1OwnedCount = 0;
  let errors = 0;

  if (!steamId0) {
    await recordUserOwnedGamesError(db, appId, 0, 'STEAM_ID_0 not configured');
    errors += 1;
  } else {
    const result0 = await getOwnedGames(steamId0);
    if (result0.error) {
      await recordUserOwnedGamesError(db, appId, 0, result0.error);
      errors += 1;
    } else {
      user0OwnedSet = toOwnedSet(result0.appIds);
      user0PlaytimeByAppId = result0.playtimeByAppId;
      user0OwnedCount = user0OwnedSet.size;
      await clearUserOwnedGamesError(db, appId, 0);
    }
  }

  if (!steamId1) {
    await recordUserOwnedGamesError(db, appId, 1, 'STEAM_ID_1 not configured');
    errors += 1;
  } else {
    const result1 = await getOwnedGames(steamId1);
    if (result1.error) {
      await recordUserOwnedGamesError(db, appId, 1, result1.error);
      errors += 1;
    } else {
      user1OwnedSet = toOwnedSet(result1.appIds);
      user1PlaytimeByAppId = result1.playtimeByAppId;
      user1OwnedCount = user1OwnedSet.size;
      await clearUserOwnedGamesError(db, appId, 1);
    }
  }

  if (!user0OwnedSet && !user1OwnedSet) {
    const stats = {
      user0OwnedCount,
      user1OwnedCount,
      gamesUpdated: 0,
      gamesChecked: 0,
      errors,
    };
    await writeSteamOwnershipSyncMeta(db, appId, stats);
    await rebuildMaintenanceAudit(db, appId);
    return stats;
  }

  const snapshot = await db.collection(gamesCollectionPath(appId)).get();
  let gamesUpdated = 0;
  const gamesChecked = snapshot.size;

  for (const doc of snapshot.docs) {
    const game = doc.data();
    const owned = game.owned || {};
    const currentUser0 = owned.user0 === true;
    const currentUser1 = owned.user1 === true;

    const nextUser0 = currentUser0 || (user0OwnedSet?.has(doc.id) ?? false);
    const nextUser1 = currentUser1 || (user1OwnedSet?.has(doc.id) ?? false);

    const user0Transition = !currentUser0 && nextUser0;
    const user1Transition = !currentUser1 && nextUser1;

    const nextUser0Minutes = playtimeMinutesForUser(
      user0OwnedSet,
      user0PlaytimeByAppId,
      doc.id
    );
    const nextUser1Minutes = playtimeMinutesForUser(
      user1OwnedSet,
      user1PlaytimeByAppId,
      doc.id
    );

    const ownershipUpdate = {};
    if (user0Transition) ownershipUpdate['owned.user0'] = true;
    if (user1Transition) ownershipUpdate['owned.user1'] = true;

    const playtimeUpdate = {};
    const currentPlaytime = game.steamPlaytime || {};
    if (
      nextUser0Minutes !== undefined &&
      currentPlaytime.user0Minutes !== nextUser0Minutes
    ) {
      playtimeUpdate['steamPlaytime.user0Minutes'] = nextUser0Minutes;
    }
    if (
      nextUser1Minutes !== undefined &&
      currentPlaytime.user1Minutes !== nextUser1Minutes
    ) {
      playtimeUpdate['steamPlaytime.user1Minutes'] = nextUser1Minutes;
    }
    if (Object.keys(playtimeUpdate).length > 0) {
      playtimeUpdate['steamPlaytime.syncedAt'] = FieldValue.serverTimestamp();
    }

    const docUpdate = { ...ownershipUpdate, ...playtimeUpdate };
    if (Object.keys(docUpdate).length === 0) {
      continue;
    }

    try {
      await doc.ref.update(docUpdate);
      gamesUpdated += 1;
    } catch (err) {
      console.error(`syncSteamOwnership failed for ${doc.id}:`, err);
      errors += 1;
      await upsertMaintenanceError(db, appId, {
        severity: 'warning',
        source: 'steam-ownership',
        gameId: doc.id,
        gameName: game.steamStatic?.name || null,
        message: err.message || 'Failed to update ownership flags',
        errorKey: null,
        detail: null,
      });
    }
  }

  const stats = {
    user0OwnedCount,
    user1OwnedCount,
    gamesUpdated,
    gamesChecked,
    errors,
  };

  console.log(
    `syncSteamOwnership: user0OwnedCount=${user0OwnedCount}, user1OwnedCount=${user1OwnedCount}, gamesUpdated=${gamesUpdated}, gamesChecked=${gamesChecked}, errors=${errors}`
  );

  await writeSteamOwnershipSyncMeta(db, appId, stats);
  await rebuildMaintenanceAudit(db, appId);
  return stats;
}

async function syncSteamOwnershipCallable(request) {
  assertAllowedUser(request.auth);

  const appId = request.data?.appId || DEFAULT_APP_ID;

  try {
    return await syncSteamOwnershipCore(appId);
  } catch (err) {
    console.error('syncSteamOwnership failed:', err);
    throw new HttpsError('internal', err.message || 'Failed to sync Steam ownership.');
  }
}

const syncSteamOwnership = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '256MiB',
    cors: true,
  },
  syncSteamOwnershipCallable
);

module.exports = {
  syncSteamOwnership,
  syncSteamOwnershipCore,
};

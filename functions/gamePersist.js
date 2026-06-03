const { FieldValue } = require('firebase-admin/firestore');
const { HttpsError } = require('firebase-functions/v2/https');
const { vetAllDevelopers } = require('./devVetting');
const { aggregateGameVetting } = require('./devBgCheck');
const { collectVettingNames } = require('./devSources');
const { enrichNewGameThirdParty } = require('./thirdParty');
const {
  upsertMaintenanceError,
  clearMaintenanceErrorsForGame,
  rebuildMaintenanceAudit,
  recordSyncOutcomeError,
} = require('./maintenanceStore');
const { gameDocPath } = require('./lib/firestorePaths');

const SERVER_TIMESTAMP_SENTINEL = '__SERVER_TIMESTAMP__';

function isServerTimestamp(value) {
  return (
    value &&
    typeof value === 'object' &&
    (value._methodName === 'serverTimestamp' ||
      value.constructor?.name === 'ServerTimestampTransform')
  );
}

function serializeGameForClient(game) {
  return JSON.parse(
    JSON.stringify(game, (_key, value) =>
      isServerTimestamp(value) ? SERVER_TIMESTAMP_SENTINEL : value
    )
  );
}

function restoreGameFieldValues(value) {
  if (value === SERVER_TIMESTAMP_SENTINEL) {
    return FieldValue.serverTimestamp();
  }
  if (Array.isArray(value)) {
    return value.map(restoreGameFieldValues);
  }
  if (value && typeof value === 'object') {
    const restored = {};
    for (const [key, entry] of Object.entries(value)) {
      restored[key] = restoreGameFieldValues(entry);
    }
    return restored;
  }
  return value;
}

async function assertGameNotDuplicate(db, appId, gameId) {
  const gameRef = db.doc(gameDocPath(appId, gameId));
  const existing = await gameRef.get();
  if (existing.exists) {
    throw new HttpsError('already-exists', 'This game is already in your library.');
  }
  return gameRef;
}

async function recordThirdPartyOutcomes(db, appId, game, outcomes) {
  const gameId = game?.id != null ? String(game.id) : null;
  const gameName = game?.steamStatic?.name || null;

  for (const outcome of outcomes || []) {
    await recordSyncOutcomeError(db, appId, outcome, { gameId, gameName });
  }
}

async function persistSteamGame(db, game, appId) {
  const gameRef = await assertGameNotDuplicate(db, appId, game.id);

  await gameRef.set(game);

  const vettingNames = collectVettingNames(game);
  const devAppIdMap = {};
  for (const name of vettingNames) {
    devAppIdMap[name] = [game.id];
  }

  try {
    const { stats, memoryCache } = await vetAllDevelopers(vettingNames, {
      db,
      appId,
      devAppIdMap,
    });
    const vetting = aggregateGameVetting(game, memoryCache);
    await gameRef.update(vetting);
    await clearMaintenanceErrorsForGame(db, appId, String(game.id), 'vetting');
    await rebuildMaintenanceAudit(db, appId);
    return { gameId: game.id, ...vetting, vettingStats: stats };
  } catch (err) {
    console.error('Developer vetting failed:', err);
    const vettingError = err.message || 'Developer vetting failed';
    await upsertMaintenanceError(db, appId, {
      severity: 'warning',
      source: 'vetting',
      gameId: String(game.id),
      gameName: game.steamStatic?.name || null,
      message: vettingError,
      errorKey: null,
      detail: null,
    });
    await rebuildMaintenanceAudit(db, appId);
    return {
      gameId: game.id,
      vettingError,
    };
  }
}

async function enrichAndPersistFromSteam(db, game, appId, _options = {}) {
  const enriched = await enrichNewGameThirdParty(game);
  await recordThirdPartyOutcomes(db, appId, enriched.game, enriched.outcomes);
  return persistSteamGame(db, enriched.game, appId);
}

module.exports = {
  serializeGameForClient,
  restoreGameFieldValues,
  assertGameNotDuplicate,
  recordThirdPartyOutcomes,
  persistSteamGame,
  enrichAndPersistFromSteam,
};

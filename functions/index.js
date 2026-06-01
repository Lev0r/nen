const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { fetchSteamGame, parseAppId } = require('./steam');
const { vetAllDevelopers } = require('./devVetting');
const { aggregateGameVetting, ensureMemoryCache, mergeVettingWithUserAcknowledgment } = require('./devBgCheck');
const { collectVettingNames } = require('./devSources');
const { enrichNewGameThirdParty } = require('./thirdParty');
const { syncLibrarySteam, syncSteamLibrary } = require('./steamSync');
const { syncGfnCatalog, syncGfnCatalogScheduled } = require('./gfnSync');
const { syncDevSources, syncDevSourcesScheduled } = require('./devSourceSync');
const {
  upsertMaintenanceError,
  clearMaintenanceErrorsForGame,
  clearInfoMaintenanceErrors,
  rebuildMaintenanceAudit,
  recordSyncOutcomeError,
} = require('./maintenanceStore');
const { DEFAULT_APP_ID } = require('./configPaths');

initializeApp();

const SERVER_TIMESTAMP_SENTINEL = '__SERVER_TIMESTAMP__';

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
  const gameRef = db.doc(`artifacts/${appId}/public/data/games/${gameId}`);
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

exports.previewSteamGame = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
    cors: true,
  },
  async (request) => {
    assertAllowedUser(request.auth);

    const steamInput = request.data?.steamInput;
    const appId = request.data?.appId || 'default_app';

    if (!steamInput) {
      throw new HttpsError('invalid-argument', 'steamInput is required.');
    }

    const parsedId = parseAppId(steamInput);
    if (!parsedId || !/^\d+$/.test(parsedId)) {
      throw new HttpsError('invalid-argument', 'Invalid Steam URL or App ID.');
    }

    const db = getFirestore();
    await assertGameNotDuplicate(db, appId, parsedId);

    let game;
    try {
      game = await fetchSteamGame(steamInput);
    } catch (err) {
      console.error('Steam scrape failed:', err);
      throw new HttpsError('failed-precondition', err.message || 'Failed to fetch Steam data.');
    }

    return {
      appId: game.id,
      name: game.steamStatic?.name || '',
      hasCoopCategory: game.steamStatic?.hasCoopCategory === true,
      coopSpecs: game.steamStatic?.coopSpecs ?? null,
      game: serializeGameForClient(game),
    };
  }
);

exports.addGameFromSteam = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
    cors: true,
  },
  async (request) => {
    assertAllowedUser(request.auth);

    const steamInput = request.data?.steamInput;
    const appId = request.data?.appId || 'default_app';
    const skipScrape = request.data?.skipScrape === true;
    const preloadedGame = request.data?.preloadedGame;

    const db = getFirestore();
    let game;

    if (skipScrape) {
      if (!preloadedGame || typeof preloadedGame !== 'object') {
        throw new HttpsError('invalid-argument', 'preloadedGame is required when skipScrape is true.');
      }

      game = restoreGameFieldValues(preloadedGame);
      if (!game?.id || !/^\d+$/.test(String(game.id))) {
        throw new HttpsError('invalid-argument', 'preloadedGame must include a valid Steam app id.');
      }

      if (steamInput) {
        const parsedId = parseAppId(steamInput);
        if (parsedId && parsedId !== String(game.id)) {
          throw new HttpsError(
            'invalid-argument',
            'preloadedGame id does not match the provided steamInput.'
          );
        }
      }

      try {
        const enriched = await enrichNewGameThirdParty(game);
        game = enriched.game;
        await recordThirdPartyOutcomes(db, appId, game, enriched.outcomes);
      } catch (err) {
        console.error('Third-party enrich failed:', err);
        throw new HttpsError(
          'failed-precondition',
          err.message || 'Failed to enrich game metadata.'
        );
      }
    } else {
      if (!steamInput) {
        throw new HttpsError('invalid-argument', 'steamInput is required.');
      }

      try {
        game = await fetchSteamGame(steamInput);
        const enriched = await enrichNewGameThirdParty(game);
        game = enriched.game;
        await recordThirdPartyOutcomes(db, appId, game, enriched.outcomes);
      } catch (err) {
        console.error('Steam scrape failed:', err);
        throw new HttpsError('failed-precondition', err.message || 'Failed to fetch Steam data.');
      }
    }

    return persistSteamGame(db, game, appId);
  }
);

exports.vetGameDevelopers = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: true,
  },
  async (request) => {
    assertAllowedUser(request.auth);

    const gameId = String(request.data?.gameId || '').trim();
    const appId = request.data?.appId || 'default_app';

    if (!gameId) {
      throw new HttpsError('invalid-argument', 'gameId is required.');
    }

    const db = getFirestore();
    const gameRef = db.doc(`artifacts/${appId}/public/data/games/${gameId}`);
    const snap = await gameRef.get();

    if (!snap.exists) {
      throw new HttpsError('not-found', 'Game not found.');
    }

    const game = { id: snap.id, ...snap.data() };
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
        forceRefresh: true,
      });
      const vetting = mergeVettingWithUserAcknowledgment(
        game,
        aggregateGameVetting(game, memoryCache)
      );
      await gameRef.update(vetting);
      await clearMaintenanceErrorsForGame(db, appId, gameId, 'vetting');
      await rebuildMaintenanceAudit(db, appId);
      return { gameId, ...vetting, vettingStats: stats };
    } catch (err) {
      console.error('vetGameDevelopers failed:', err);
      const vettingError = err.message || 'Developer vetting failed';
      await upsertMaintenanceError(db, appId, {
        severity: 'warning',
        source: 'vetting',
        gameId,
        gameName: game.steamStatic?.name || null,
        message: vettingError,
        errorKey: null,
        detail: null,
      });
      await rebuildMaintenanceAudit(db, appId);
      throw new HttpsError('internal', vettingError);
    }
  }
);

exports.syncLibrarySteam = syncLibrarySteam;
exports.syncSteamLibrary = syncSteamLibrary;
exports.syncGfnCatalog = syncGfnCatalog;
exports.syncGfnCatalogScheduled = syncGfnCatalogScheduled;
exports.syncDevSources = syncDevSources;
exports.syncDevSourcesScheduled = syncDevSourcesScheduled;

exports.revetAllGames = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
    cors: true,
  },
  async (request) => {
    assertAllowedUser(request.auth);

    const appId = request.data?.appId || 'default_app';
    const db = getFirestore();
    const gamesSnap = await db.collection(`artifacts/${appId}/public/data/games`).get();
    const games = gamesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const devCache = new Map();
    await ensureMemoryCache(devCache, db, appId);

    const uniqueDevs = new Set();
    const devAppIdMap = {};
    for (const game of games) {
      for (const name of collectVettingNames(game)) {
        uniqueDevs.add(name);
        if (!devAppIdMap[name]) devAppIdMap[name] = [];
        if (!devAppIdMap[name].includes(game.id)) devAppIdMap[name].push(game.id);
      }
    }

    if (uniqueDevs.size > 0) {
      await vetAllDevelopers([...uniqueDevs], {
        db,
        appId,
        memoryCache: devCache,
        devAppIdMap,
        forceRefresh: true,
      });
    }

    let updated = 0;
    let flagged = 0;

    for (const game of games) {
      const vetting = mergeVettingWithUserAcknowledgment(
        game,
        aggregateGameVetting(game, devCache)
      );
      const changed =
        vetting.ruDeveloperAlert !== (game.ruDeveloperAlert === true) ||
        vetting.ruDeveloperExplanation !== String(game.ruDeveloperExplanation || '');

      if (vetting.ruDeveloperAlert) flagged += 1;
      if (!changed) continue;

      updated += 1;
      await db.doc(`artifacts/${appId}/public/data/games/${game.id}`).update(vetting);
    }

    await rebuildMaintenanceAudit(db, appId, {
      lastRevet: {
        at: FieldValue.serverTimestamp(),
        updated,
        errors: 0,
      },
    });

    return {
      gameCount: games.length,
      flagged,
      updated,
      uniqueDevelopers: uniqueDevs.size,
    };
  }
);

exports.clearMaintenanceInfoErrors = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: true,
  },
  async (request) => {
    assertAllowedUser(request.auth);

    const appId = request.data?.appId || DEFAULT_APP_ID;
    const db = getFirestore();

    const cleared = await clearInfoMaintenanceErrors(db, appId);
    await rebuildMaintenanceAudit(db, appId);

    return { cleared };
  }
);

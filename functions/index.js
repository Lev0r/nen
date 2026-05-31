const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { fetchSteamGame } = require('./steam');
const { vetAllDevelopers } = require('./devVetting');
const { aggregateGameVetting } = require('./devBgCheck');
const { enrichNewGameThirdParty } = require('./thirdParty');
const { syncLibrarySteam, syncSteamLibrary } = require('./steamSync');
const { syncGfnCatalog, syncGfnCatalogScheduled } = require('./gfnSync');
const { syncDevSources, syncDevSourcesScheduled } = require('./devSourceSync');

initializeApp();

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

    if (!steamInput) {
      throw new HttpsError('invalid-argument', 'steamInput is required.');
    }

    let game;
    try {
      game = await fetchSteamGame(steamInput);
      game = await enrichNewGameThirdParty(game);
    } catch (err) {
      console.error('Steam scrape failed:', err);
      throw new HttpsError('failed-precondition', err.message || 'Failed to fetch Steam data.');
    }

    const db = getFirestore();
    const gameRef = db.doc(`artifacts/${appId}/public/data/games/${game.id}`);

    const existing = await gameRef.get();
    if (existing.exists) {
      throw new HttpsError('already-exists', 'This game is already in your library.');
    }

    await gameRef.set(game);

    const developers = game.steamStatic?.developers || [];
    const devAppIdMap = {};
    for (const name of developers) {
      const trimmed = String(name || '').trim();
      if (trimmed) devAppIdMap[trimmed] = [game.id];
    }

    try {
      const { stats, memoryCache } = await vetAllDevelopers(developers, {
        db,
        appId,
        devAppIdMap,
      });
      const vetting = aggregateGameVetting(game, memoryCache);
      await gameRef.update({
        ...vetting,
        vettingError: null,
        vettingErrorAt: FieldValue.delete(),
      });
      return { gameId: game.id, ...vetting, vettingStats: stats };
    } catch (err) {
      console.error('Developer vetting failed:', err);
      const vettingError = err.message || 'Developer vetting failed';
      await gameRef.update({
        vettingError,
        vettingErrorAt: FieldValue.serverTimestamp(),
      });
      return {
        gameId: game.id,
        vettingError,
      };
    }
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
    const developers = game.steamStatic?.developers || [];
    const devAppIdMap = {};

    for (const name of developers) {
      const trimmed = String(name || '').trim();
      if (trimmed) devAppIdMap[trimmed] = [game.id];
    }

    try {
      const { stats, memoryCache } = await vetAllDevelopers(developers, {
        db,
        appId,
        devAppIdMap,
        forceRefresh: true,
      });
      const vetting = aggregateGameVetting(game, memoryCache);
      await gameRef.update({
        ...vetting,
        vettingError: null,
        vettingErrorAt: FieldValue.delete(),
      });
      return { gameId, ...vetting, vettingStats: stats };
    } catch (err) {
      console.error('vetGameDevelopers failed:', err);
      const vettingError = err.message || 'Developer vetting failed';
      await gameRef.update({
        vettingError,
        vettingErrorAt: FieldValue.serverTimestamp(),
      });
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

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { fetchSteamGame } = require('./steam');
const { vetAllDevelopers } = require('./gemini');
const { refreshLibraryVersions } = require('./versionRefresh');

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not set — skipping developer vetting.');
      return { gameId: game.id, vettingSkipped: true };
    }

    try {
      const vetting = await vetAllDevelopers(game.developers, apiKey);
      await gameRef.update(vetting);
      return { gameId: game.id, ...vetting };
    } catch (err) {
      console.error('Gemini vetting failed:', err);
      return {
        gameId: game.id,
        vettingError: err.message || 'Developer vetting failed',
      };
    }
  }
);

exports.refreshLibraryVersions = refreshLibraryVersions;

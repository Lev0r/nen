const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { fetchCurrentVersion, fetchPriceAndReviews } = require('./steam');

const GAMES_COLLECTION = 'artifacts/default_app/public/data/games';
const FINISHED_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const STEAM_CALL_DELAY_MS = 300;

const LIBRARY_STATES = [
  'active',
  'replayable',
  'waiting_for_updates',
  'finished',
  'banned',
];

function resolveLibraryState(game) {
  if (game?.libraryState && LIBRARY_STATES.includes(game.libraryState)) {
    return game.libraryState;
  }
  if (game?.abandoned) return 'banned';
  if (game?.finished) return 'finished';
  return 'active';
}

function shouldCheckVersion(game, libraryState) {
  if (libraryState === 'banned') return false;

  if (['active', 'replayable', 'waiting_for_updates'].includes(libraryState)) {
    return true;
  }

  if (libraryState === 'finished') {
    const lastCheck = game.lastVersionCheck;
    if (!lastCheck) return true;

    const lastCheckMs =
      typeof lastCheck.toMillis === 'function'
        ? lastCheck.toMillis()
        : lastCheck._seconds * 1000;

    return Date.now() - lastCheckMs >= FINISHED_CHECK_INTERVAL_MS;
  }

  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshLibraryVersionsHandler() {
  const db = getFirestore();
  const snapshot = await db.collection(GAMES_COLLECTION).get();

  let checked = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const game = doc.data();
    const libraryState = resolveLibraryState(game);

    if (!shouldCheckVersion(game, libraryState)) {
      skipped++;
      continue;
    }

    if (game.developmentStatus === 'tba') {
      skipped++;
      continue;
    }

    const appId = doc.id;

    try {
      if (checked > 0) {
        await sleep(STEAM_CALL_DELAY_MS);
      }

      const currentVersion = await fetchCurrentVersion(appId);
      const priceData = await fetchPriceAndReviews(appId);

      const updates = {
        currentVersion,
        lastVersionCheck: FieldValue.serverTimestamp(),
      };

      if (priceData) {
        updates.price = priceData.price;
        updates.isOnSale = priceData.isOnSale;
        updates.discountPercent = priceData.discountPercent;
        if (priceData.steamReviewPercent != null) {
          updates.steamReviewPercent = priceData.steamReviewPercent;
        }
      }

      const versionAtEntry = game.stateMeta?.versionAtEntry;
      if (versionAtEntry && currentVersion && currentVersion !== versionAtEntry) {
        updates.hasUpdateSinceState = true;
      }

      await doc.ref.update(updates);
      updated++;
      checked++;
    } catch (err) {
      console.error(`Version refresh failed for ${appId}:`, err);
      errors++;
    }
  }

  console.log(
    `refreshLibraryVersions: checked=${checked}, updated=${updated}, skipped=${skipped}, errors=${errors}`
  );
}

const refreshLibraryVersions = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  refreshLibraryVersionsHandler
);

module.exports = { refreshLibraryVersions };

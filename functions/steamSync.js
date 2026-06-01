const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getConfigDocPath } = require('./gfnSync');
const {
  fetchStaticSteamData,
  fetchDynamicSteamData,
  fetchCurrentPlayers,
  computeAvgPlayers7d,
} = require('./steam');
const { applyHltbToStatic, applyItadToDynamic, isActionableSeverity } = require('./thirdParty');
const { getItadApiKey } = require('./itad');
const {
  HLTB_INFO_FIELD_DELETES,
  ITAD_INFO_FIELD_DELETES,
  isStaleInfo,
} = require('./errorStatus');

const DEFAULT_APP_ID = 'default_app';
const STEAM_CALL_DELAY_MS = 300;
const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;
const MAX_PLAYER_SAMPLES = 28;

const LIBRARY_STATES = [
  'active',
  'replayable',
  'waiting_for_updates',
  'finished',
  'banned',
];

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

function gamesCollectionPath(appId = DEFAULT_APP_ID) {
  return `artifacts/${appId}/public/data/games`;
}

function resolveLibraryState(game) {
  if (game?.libraryState && LIBRARY_STATES.includes(game.libraryState)) {
    return game.libraryState;
  }
  if (game?.abandoned) return 'banned';
  if (game?.finished) return 'finished';
  return 'active';
}

function timestampToMs(ts) {
  if (ts == null) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = typeof ts === 'number' ? ts : Date.parse(ts);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function isStale(ts, intervalMs) {
  const ms = timestampToMs(ts);
  if (ms == null) return true;
  return Date.now() - ms >= intervalMs;
}

function lastPlayerSampleMs(game) {
  const samples = game.steamStats?.samples;
  if (Array.isArray(samples) && samples.length > 0) {
    const last = samples[samples.length - 1];
    const ms = timestampToMs(last.at);
    if (ms != null) return ms;
  }
  return timestampToMs(game.steamStats?.syncedAt);
}

function shouldRunPlayerSample(game, libraryState, developmentStatus, force) {
  if (developmentStatus === 'tba') return false;
  if (force) return true;
  if (libraryState === 'finished') {
    const lastMs = lastPlayerSampleMs(game);
    if (lastMs != null && Date.now() - lastMs < MS_24H) return false;
  }
  return true;
}

function shouldRunDynamicSync(game, libraryState, force) {
  if (force) return true;
  const interval = libraryState === 'finished' ? MS_7D : MS_24H;
  return isStale(game.steamDynamic?.syncedAt, interval);
}

function shouldRunStaticSync(developmentStatus, scrapedAt, force) {
  if (force) return true;
  const interval = developmentStatus === 'released' ? MS_7D : MS_24H;
  return isStale(scrapedAt, interval);
}

function shouldRunHltbSync(hltb, force) {
  if (force) return true;
  return isStale(hltb?.syncedAt, MS_7D);
}

function shouldRunItadSync(game, libraryState, force) {
  if (!getItadApiKey()) return false;
  if (force) return true;
  const interval = libraryState === 'finished' ? MS_7D : MS_24H;
  return isStale(game.steamDynamic?.itadSyncedAt, interval);
}

function mergeHasUpdateSinceState(game, currentVersion) {
  const versionAtEntry = game.stateMeta?.versionAtEntry;
  if (versionAtEntry && currentVersion && currentVersion !== versionAtEntry) {
    return true;
  }
  return game.hasUpdateSinceState === true;
}

async function writeSteamLibrarySyncMeta(appId, stats) {
  const db = getFirestore();
  await db.doc(getConfigDocPath(appId)).set(
    {
      steamLibrarySync: {
        syncedAt: FieldValue.serverTimestamp(),
        updated: stats.updated,
        staticSyncs: stats.staticSyncs,
        dynamicSyncs: stats.dynamicSyncs,
        playerSamples: stats.playerSamples,
        hltbSyncs: stats.hltbSyncs,
        hltbErrors: stats.hltbErrors,
        itadSyncs: stats.itadSyncs,
        itadErrors: stats.itadErrors,
        itadConfigured: stats.itadConfigured,
        statusTransitions: stats.statusTransitions,
        skippedBanned: stats.skippedBanned,
        skippedIdle: stats.skippedIdle,
        errors: stats.errors,
      },
      thirdPartyHealth: {
        hltb: {
          lastSyncAt: FieldValue.serverTimestamp(),
          syncs: stats.hltbSyncs,
          errors: stats.hltbErrors,
        },
        itad: {
          lastSyncAt: FieldValue.serverTimestamp(),
          syncs: stats.itadSyncs,
          errors: stats.itadErrors,
          configured: stats.itadConfigured,
        },
      },
    },
    { merge: true }
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHltbInfoPurgeUpdates(hltb, cutoffMs) {
  if (hltb?.status !== 'info') return null;
  const lastMs = timestampToMs(hltb.lastOccurrenceAt ?? hltb.syncedAt);
  if (!isStaleInfo(lastMs, cutoffMs)) return null;

  const updates = {};
  for (const field of HLTB_INFO_FIELD_DELETES) {
    updates[`steamStatic.hltb.${field}`] = FieldValue.delete();
  }
  return updates;
}

function buildItadInfoPurgeUpdates(steamDynamic, cutoffMs) {
  if (steamDynamic?.itadStatus !== 'info') return null;
  const lastMs = timestampToMs(
    steamDynamic.itadLastOccurrenceAt ?? steamDynamic.itadSyncedAt
  );
  if (!isStaleInfo(lastMs, cutoffMs)) return null;

  const updates = {};
  for (const field of ITAD_INFO_FIELD_DELETES) {
    updates[`steamDynamic.${field}`] = FieldValue.delete();
  }
  return updates;
}

async function purgeStaleInfoFields(appId = DEFAULT_APP_ID) {
  const db = getFirestore();
  const snapshot = await db.collection(gamesCollectionPath(appId)).get();
  const cutoffMs = Date.now() - MS_7D;
  let purged = 0;

  for (const doc of snapshot.docs) {
    const game = doc.data();
    const updates = {
      ...buildHltbInfoPurgeUpdates(game.steamStatic?.hltb, cutoffMs),
      ...buildItadInfoPurgeUpdates(game.steamDynamic, cutoffMs),
    };

    if (Object.keys(updates).length === 0) continue;

    try {
      await doc.ref.update(updates);
      purged++;
    } catch (err) {
      console.error(`purgeStaleInfoFields failed for ${doc.id}:`, err);
    }
  }

  if (purged > 0) {
    console.log(`purgeStaleInfoFields: cleared info status on ${purged} game(s)`);
  }

  return purged;
}

async function syncLibrarySteamCore(appId = DEFAULT_APP_ID, { force = false } = {}) {
  const db = getFirestore();
  const snapshot = await db.collection(gamesCollectionPath(appId)).get();

  let gamesWithApiCalls = 0;
  let skippedBanned = 0;
  let skippedIdle = 0;
  let playerSamples = 0;
  let dynamicSyncs = 0;
  let staticSyncs = 0;
  let statusTransitions = 0;
  let hltbSyncs = 0;
  let hltbErrors = 0;
  let itadSyncs = 0;
  let itadErrors = 0;
  let updated = 0;
  let errors = 0;
  const itadConfigured = Boolean(getItadApiKey());

  for (const doc of snapshot.docs) {
    const game = doc.data();
    const libraryState = resolveLibraryState(game);

    if (libraryState === 'banned') {
      skippedBanned++;
      continue;
    }

    const steamAppId = doc.id;
    const developmentStatus = game.steamStatic?.developmentStatus;
    const isTba = developmentStatus === 'tba';
    const runStatic = shouldRunStaticSync(
      developmentStatus,
      game.steamStatic?.scrapedAt,
      force
    );
    const runDynamic = shouldRunDynamicSync(game, libraryState, force);
    const runPlayers = shouldRunPlayerSample(game, libraryState, developmentStatus, force);
    const runHltb = !isTba && shouldRunHltbSync(game.steamStatic?.hltb, force);
    const runItad = !isTba && shouldRunItadSync(game, libraryState, force);

    if (!runStatic && !runDynamic && !runPlayers && !runHltb && !runItad) {
      skippedIdle++;
      continue;
    }

    if (gamesWithApiCalls > 0) {
      await sleep(STEAM_CALL_DELAY_MS);
    }

    try {
      const updates = {};
      let steamStatic = game.steamStatic ? { ...game.steamStatic } : {};
      let steamDynamic = game.steamDynamic ? { ...game.steamDynamic } : {};
      let steamStats = game.steamStats ? { ...game.steamStats } : null;

      if (runStatic) {
        const staticData = await fetchStaticSteamData(steamAppId);
        if (staticData) {
          const previousStatus = steamStatic.developmentStatus;
          steamStatic = { ...steamStatic, ...staticData };
          if (
            previousStatus &&
            staticData.developmentStatus &&
            previousStatus !== staticData.developmentStatus
          ) {
            console.log(
              `syncLibrarySteam: ${steamAppId} developmentStatus ${previousStatus} -> ${staticData.developmentStatus}`
            );
            statusTransitions++;
          }
          updates.steamStatic = steamStatic;
          staticSyncs++;
        }
      }

      const resolvedStatus = steamStatic.developmentStatus || developmentStatus;

      if (runDynamic) {
        const dynamicData = await fetchDynamicSteamData(steamAppId, {
          developmentStatus: resolvedStatus,
        });
        if (dynamicData) {
          steamDynamic = { ...steamDynamic, ...dynamicData };
          updates.steamDynamic = steamDynamic;

          if (mergeHasUpdateSinceState(game, steamDynamic.currentVersion)) {
            updates.hasUpdateSinceState = true;
          }

          dynamicSyncs++;
        }
      }

      if (runPlayers && resolvedStatus !== 'tba') {
        const players = await fetchCurrentPlayers(steamAppId);
        if (players != null) {
          const sampleAt = Timestamp.now();
          const existingSamples = Array.isArray(steamStats?.samples) ? steamStats.samples : [];
          const samples = [...existingSamples, { at: sampleAt, players }].slice(-MAX_PLAYER_SAMPLES);
          const avgPlayers7d = computeAvgPlayers7d(samples);

          steamStats = {
            ...(steamStats || {}),
            currentPlayers: players,
            avgPlayers7d,
            samples,
            syncedAt: FieldValue.serverTimestamp(),
          };
          updates.steamStats = steamStats;
          playerSamples++;
        }
      }

      if (runHltb) {
        await sleep(STEAM_CALL_DELAY_MS);
        const hltbResult = await applyHltbToStatic(steamStatic, { force });
        steamStatic = hltbResult.steamStatic;
        updates.steamStatic = steamStatic;
        if (hltbResult.steamStatic?.hltb?.hltbId && !hltbResult.error) {
          hltbSyncs++;
        } else if (hltbResult.error && isActionableSeverity(hltbResult.severity)) {
          hltbErrors++;
        }
        if (hltbResult.clearThirdPartyError) {
          updates['thirdPartyErrors.hltb'] = FieldValue.delete();
        }
      }

      if (runItad) {
        await sleep(STEAM_CALL_DELAY_MS);
        const itadResult = await applyItadToDynamic(steamAppId, steamDynamic, {
          gameTitle: steamStatic?.name || null,
        });
        steamDynamic = itadResult.steamDynamic;
        updates.steamDynamic = steamDynamic;
        if (itadResult.changed && !itadResult.error) {
          itadSyncs++;
        } else if (itadResult.error && isActionableSeverity(itadResult.severity)) {
          itadErrors++;
        }
        if (itadResult.clearThirdPartyError) {
          updates['thirdPartyErrors.itad'] = FieldValue.delete();
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.lastSyncError = FieldValue.delete();
        updates.lastSyncErrorAt = FieldValue.delete();
        await doc.ref.update(updates);
        updated++;
      }

      gamesWithApiCalls++;
    } catch (err) {
      console.error(`syncLibrarySteam failed for ${steamAppId}:`, err);
      errors++;
      gamesWithApiCalls++;
      try {
        await doc.ref.update({
          lastSyncError: err.message || 'Steam library sync failed',
          lastSyncErrorAt: FieldValue.serverTimestamp(),
        });
      } catch (writeErr) {
        console.error(`syncLibrarySteam: failed to write lastSyncError for ${steamAppId}:`, writeErr);
      }
    }
  }

  const stats = {
    updated,
    playerSamples,
    dynamicSyncs,
    staticSyncs,
    hltbSyncs,
    hltbErrors,
    itadSyncs,
    itadErrors,
    itadConfigured,
    statusTransitions,
    skippedBanned,
    skippedIdle,
    errors,
  };

  console.log(
    `syncLibrarySteam: force=${force}, updated=${updated}, playerSamples=${playerSamples}, dynamicSyncs=${dynamicSyncs}, staticSyncs=${staticSyncs}, hltbSyncs=${hltbSyncs}, hltbErrors=${hltbErrors}, itadSyncs=${itadSyncs}, itadErrors=${itadErrors}, statusTransitions=${statusTransitions}, skippedBanned=${skippedBanned}, skippedIdle=${skippedIdle}, errors=${errors}`
  );

  return stats;
}

async function syncLibrarySteamHandler() {
  await purgeStaleInfoFields(DEFAULT_APP_ID);
  const stats = await syncLibrarySteamCore(DEFAULT_APP_ID, { force: false });
  await writeSteamLibrarySyncMeta(DEFAULT_APP_ID, stats);
}

async function syncSteamLibraryCallable(request) {
  assertAllowedUser(request.auth);

  const appId = request.data?.appId || DEFAULT_APP_ID;

  try {
    const stats = await syncLibrarySteamCore(appId, { force: true });
    await writeSteamLibrarySyncMeta(appId, stats);
    return stats;
  } catch (err) {
    console.error('syncSteamLibrary failed:', err);
    throw new HttpsError('internal', err.message || 'Failed to sync Steam library.');
  }
}

const syncLibrarySteam = onSchedule(
  {
    schedule: 'every 6 hours',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  syncLibrarySteamHandler
);

const syncSteamLibrary = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
    cors: true,
    invoker: 'public',
  },
  syncSteamLibraryCallable
);

module.exports = {
  syncLibrarySteam,
  syncSteamLibrary,
  syncLibrarySteamCore,
  purgeStaleInfoFields,
};

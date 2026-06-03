const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { assertAllowedUser } = require('./lib/auth');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const {
  STEAM_LIBRARY_SYNC_DOC_ID,
  THIRD_PARTY_HEALTH_DOC_ID,
  configDocPath,
} = require('./configPaths');
const { DEFAULT_APP_ID, gamesCollectionPath } = require('./lib/firestorePaths');
const {
  fetchAppDetailsEntry,
  mapStaticFromAppDetails,
  mapPriceData,
  fetchDynamicSteamData,
  fetchCurrentPlayers,
  computeAvgPlayers7d,
} = require('./steam');
const { applyHltbToStatic, applyItadToDynamic, isActionableSeverity } = require('./thirdParty');
const { getItadApiKey } = require('./itad');
const {
  recordSyncOutcomeError,
  purgeStaleInfoMaintenanceErrors,
  rebuildMaintenanceAudit,
  upsertMaintenanceError,
} = require('./maintenanceStore');

const THIRD_PARTY_CALL_DELAY_MS = 300;
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

async function writeSteamLibrarySyncMeta(db, appId, stats) {
  const now = FieldValue.serverTimestamp();

  await db.doc(configDocPath(appId, STEAM_LIBRARY_SYNC_DOC_ID)).set(
    {
      syncedAt: now,
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
    { merge: true }
  );

  await db.doc(configDocPath(appId, THIRD_PARTY_HEALTH_DOC_ID)).set(
    {
      hltb: {
        lastSyncAt: now,
        syncs: stats.hltbSyncs,
        errors: stats.hltbErrors,
      },
      itad: {
        lastSyncAt: now,
        syncs: stats.itadSyncs,
        errors: stats.itadErrors,
        configured: stats.itadConfigured,
      },
    },
    { merge: true }
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function purgeStaleInfoFields(appId = DEFAULT_APP_ID) {
  const db = getFirestore();
  const cutoffMs = Date.now() - MS_7D;
  const purged = await purgeStaleInfoMaintenanceErrors(db, appId, cutoffMs);

  if (purged > 0) {
    console.log(`purgeStaleInfoFields: cleared ${purged} stale info maintenance error(s)`);
  }

  return purged;
}

function getGameSyncEligibility(game, { force = false } = {}) {
  const libraryState = resolveLibraryState(game);
  if (libraryState === 'banned') {
    return { eligible: false, skipReason: 'banned' };
  }

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
    return { eligible: false, skipReason: 'idle' };
  }

  return { eligible: true, skipReason: null };
}

function emptyGameSyncStats() {
  return {
    skipped: false,
    skipReason: null,
    updated: false,
    playerSamples: 0,
    dynamicSyncs: 0,
    staticSyncs: 0,
    statusTransitions: 0,
    hltbSyncs: 0,
    hltbErrors: 0,
    itadSyncs: 0,
    itadErrors: 0,
    errors: 0,
  };
}

async function syncOneGameSteamMetadata(db, appId, doc, { force = false } = {}) {
  const game = doc.data();
  const libraryState = resolveLibraryState(game);
  const steamAppId = doc.id;
  const gameName = game.steamStatic?.name || null;
  const stats = emptyGameSyncStats();

  if (libraryState === 'banned') {
    stats.skipped = true;
    stats.skipReason = 'banned';
    return stats;
  }

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
    stats.skipped = true;
    stats.skipReason = 'idle';
    return stats;
  }

  try {
    const updates = {};
    let steamStatic = game.steamStatic ? { ...game.steamStatic } : {};
    let steamDynamic = game.steamDynamic ? { ...game.steamDynamic } : {};
    let steamStats = game.steamStats ? { ...game.steamStats } : null;

    let appDetails = null;
    if (runStatic || runDynamic) {
      appDetails = await fetchAppDetailsEntry(steamAppId);
    }

    if (runStatic && appDetails) {
      const staticData = mapStaticFromAppDetails(appDetails);
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
          stats.statusTransitions++;
        }
        updates.steamStatic = steamStatic;
        stats.staticSyncs++;
      }
    }

    const resolvedStatus = steamStatic.developmentStatus || developmentStatus;

    if (runDynamic) {
      const dynamicData = await fetchDynamicSteamData(steamAppId, {
        developmentStatus: resolvedStatus,
        appDetails,
      });
      if (dynamicData) {
        steamDynamic = { ...steamDynamic, ...dynamicData };
        updates.steamDynamic = steamDynamic;

        if (mergeHasUpdateSinceState(game, steamDynamic.currentVersion)) {
          updates.hasUpdateSinceState = true;
        }

        stats.dynamicSyncs++;
      }
    } else if (runStatic && appDetails) {
      steamDynamic = {
        ...steamDynamic,
        ...mapPriceData(appDetails),
        syncedAt: FieldValue.serverTimestamp(),
      };
      updates.steamDynamic = steamDynamic;
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
        stats.playerSamples++;
      }
    }

    if (runHltb) {
      await sleep(THIRD_PARTY_CALL_DELAY_MS);
      const hltbResult = await applyHltbToStatic(steamStatic, { force });
      if (hltbResult.changed) {
        steamStatic = hltbResult.steamStatic;
        updates.steamStatic = steamStatic;
      }
      if (hltbResult.steamStatic?.hltb?.hltbId && !hltbResult.error) {
        stats.hltbSyncs++;
      } else if (hltbResult.error && isActionableSeverity(hltbResult.severity)) {
        stats.hltbErrors++;
      }
      await recordSyncOutcomeError(db, appId, hltbResult, {
        gameId: steamAppId,
        gameName: gameName || hltbResult.gameName,
      });
    }

    if (runItad) {
      await sleep(THIRD_PARTY_CALL_DELAY_MS);
      const itadResult = await applyItadToDynamic(steamAppId, steamDynamic, {
        gameTitle: steamStatic?.name || null,
      });
      if (itadResult.changed) {
        steamDynamic = itadResult.steamDynamic;
        updates.steamDynamic = steamDynamic;
      }
      if (itadResult.changed && !itadResult.error) {
        stats.itadSyncs++;
      } else if (itadResult.error && isActionableSeverity(itadResult.severity)) {
        stats.itadErrors++;
      }
      await recordSyncOutcomeError(db, appId, itadResult, {
        gameId: steamAppId,
        gameName: gameName || itadResult.gameName,
      });
    }

    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      stats.updated = true;
    }
  } catch (err) {
    console.error(`syncLibrarySteam failed for ${steamAppId}:`, err);
    stats.errors++;
    try {
      await upsertMaintenanceError(db, appId, {
        severity: 'warning',
        source: 'steam-sync',
        gameId: steamAppId,
        gameName,
        message: err.message || 'Steam library sync failed',
        errorKey: null,
        detail: null,
      });
    } catch (writeErr) {
      console.error(`syncLibrarySteam: failed to record maintenance error for ${steamAppId}:`, writeErr);
    }
  }

  return stats;
}

async function syncLibrarySteamCore(appId = DEFAULT_APP_ID, { force = false } = {}) {
  const db = getFirestore();
  const snapshot = await db.collection(gamesCollectionPath(appId)).get();

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
    const eligibility = getGameSyncEligibility(doc.data(), { force });

    if (!eligibility.eligible) {
      if (eligibility.skipReason === 'banned') {
        skippedBanned++;
      } else if (eligibility.skipReason === 'idle') {
        skippedIdle++;
      }
      continue;
    }

    const gameStats = await syncOneGameSteamMetadata(db, appId, doc, { force });

    playerSamples += gameStats.playerSamples;
    dynamicSyncs += gameStats.dynamicSyncs;
    staticSyncs += gameStats.staticSyncs;
    statusTransitions += gameStats.statusTransitions;
    hltbSyncs += gameStats.hltbSyncs;
    hltbErrors += gameStats.hltbErrors;
    itadSyncs += gameStats.itadSyncs;
    itadErrors += gameStats.itadErrors;
    errors += gameStats.errors;

    if (gameStats.updated) {
      updated++;
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

async function syncSteamLibraryCallable(request) {
  assertAllowedUser(request.auth);

  const appId = request.data?.appId || DEFAULT_APP_ID;
  const db = getFirestore();

  try {
    const stats = await syncLibrarySteamCore(appId, { force: true });
    await writeSteamLibrarySyncMeta(db, appId, stats);
    await rebuildMaintenanceAudit(db, appId);
    return stats;
  } catch (err) {
    console.error('syncSteamLibrary failed:', err);
    throw new HttpsError('internal', err.message || 'Failed to sync Steam library.');
  }
}

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

async function refreshGameFromSteamCallable(request) {
  assertAllowedUser(request.auth);

  const appId = request.data?.appId || DEFAULT_APP_ID;
  const steamAppId = String(request.data?.steamAppId || request.data?.gameId || '').trim();

  if (!steamAppId || !/^\d+$/.test(steamAppId)) {
    throw new HttpsError('invalid-argument', 'steamAppId is required.');
  }

  const db = getFirestore();
  const docRef = db.doc(`${gamesCollectionPath(appId)}/${steamAppId}`);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new HttpsError('not-found', 'Game not found.');
  }

  const eligibility = getGameSyncEligibility(snap.data(), { force: true });
  if (!eligibility.eligible && eligibility.skipReason === 'banned') {
    return {
      steamAppId,
      skipped: true,
      reason: 'banned',
      message: 'Banned games are not synced from Steam.',
    };
  }

  try {
    const stats = await syncOneGameSteamMetadata(db, appId, snap, { force: true });
    await rebuildMaintenanceAudit(db, appId);

    if (stats.errors > 0) {
      throw new HttpsError(
        'internal',
        'Steam refresh failed. See Maintenance for details.'
      );
    }

    return {
      steamAppId,
      skipped: false,
      updated: stats.updated,
      staticSyncs: stats.staticSyncs,
      dynamicSyncs: stats.dynamicSyncs,
      playerSamples: stats.playerSamples,
      hltbSyncs: stats.hltbSyncs,
      hltbErrors: stats.hltbErrors,
      itadSyncs: stats.itadSyncs,
      itadErrors: stats.itadErrors,
      statusTransitions: stats.statusTransitions,
    };
  } catch (err) {
    if (err instanceof HttpsError) {
      throw err;
    }
    console.error(`refreshGameFromSteam failed for ${steamAppId}:`, err);
    throw new HttpsError('internal', err.message || 'Failed to refresh game from Steam.');
  }
}

const refreshGameFromSteam = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '512MiB',
    cors: true,
    invoker: 'public',
  },
  refreshGameFromSteamCallable
);

module.exports = {
  syncSteamLibrary,
  syncLibrarySteamCore,
  syncOneGameSteamMetadata,
  refreshGameFromSteam,
  purgeStaleInfoFields,
  writeSteamLibrarySyncMeta,
};

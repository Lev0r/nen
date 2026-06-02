/**
 * Centralized maintenance errors and audit snapshot (config schema v3).
 */
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { normalizeErrorKey } = require('./errorStatus');
const {
  DEFAULT_APP_ID,
  GFN_CATALOG_DOC_ID,
  STEAM_LIBRARY_SYNC_DOC_ID,
  STEAM_OWNERSHIP_SYNC_DOC_ID,
  STEAM_WISHLIST_CANDIDATES_DOC_ID,
  MAINTENANCE_ERRORS_DOC_ID,
  MAINTENANCE_AUDIT_DOC_ID,
  configDocPath,
} = require('./configPaths');
const { META_DOC_ID } = require('./devSourceStore');

const ERRORS_SCHEMA_VERSION = 1;
const AUDIT_SCHEMA_VERSION = 1;

function buildErrorEntryId(source, gameId, errorKey, message) {
  const key = errorKey || normalizeErrorKey(message);
  return `${source}|${gameId || ''}|${key}`;
}

function listMaintenanceErrors(data) {
  const entries = data?.entries;
  if (!entries || typeof entries !== 'object') return [];
  return Object.entries(entries).map(([entryId, entry]) => ({
    entryId,
    ...entry,
  }));
}

function countErrorsBySeverity(entries) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const entry of entries) {
    const severity = entry?.severity;
    if (severity && counts[severity] != null) {
      counts[severity] += 1;
    }
  }
  return counts;
}

async function upsertMaintenanceError(db, appId, partialEntry) {
  const {
    severity,
    source,
    gameId = null,
    gameName = null,
    message,
    errorKey = null,
    detail = null,
  } = partialEntry;

  const text = String(message || '').trim();
  if (!text || !severity || !source) return null;

  const entryId = buildErrorEntryId(source, gameId, errorKey, text);
  const ref = db.doc(configDocPath(appId, MAINTENANCE_ERRORS_DOC_ID));
  const snap = await ref.get();
  const existing = snap.data()?.entries?.[entryId];

  const now = FieldValue.serverTimestamp();
  const entry = {
    severity,
    source,
    gameId: gameId || null,
    gameName: gameName || null,
    message: text,
    errorKey: errorKey || normalizeErrorKey(text),
    detail: detail ? String(detail) : null,
    count: (existing?.count || 0) + 1,
    firstSeenAt: existing?.firstSeenAt || now,
    lastSeenAt: now,
  };

  await ref.set(
    {
      schemaVersion: ERRORS_SCHEMA_VERSION,
      updatedAt: now,
      entries: {
        [entryId]: entry,
      },
    },
    { merge: true }
  );

  return entryId;
}

async function clearMaintenanceError(db, appId, entryId) {
  if (!entryId) return;
  const ref = db.doc(configDocPath(appId, MAINTENANCE_ERRORS_DOC_ID));
  await ref.set(
    {
      updatedAt: FieldValue.serverTimestamp(),
      entries: {
        [entryId]: FieldValue.delete(),
      },
    },
    { merge: true }
  );
}

async function clearMaintenanceErrorsForGame(db, appId, gameId, source) {
  if (!gameId) return 0;
  const ref = db.doc(configDocPath(appId, MAINTENANCE_ERRORS_DOC_ID));
  const snap = await ref.get();
  const entries = snap.data()?.entries;
  if (!entries) return 0;

  const deletes = {};
  let cleared = 0;

  for (const [entryId, entry] of Object.entries(entries)) {
    if (entry?.gameId !== gameId) continue;
    if (source && entry?.source !== source) continue;
    deletes[entryId] = FieldValue.delete();
    cleared += 1;
  }

  if (cleared === 0) return 0;

  await ref.set(
    {
      updatedAt: FieldValue.serverTimestamp(),
      entries: deletes,
    },
    { merge: true }
  );

  return cleared;
}

async function clearInfoMaintenanceErrors(db, appId) {
  const ref = db.doc(configDocPath(appId, MAINTENANCE_ERRORS_DOC_ID));
  const snap = await ref.get();
  const entries = snap.data()?.entries;
  if (!entries) return 0;

  const deletes = {};
  let cleared = 0;

  for (const [entryId, entry] of Object.entries(entries)) {
    if (entry?.severity !== 'info') continue;
    deletes[entryId] = FieldValue.delete();
    cleared += 1;
  }

  if (cleared === 0) return 0;

  await ref.set(
    {
      updatedAt: FieldValue.serverTimestamp(),
      entries: deletes,
    },
    { merge: true }
  );

  return cleared;
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

async function purgeStaleInfoMaintenanceErrors(db, appId, cutoffMs) {
  const ref = db.doc(configDocPath(appId, MAINTENANCE_ERRORS_DOC_ID));
  const snap = await ref.get();
  const entries = snap.data()?.entries;
  if (!entries) return 0;

  const deletes = {};
  let purged = 0;

  for (const [entryId, entry] of Object.entries(entries)) {
    if (entry?.severity !== 'info') continue;
    const lastMs = timestampToMs(entry.lastSeenAt ?? entry.firstSeenAt);
    if (lastMs == null || lastMs >= cutoffMs) continue;
    deletes[entryId] = FieldValue.delete();
    purged += 1;
  }

  if (purged === 0) return 0;

  await ref.set(
    {
      updatedAt: FieldValue.serverTimestamp(),
      entries: deletes,
    },
    { merge: true }
  );

  return purged;
}

async function recordSyncOutcomeError(db, appId, outcome, { gameId, gameName } = {}) {
  if (!outcome?.source) return null;

  const resolvedGameId = gameId || outcome.gameId || null;
  const resolvedGameName = gameName || outcome.gameName || null;

  if (!outcome.error) {
    if (resolvedGameId) {
      await clearMaintenanceErrorsForGame(db, appId, resolvedGameId, outcome.source);
    }
    return null;
  }

  return upsertMaintenanceError(db, appId, {
    severity: outcome.severity || 'warning',
    source: outcome.source,
    gameId: resolvedGameId,
    gameName: resolvedGameName,
    message: outcome.error,
    errorKey: outcome.errorKey || null,
    detail: outcome.detail || null,
  });
}

function buildDevSourcesAuditSection(meta) {
  if (!meta || meta.schemaVersion !== 2) {
    return {
      syncedAt: null,
      neGraiCount: 0,
      curators: {},
      pendingCurators: [],
    };
  }

  return {
    syncedAt: meta.syncedAt ?? null,
    neGraiCount: meta.neGraiCount ?? 0,
    curators: meta.curators || {},
    pendingCurators: meta.pendingCurators || [],
  };
}

async function rebuildMaintenanceAudit(db, appId = DEFAULT_APP_ID, extra = {}) {
  const [gfnSnap, syncSnap, ownershipSnap, wishlistSnap, metaSnap, errorsSnap, auditSnap] =
    await Promise.all([
      db.doc(configDocPath(appId, GFN_CATALOG_DOC_ID)).get(),
      db.doc(configDocPath(appId, STEAM_LIBRARY_SYNC_DOC_ID)).get(),
      db.doc(configDocPath(appId, STEAM_OWNERSHIP_SYNC_DOC_ID)).get(),
      db.doc(configDocPath(appId, STEAM_WISHLIST_CANDIDATES_DOC_ID)).get(),
      db.doc(configDocPath(appId, META_DOC_ID)).get(),
      db.doc(configDocPath(appId, MAINTENANCE_ERRORS_DOC_ID)).get(),
      db.doc(configDocPath(appId, MAINTENANCE_AUDIT_DOC_ID)).get(),
    ]);

  const gfn = gfnSnap.data() || {};
  const sync = syncSnap.data() || {};
  const ownership = ownershipSnap.data() || {};
  const wishlist = wishlistSnap.data() || {};
  const meta = metaSnap.data() || {};
  const errorEntries = listMaintenanceErrors(errorsSnap.data());
  const prevAudit = auditSnap.data() || {};

  const audit = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    updatedAt: FieldValue.serverTimestamp(),
    metaLoad: {
      syncedAt: sync.syncedAt ?? null,
      updated: sync.updated ?? 0,
      hltbSyncs: sync.hltbSyncs ?? 0,
      hltbErrors: sync.hltbErrors ?? 0,
      itadSyncs: sync.itadSyncs ?? 0,
      itadErrors: sync.itadErrors ?? 0,
      itadConfigured: sync.itadConfigured ?? false,
      staticSyncs: sync.staticSyncs ?? 0,
      dynamicSyncs: sync.dynamicSyncs ?? 0,
      playerSamples: sync.playerSamples ?? 0,
      statusTransitions: sync.statusTransitions ?? 0,
      skippedBanned: sync.skippedBanned ?? 0,
      skippedIdle: sync.skippedIdle ?? 0,
      errors: sync.errors ?? 0,
    },
    gfn: {
      syncedAt: gfn.syncedAt ?? null,
      gameCount: gfn.gameCount ?? 0,
      vpcId: gfn.vpcId ?? null,
    },
    steamOwnership: {
      syncedAt: ownership.syncedAt ?? null,
      user0OwnedCount: ownership.user0OwnedCount ?? 0,
      user1OwnedCount: ownership.user1OwnedCount ?? 0,
      gamesUpdated: ownership.gamesUpdated ?? 0,
      gamesChecked: ownership.gamesChecked ?? 0,
      errors: ownership.errors ?? 0,
    },
    steamWishlist: {
      syncedAt: wishlist.syncedAt ?? null,
      user0WishlistCount: wishlist.user0WishlistCount ?? 0,
      user1WishlistCount: wishlist.user1WishlistCount ?? 0,
      candidateCount: wishlist.candidateCount ?? 0,
      errors: wishlist.errors ?? 0,
    },
    devSources: buildDevSourcesAuditSection(meta),
    errorsSummary: countErrorsBySeverity(errorEntries),
    lastRevet: extra.lastRevet !== undefined ? extra.lastRevet : prevAudit.lastRevet ?? null,
  };

  await db.doc(configDocPath(appId, MAINTENANCE_AUDIT_DOC_ID)).set(audit, { merge: false });
  return audit;
}

module.exports = {
  ERRORS_SCHEMA_VERSION,
  AUDIT_SCHEMA_VERSION,
  buildErrorEntryId,
  listMaintenanceErrors,
  countErrorsBySeverity,
  upsertMaintenanceError,
  clearMaintenanceError,
  clearMaintenanceErrorsForGame,
  clearInfoMaintenanceErrors,
  purgeStaleInfoMaintenanceErrors,
  recordSyncOutcomeError,
  rebuildMaintenanceAudit,
};

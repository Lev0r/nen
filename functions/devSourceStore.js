/**
 * Split Firestore storage for developer vetting sources (schema v2).
 *
 * Paths under artifacts/{appId}/public/data/config/:
 *   dev-sources-meta              — small summary for UI + sync coordination
 *   dev-sources-ne-grai           — NE GRAI publisher name list
 *   dev-sources-curator-{key}     — one doc per Steam curator (flagged/cleared arrays only)
 *   dev-sources-dev-index         — optional curator→developer index (--build-dev-index)
 */
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getCuratorKeys, CURATORS } = require('./curatorRegistry');
const { DEFAULT_APP_ID, configCollectionPath, configDocPath } = require('./configPaths');

const SCHEMA_VERSION = 2;
const META_DOC_ID = 'dev-sources-meta';
const NE_GRAI_DOC_ID = 'dev-sources-ne-grai';
const DEV_INDEX_DOC_ID = 'dev-sources-dev-index';
const CURATOR_DOC_PREFIX = 'dev-sources-curator-';

function curatorDocId(curatorKey) {
  return `${CURATOR_DOC_PREFIX}${curatorKey}`;
}

function stripCuratorForFirestore(state, curatorKey) {
  const curator = CURATORS[curatorKey];
  return {
    curatorKey,
    id: state.id || curator?.id || '',
    label: state.label || curator?.label || curatorKey,
    totalCount: Number(state.totalCount) || 0,
    fetchedCount: Number(state.fetchedCount) || 0,
    complete: Boolean(state.complete),
    lastSyncedAt: state.lastSyncedAt || null,
    flaggedAppIds: [...(state.flaggedAppIds || [])].sort(),
    clearedAppIds: [...(state.clearedAppIds || [])].sort(),
  };
}

function buildMetaFromPayload(payload, progress = {}) {
  /** @type {Record<string, object>} */
  const curators = {};
  for (const key of getCuratorKeys()) {
    const entry = payload.curatorAppIds?.curators?.[key];
    if (!entry) continue;
    curators[key] = {
      id: entry.id,
      label: entry.label,
      totalCount: entry.totalCount ?? 0,
      fetchedCount: entry.fetchedCount ?? 0,
      complete: Boolean(entry.complete),
      flaggedCount: entry.flaggedAppIds?.length ?? 0,
      clearedCount: entry.clearedAppIds?.length ?? 0,
      lastSyncedAt: entry.lastSyncedAt || null,
    };
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    syncedAt: FieldValue.serverTimestamp(),
    neGraiCount: payload.neGrai?.names?.length || 0,
    neGraiUpdatedAt: payload.neGrai?.updatedAt || null,
    neGraiVersion: payload.neGrai?.version || null,
    curators,
    pendingCurators: progress.pending || [],
    skippedCurators: progress.skipped || [],
    updatedCurators: progress.updated || [],
    devIndexCount: payload.curatorDevelopers?.meta?.developerCount || 0,
    devIndexUpdatedAt: payload.curatorDevelopers?.meta?.updatedAt || null,
    note:
      'Only not_recommended + informational app IDs flag RU; recommended = curator clearance after dev check.',
  };
}

async function loadExistingCuratorStates(db, appId) {
  const keys = getCuratorKeys();
  if (keys.length === 0) return {};

  const refs = keys.map((key) => db.doc(configDocPath(appId, curatorDocId(key))));
  const snaps = await db.getAll(...refs);
  /** @type {Record<string, object>} */
  const curators = {};

  snaps.forEach((snap, index) => {
    if (!snap.exists) return;
    const data = snap.data();
    curators[keys[index]] = {
      id: data.id,
      label: data.label,
      totalCount: data.totalCount,
      fetchedCount: data.fetchedCount,
      complete: data.complete,
      lastSyncedAt: data.lastSyncedAt,
      flaggedAppIds: data.flaggedAppIds || [],
      clearedAppIds: data.clearedAppIds || [],
    };
  });

  return curators;
}

async function loadDevSourcesBundle(db, appId = DEFAULT_APP_ID) {
  const metaSnap = await db.doc(configDocPath(appId, META_DOC_ID)).get();
  if (!metaSnap.exists) return null;

  const meta = metaSnap.data();
  if (meta.schemaVersion !== SCHEMA_VERSION) {
    return null;
  }

  const neGraiSnap = await db.doc(configDocPath(appId, NE_GRAI_DOC_ID)).get();
  const curators = await loadExistingCuratorStates(db, appId);
  const devIndexSnap = await db.doc(configDocPath(appId, DEV_INDEX_DOC_ID)).get();

  return {
    meta,
    neGrai: neGraiSnap.exists ? neGraiSnap.data() : null,
    curators,
    devIndex: devIndexSnap.exists ? devIndexSnap.data() : null,
  };
}

async function writeDevSourcesToFirestore(appId, payload) {
  const db = getFirestore();
  const batch = db.batch();
  const progress = payload.curatorSyncProgress || {};

  if (payload.neGrai) {
    batch.set(db.doc(configDocPath(appId, NE_GRAI_DOC_ID)), payload.neGrai, { merge: false });
  }

  if (payload.curatorAppIds?.curators) {
    for (const [key, state] of Object.entries(payload.curatorAppIds.curators)) {
      batch.set(
        db.doc(configDocPath(appId, curatorDocId(key))),
        stripCuratorForFirestore(state, key),
        { merge: false }
      );
    }
  }

  if (payload.curatorDevelopers) {
    batch.set(
      db.doc(configDocPath(appId, DEV_INDEX_DOC_ID)),
      payload.curatorDevelopers,
      { merge: false }
    );
  }

  batch.set(
    db.doc(configDocPath(appId, META_DOC_ID)),
    buildMetaFromPayload(payload, progress),
    { merge: false }
  );

  await batch.commit();
}

module.exports = {
  SCHEMA_VERSION,
  META_DOC_ID,
  NE_GRAI_DOC_ID,
  DEV_INDEX_DOC_ID,
  CURATOR_DOC_PREFIX,
  configCollectionPath,
  configDocPath,
  curatorDocId,
  stripCuratorForFirestore,
  buildMetaFromPayload,
  loadExistingCuratorStates,
  loadDevSourcesBundle,
  writeDevSourcesToFirestore,
};

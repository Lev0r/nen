const { FieldValue } = require('firebase-admin/firestore');
const { steamAppMetaCollectionPath } = require('./lib/firestorePaths');
const { fetchAppDetailsForMeta } = require('./steam');

const APP_META_TTL_MS = 180 * 24 * 60 * 60 * 1000;

/** @type {Map<string, { meta: object, expiresAt: number }>} */
const l1Cache = new Map();

function l1Key(appId, steamAppId) {
  return `${appId}:${String(steamAppId)}`;
}

function steamAppMetaDocPath(appId, steamAppId) {
  return `${steamAppMetaCollectionPath(appId)}/${String(steamAppId)}`;
}

function normalizeMeta(meta, steamAppId) {
  const now = Date.now();
  const fetchedAt = meta.fetchedAt ?? now;
  return {
    appId: Number(meta.appId ?? steamAppId),
    name: meta.name ?? null,
    storeType: meta.storeType ?? null,
    hasCoop: meta.hasCoop === true,
    fetchedAt,
    expiresAt: meta.expiresAt ?? fetchedAt + APP_META_TTL_MS,
  };
}

function withCacheStats(meta, cacheHit, cacheMiss) {
  return { ...meta, cacheHit, cacheMiss };
}

async function putSteamAppMeta(db, appId, steamAppId, meta) {
  const normalized = normalizeMeta(meta, steamAppId);
  const docRef = db.doc(steamAppMetaDocPath(appId, steamAppId));

  await docRef.set(
    {
      ...normalized,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  l1Cache.set(l1Key(appId, steamAppId), {
    meta: normalized,
    expiresAt: normalized.expiresAt,
  });

  return normalized;
}

async function getSteamAppMeta(db, appId, steamAppId, { forceRefresh = false } = {}) {
  const sid = String(steamAppId);
  const now = Date.now();

  if (!forceRefresh) {
    const l1Entry = l1Cache.get(l1Key(appId, sid));
    if (l1Entry && l1Entry.expiresAt > now) {
      return withCacheStats(l1Entry.meta, true, false);
    }

    const snapshot = await db.doc(steamAppMetaDocPath(appId, sid)).get();
    if (snapshot.exists) {
      const data = normalizeMeta(snapshot.data(), sid);
      if (data.expiresAt > now) {
        l1Cache.set(l1Key(appId, sid), { meta: data, expiresAt: data.expiresAt });
        return withCacheStats(data, true, false);
      }
    }
  }

  const fetched = await fetchAppDetailsForMeta(sid);
  if (!fetched) {
    return null;
  }

  const meta = normalizeMeta(
    {
      appId: Number(sid),
      name: fetched.name,
      storeType: fetched.storeType,
      hasCoop: fetched.hasCoop,
      fetchedAt: now,
      expiresAt: now + APP_META_TTL_MS,
    },
    sid
  );

  await putSteamAppMeta(db, appId, sid, meta);
  return withCacheStats(meta, false, true);
}

async function purgeExpiredAppMeta(db, appId) {
  const now = Date.now();
  const collectionRef = db.collection(steamAppMetaCollectionPath(appId));
  const snapshot = await collectionRef.where('expiresAt', '<', now).get();

  if (snapshot.empty) {
    return { deleted: 0 };
  }

  let deleted = 0;
  const batchSize = 500;
  let batch = db.batch();

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    deleted += 1;

    if (deleted % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (deleted % batchSize !== 0) {
    await batch.commit();
  }

  return { deleted };
}

module.exports = {
  APP_META_TTL_MS,
  getSteamAppMeta,
  putSteamAppMeta,
  purgeExpiredAppMeta,
};

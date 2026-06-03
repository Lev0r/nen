const { getFirestore } = require('firebase-admin/firestore');
const { syncLibrarySteamCore, purgeStaleInfoFields, writeSteamLibrarySyncMeta } = require('../steamSync');
const { syncSteamOwnershipCore } = require('../steamOwnershipSync');
const { syncSteamWishlistsCore } = require('../steamWishlistSync');
const { syncGfnCatalogToFirestore } = require('../gfnSync');
const { syncDevSourcesToFirestore } = require('../devSourceSync');
const { rebuildMaintenanceAudit } = require('../maintenanceStore');
const { purgeExpiredAppMeta } = require('../steamAppMetaCache');

const MS_6H = 6 * 60 * 60 * 1000;
const MS_24H = 24 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;

function resolveTimestampMs(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return null;
}

const TASK_REGISTRY = [
  {
    id: 'libraryMetadata',
    intervalMs: MS_6H,
    async run(appId, _taskState, context) {
      const db = context.db || getFirestore();
      await purgeStaleInfoFields(appId);
      const stats = await syncLibrarySteamCore(appId, { force: false });
      await writeSteamLibrarySyncMeta(db, appId, stats);
      await rebuildMaintenanceAudit(db, appId);
      return stats;
    },
  },
  {
    id: 'steamOwnership',
    intervalMs: MS_24H,
    async run(appId) {
      return syncSteamOwnershipCore(appId);
    },
  },
  {
    id: 'steamWishlist',
    intervalMs: MS_24H,
    async run(appId) {
      return syncSteamWishlistsCore(appId, { autoImport: true });
    },
  },
  {
    id: 'gfnCatalog',
    intervalMs: MS_7D,
    async run(appId) {
      return syncGfnCatalogToFirestore(appId);
    },
  },
  {
    id: 'devSources',
    intervalMs: MS_7D,
    async run(appId) {
      return syncDevSourcesToFirestore(appId);
    },
  },
  {
    id: 'cachePurge',
    intervalMs: MS_7D,
    async run(appId, _taskState, context) {
      const db = context.db || getFirestore();
      return purgeExpiredAppMeta(db, appId);
    },
  },
];

function isTaskDue(taskId, state, now = Date.now()) {
  const task = TASK_REGISTRY.find((entry) => entry.id === taskId);
  if (!task) return false;

  const taskState = state?.tasks?.[taskId];
  const lastCompleteAt = resolveTimestampMs(taskState?.lastCompleteAt);
  if (lastCompleteAt == null) return true;

  return now - lastCompleteAt >= task.intervalMs;
}

async function runTask(taskId, appId, state, context = {}) {
  const task = TASK_REGISTRY.find((entry) => entry.id === taskId);
  if (!task) {
    throw new Error(`Unknown scheduler task: ${taskId}`);
  }

  const taskState = state?.tasks?.[taskId] || {};
  const ctx = {
    db: context.db || getFirestore(),
    now: context.now ?? Date.now(),
    ...context,
  };

  return task.run(appId, taskState, ctx);
}

module.exports = {
  TASK_REGISTRY,
  isTaskDue,
  runTask,
};

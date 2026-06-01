#!/usr/bin/env node
/**
 * Clear maintenance errors doc and legacy error fields on game documents.
 *
 * Usage:
 *   node scripts/wipe-maintenance-errors.mjs [--dry-run] [--app-id default_app]
 *
 * Clears:
 *   config/maintenance-errors (all entries)
 *   Per game: HLTB/ITAD status fields, vettingError, lastSyncError, thirdPartyErrors
 *
 * Resets steam-library-sync hltbErrors/itadErrors counters to 0.
 */
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(join(ROOT, 'functions/package.json'));

const { initializeApp, getApps, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
  DEFAULT_APP_ID,
  STEAM_LIBRARY_SYNC_DOC_ID,
  MAINTENANCE_ERRORS_DOC_ID,
  configDocPath,
} = require('./configPaths');
const { rebuildMaintenanceAudit } = require('./maintenanceStore');

const HLTB_ERROR_FIELDS = [
  'status',
  'infoMessage',
  'lastError',
  'errorKey',
  'occurrenceCount',
  'lastOccurrenceAt',
  'detail',
];

const ITAD_ERROR_FIELDS = [
  'itadStatus',
  'itadInfoMessage',
  'itadLastError',
  'itadErrorKey',
  'itadOccurrenceCount',
  'itadLastOccurrenceAt',
  'itadDetail',
];

const ROOT_ERROR_FIELDS = [
  'vettingError',
  'vettingErrorAt',
  'lastSyncError',
  'lastSyncErrorAt',
  'thirdPartyErrors',
];

function parseArgs(argv) {
  let appId = DEFAULT_APP_ID;
  let dryRun = false;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--app-id') appId = argv[++i];
    else if (arg.startsWith('--app-id=')) appId = arg.slice('--app-id='.length);
  }
  return { appId, dryRun };
}

function resolveFirebaseProjectId() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  try {
    const rc = JSON.parse(readFileSync(join(ROOT, '.firebaserc'), 'utf8'));
    if (rc.projects?.default) return rc.projects.default;
    const values = Object.values(rc.projects || {});
    if (values.length === 1) return values[0];
  } catch {
    // ignore
  }
  try {
    const out = execSync('firebase use', { cwd: ROOT, encoding: 'utf8' }).trim();
    const activeMatch = out.match(/Active Project:\s*(\S+)/i);
    if (activeMatch) return activeMatch[1];
  } catch {
    // ignore
  }
  return null;
}

function initFirebase() {
  if (getApps().length > 0) return;
  const projectId = resolveFirebaseProjectId();
  if (!projectId) {
    throw new Error('Could not resolve Firebase project ID. Run firebase use <project>.');
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credential = keyPath
    ? cert(JSON.parse(readFileSync(keyPath, 'utf8')))
    : applicationDefault();
  initializeApp({ projectId, credential });
}

function gameHasMaintenanceErrors(game) {
  const hltb = game.steamStatic?.hltb;
  if (hltb) {
    for (const field of HLTB_ERROR_FIELDS) {
      if (hltb[field] != null && hltb[field] !== '') return true;
    }
  }

  const dynamic = game.steamDynamic;
  if (dynamic) {
    for (const field of ITAD_ERROR_FIELDS) {
      if (dynamic[field] != null && dynamic[field] !== '') return true;
    }
  }

  for (const field of ROOT_ERROR_FIELDS) {
    if (game[field] != null && game[field] !== '') return true;
  }

  return false;
}

function buildGameErrorClearUpdates() {
  const updates = {};
  for (const field of HLTB_ERROR_FIELDS) {
    updates[`steamStatic.hltb.${field}`] = FieldValue.delete();
  }
  for (const field of ITAD_ERROR_FIELDS) {
    updates[`steamDynamic.${field}`] = FieldValue.delete();
  }
  for (const field of ROOT_ERROR_FIELDS) {
    updates[field] = FieldValue.delete();
  }
  return updates;
}

async function main() {
  const { appId, dryRun } = parseArgs(process.argv);
  initFirebase();
  const db = getFirestore();
  const gamesPath = `artifacts/${appId}/public/data/games`;
  const snapshot = await db.collection(gamesPath).get();

  const clearUpdates = buildGameErrorClearUpdates();
  let gamesCleared = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const game = doc.data();
    if (!gameHasMaintenanceErrors(game)) continue;

    gamesCleared += 1;
    if (dryRun) continue;

    batch.update(doc.ref, clearUpdates);
    batchCount += 1;

    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }

  const syncRef = db.doc(configDocPath(appId, STEAM_LIBRARY_SYNC_DOC_ID));
  const syncSnap = await syncRef.get();
  const sync = syncSnap.data();
  let syncUpdated = false;

  if (sync && (sync.hltbErrors > 0 || sync.itadErrors > 0)) {
    syncUpdated = true;
    if (!dryRun) {
      await syncRef.set(
        {
          hltbErrors: 0,
          itadErrors: 0,
        },
        { merge: true }
      );
    }
  }

  const errorsRef = db.doc(configDocPath(appId, MAINTENANCE_ERRORS_DOC_ID));
  const errorsSnap = await errorsRef.get();
  const hasErrorsDoc = errorsSnap.exists && Object.keys(errorsSnap.data()?.entries || {}).length > 0;

  if (hasErrorsDoc && !dryRun) {
    await errorsRef.set(
      {
        schemaVersion: 1,
        updatedAt: FieldValue.serverTimestamp(),
        entries: {},
      },
      { merge: false }
    );
  }

  if (!dryRun) {
    await rebuildMaintenanceAudit(db, appId);
  }

  console.log(
    dryRun
      ? `[dry-run] Would clear legacy errors on ${gamesCleared} game(s)` +
          (hasErrorsDoc ? '; wipe config/maintenance-errors' : '') +
          (syncUpdated ? '; reset sync error counters on config/steam-library-sync' : '')
      : `Cleared legacy errors on ${gamesCleared} game(s)` +
          (hasErrorsDoc ? '; wiped config/maintenance-errors' : '') +
          (syncUpdated ? '; reset sync error counters on config/steam-library-sync' : '')
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

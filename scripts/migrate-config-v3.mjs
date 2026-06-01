#!/usr/bin/env node
/**
 * Migrate Firestore config schema v2 (config/default monolith) → v3 split docs.
 *
 * Usage:
 *   node scripts/migrate-config-v3.mjs [--dry-run] [--app-id default_app]
 *
 * Creates:
 *   config/dev-bg-check, gfn-catalog, steam-library-sync, third-party-health,
 *   maintenance-errors, maintenance-audit
 *
 * Scans games for legacy error fields and upserts maintenance-errors entries.
 * Does not delete config/default (deprecated; safe to remove manually after verify).
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
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const {
  DEFAULT_APP_ID,
  DEV_BG_CHECK_DOC_ID,
  GFN_CATALOG_DOC_ID,
  STEAM_LIBRARY_SYNC_DOC_ID,
  THIRD_PARTY_HEALTH_DOC_ID,
  MAINTENANCE_ERRORS_DOC_ID,
  configDocPath,
} = require('./configPaths');
const {
  buildErrorEntryId,
  rebuildMaintenanceAudit,
  ERRORS_SCHEMA_VERSION,
} = require('./maintenanceStore');
const { normalizeErrorKey } = require('./errorStatus');

const LEGACY_CONFIG_DOC_ID = 'default';

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

function timestampFrom(value) {
  if (!value) return Timestamp.now();
  if (typeof value.toDate === 'function') return value;
  if (typeof value._seconds === 'number') {
    return new Timestamp(value._seconds, value._nanoseconds || 0);
  }
  const parsed = Date.parse(String(value));
  if (!Number.isNaN(parsed)) return Timestamp.fromMillis(parsed);
  return Timestamp.now();
}

function collectHltbEntry(gameId, game) {
  const hltb = game.steamStatic?.hltb;
  if (!hltb) return null;

  const gameName = game.steamStatic?.name || null;
  const at = hltb.lastOccurrenceAt ?? hltb.syncedAt ?? null;

  if (hltb.status === 'info' && hltb.infoMessage) {
    return {
      severity: 'info',
      source: 'hltb',
      gameId,
      gameName,
      message: hltb.infoMessage,
      errorKey: hltb.errorKey || normalizeErrorKey(hltb.infoMessage),
      detail: hltb.detail ?? null,
      count: hltb.occurrenceCount || 1,
      at,
    };
  }

  if ((hltb.status === 'warning' || hltb.status === 'error') && hltb.lastError) {
    return {
      severity: hltb.status,
      source: 'hltb',
      gameId,
      gameName,
      message: hltb.lastError,
      errorKey: hltb.errorKey || normalizeErrorKey(hltb.lastError),
      detail: hltb.detail ?? null,
      count: hltb.occurrenceCount || 1,
      at,
    };
  }

  if (hltb.lastError) {
    return {
      severity: 'warning',
      source: 'hltb',
      gameId,
      gameName,
      message: hltb.lastError,
      errorKey: hltb.errorKey || normalizeErrorKey(hltb.lastError),
      detail: hltb.detail ?? null,
      count: hltb.occurrenceCount || 1,
      at,
    };
  }

  return null;
}

function collectItadEntry(gameId, game) {
  const dynamic = game.steamDynamic;
  if (!dynamic) return null;

  const gameName = game.steamStatic?.name || null;
  const at = dynamic.itadLastOccurrenceAt ?? dynamic.itadSyncedAt ?? null;

  if (dynamic.itadStatus === 'info' && dynamic.itadInfoMessage) {
    return {
      severity: 'info',
      source: 'itad',
      gameId,
      gameName,
      message: dynamic.itadInfoMessage,
      errorKey: dynamic.itadErrorKey || normalizeErrorKey(dynamic.itadInfoMessage),
      detail: dynamic.itadDetail ?? null,
      count: dynamic.itadOccurrenceCount || 1,
      at,
    };
  }

  if (
    (dynamic.itadStatus === 'warning' || dynamic.itadStatus === 'error') &&
    dynamic.itadLastError
  ) {
    return {
      severity: dynamic.itadStatus,
      source: 'itad',
      gameId,
      gameName,
      message: dynamic.itadLastError,
      errorKey: dynamic.itadErrorKey || normalizeErrorKey(dynamic.itadLastError),
      detail: dynamic.itadDetail ?? null,
      count: dynamic.itadOccurrenceCount || 1,
      at,
    };
  }

  if (dynamic.itadLastError) {
    return {
      severity: 'warning',
      source: 'itad',
      gameId,
      gameName,
      message: dynamic.itadLastError,
      errorKey: dynamic.itadErrorKey || normalizeErrorKey(dynamic.itadLastError),
      detail: dynamic.itadDetail ?? null,
      count: dynamic.itadOccurrenceCount || 1,
      at,
    };
  }

  return null;
}

function collectGameMaintenanceEntries(gameId, game) {
  const entries = [];
  const push = (entry) => {
    if (entry?.message) entries.push(entry);
  };

  push(collectHltbEntry(gameId, game));
  push(collectItadEntry(gameId, game));

  const thirdParty = game.thirdPartyErrors;
  const gameName = game.steamStatic?.name || null;
  if (thirdParty?.hltb && !entries.some((e) => e.source === 'hltb')) {
    push({
      severity: 'warning',
      source: 'hltb',
      gameId,
      gameName,
      message: thirdParty.hltb,
      errorKey: normalizeErrorKey(thirdParty.hltb),
      detail: null,
      count: 1,
      at: game.steamStatic?.hltb?.syncedAt ?? null,
    });
  }
  if (thirdParty?.itad && !entries.some((e) => e.source === 'itad')) {
    push({
      severity: 'warning',
      source: 'itad',
      gameId,
      gameName,
      message: thirdParty.itad,
      errorKey: normalizeErrorKey(thirdParty.itad),
      detail: null,
      count: 1,
      at: game.steamDynamic?.itadSyncedAt ?? null,
    });
  }

  if (game.vettingError) {
    push({
      severity: 'warning',
      source: 'vetting',
      gameId,
      gameName,
      message: game.vettingError,
      errorKey: normalizeErrorKey(game.vettingError),
      detail: null,
      count: 1,
      at: game.vettingErrorAt ?? null,
    });
  }

  if (game.lastSyncError) {
    push({
      severity: 'warning',
      source: 'steam-sync',
      gameId,
      gameName,
      message: game.lastSyncError,
      errorKey: normalizeErrorKey(game.lastSyncError),
      detail: null,
      count: 1,
      at: game.lastSyncErrorAt ?? null,
    });
  }

  return entries;
}

function buildMaintenanceErrorsFromGames(games) {
  const entries = {};

  for (const { id, data } of games) {
    for (const partial of collectGameMaintenanceEntries(id, data)) {
      const entryId = buildErrorEntryId(
        partial.source,
        partial.gameId,
        partial.errorKey,
        partial.message
      );
      const ts = timestampFrom(partial.at);
      entries[entryId] = {
        severity: partial.severity,
        source: partial.source,
        gameId: partial.gameId,
        gameName: partial.gameName,
        message: partial.message,
        errorKey: partial.errorKey,
        detail: partial.detail,
        count: partial.count,
        firstSeenAt: ts,
        lastSeenAt: ts,
      };
    }
  }

  return entries;
}

async function main() {
  const { appId, dryRun } = parseArgs(process.argv);
  initFirebase();
  const db = getFirestore();

  const legacyRef = db.doc(`artifacts/${appId}/public/data/config/${LEGACY_CONFIG_DOC_ID}`);
  const legacySnap = await legacyRef.get();
  const legacy = legacySnap.exists ? legacySnap.data() : {};

  const writes = [];

  if (legacy.devBgCheck?.developers) {
    writes.push({
      docId: DEV_BG_CHECK_DOC_ID,
      data: { developers: legacy.devBgCheck.developers },
    });
  }

  if (legacy.gfnCatalog) {
    writes.push({
      docId: GFN_CATALOG_DOC_ID,
      data: {
        steamAppIds: legacy.gfnCatalog.steamAppIds || [],
        syncedAt: legacy.gfnCatalog.syncedAt ?? FieldValue.serverTimestamp(),
        vpcId: legacy.gfnCatalog.vpcId ?? null,
        gameCount: legacy.gfnCatalog.gameCount ?? (legacy.gfnCatalog.steamAppIds?.length || 0),
      },
    });
  }

  if (legacy.steamLibrarySync) {
    writes.push({
      docId: STEAM_LIBRARY_SYNC_DOC_ID,
      data: { ...legacy.steamLibrarySync },
    });
  }

  if (legacy.thirdPartyHealth) {
    writes.push({
      docId: THIRD_PARTY_HEALTH_DOC_ID,
      data: { ...legacy.thirdPartyHealth },
    });
  }

  const gamesSnap = await db.collection(`artifacts/${appId}/public/data/games`).get();
  const games = gamesSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  const errorEntries = buildMaintenanceErrorsFromGames(games);

  writes.push({
    docId: MAINTENANCE_ERRORS_DOC_ID,
    data: {
      schemaVersion: ERRORS_SCHEMA_VERSION,
      updatedAt: FieldValue.serverTimestamp(),
      entries: errorEntries,
    },
  });

  console.log(
    dryRun
      ? `[dry-run] Would write ${writes.length} config doc(s); ${Object.keys(errorEntries).length} maintenance error entries from ${games.length} game(s)`
      : `Writing ${writes.length} config doc(s); ${Object.keys(errorEntries).length} maintenance error entries from ${games.length} game(s)`
  );

  for (const { docId, data } of writes) {
    console.log(`  → config/${docId}`);
    if (!dryRun) {
      await db.doc(configDocPath(appId, docId)).set(data, { merge: docId === MAINTENANCE_ERRORS_DOC_ID });
    }
  }

  if (!dryRun) {
    await rebuildMaintenanceAudit(db, appId);
    console.log('Rebuilt config/maintenance-audit');
  } else {
    console.log('[dry-run] Would rebuild config/maintenance-audit');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

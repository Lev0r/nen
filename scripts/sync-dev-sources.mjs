#!/usr/bin/env node
/**
 * Sync developer vetting source data (NE GRAI + Steam curators).
 *
 * Local JSON export (optional dev fallback):
 *   npm run sync-dev-sources
 *   node scripts/sync-dev-sources.mjs [--skip-curators] [--curators-only]
 *   node scripts/sync-dev-sources.mjs --build-dev-index [--curator-delay-ms 800]
 *
 * Seed Firestore directly (split config docs — schema v2):
 *   node scripts/sync-dev-sources.mjs --to-firestore [--app-id default_app]
 *   node scripts/sync-dev-sources.mjs --to-firestore --build-dev-index
 *
 * Flags:
 *   --to-firestore       Write to devBgCheck.sources via Firebase Admin (not local JSON)
 *   --full               Force full re-download (reserved for incremental sync in 5b)
 *   --skip-curators      Skip Steam curator lists
 *   --curators-only      Skip NE GRAI; sync curators only
 *   --build-dev-index    Resolve developer names for flagged curator apps (slow)
 *   --curator-delay-ms N Delay between Steam appdetails calls (default 800)
 *   --app-id ID          Firestore app id (default: default_app; only with --to-firestore)
 *
 * Firebase Admin auth for --to-firestore (pick one):
 *   1. GOOGLE_APPLICATION_CREDENTIALS → service account JSON path
 *   2. gcloud auth application-default login + firebase use <project>
 *
 * Weekly Cloud Function sync (Firestore, after deploy):
 *   syncDevSourcesScheduled — every 168 hours
 */
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'functions/data');
const require = createRequire(join(ROOT, 'functions/package.json'));

const { initializeApp, getApps, applicationDefault, cert } = require('firebase-admin/app');
const {
  syncDevSourcesToFiles,
  syncDevSourcesToFirestore,
} = require('./devSourceSync');
const { getCuratorKeys } = require('./curatorRegistry');

function parseArgs(argv) {
  const args = {
    skipCurators: false,
    curatorsOnly: false,
    buildDevIndex: false,
    curatorDelayMs: 800,
    toFirestore: false,
    full: false,
    appId: 'default_app',
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--skip-curators') args.skipCurators = true;
    if (argv[i] === '--curators-only') args.curatorsOnly = true;
    if (argv[i] === '--build-dev-index') args.buildDevIndex = true;
    if (argv[i] === '--to-firestore') args.toFirestore = true;
    if (argv[i] === '--full') args.full = true;
    if (argv[i] === '--curator-delay-ms') {
      args.curatorDelayMs = Number(argv[i + 1]) || 800;
      i += 1;
    }
    if (argv[i] === '--app-id') {
      args.appId = argv[i + 1] || args.appId;
      i += 1;
    }
  }
  return args;
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
    const usingMatch = out.match(/Now using project\s+(\S+)/i);
    if (usingMatch) return usingMatch[1];
  } catch {
    // ignore
  }

  return null;
}

function credentialHelp(projectId) {
  return (
    'Firebase Admin credentials not found.\n\n' +
    'Option A — service account key:\n' +
    '  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\key.json"\n\n' +
    'Option B — Google Cloud SDK:\n' +
    `  gcloud auth application-default login --project ${projectId || 'nen-tracker'}\n\n` +
    'Also run: firebase use nen-tracker'
  );
}

function loadAdminCredential() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    if (!existsSync(keyPath)) {
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS file not found: ${keyPath}`);
    }
    return cert(JSON.parse(readFileSync(keyPath, 'utf8')));
  }
  return applicationDefault();
}

function initFirebase() {
  if (getApps().length > 0) return;

  const projectId = resolveFirebaseProjectId();
  if (!projectId) {
    throw new Error(
      'Could not resolve Firebase project ID. Run `firebase use nen-tracker` or set GCLOUD_PROJECT.'
    );
  }

  try {
    initializeApp({
      projectId,
      credential: loadAdminCredential(),
    });
  } catch (err) {
    const message = err?.message || String(err);
    if (/credential|authentication/i.test(message)) {
      throw new Error(`${credentialHelp(projectId)}\n\nOriginal error: ${message}`);
    }
    throw err;
  }
}

function formatStats(stats) {
  const curatorParts = getCuratorKeys().map(
    (key) => `${key} flagged ${stats[`${key}FlaggedCount`] || 0}`
  );
  let line = `NE GRAI: ${stats.neGraiCount} names | ${curatorParts.join(' | ')}`;
  if (stats.devIndexCount) {
    line += ` | dev index: ${stats.devIndexCount}`;
  }
  return line;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const syncOptions = {
    skipNeGrai: args.curatorsOnly,
    skipCurators: args.skipCurators,
    buildDevIndex: args.buildDevIndex,
    curatorDelayMs: args.curatorDelayMs,
    full: args.full,
  };

  if (args.toFirestore) {
    initFirebase();
    console.log(
      `Syncing to Firestore (appId=${args.appId})${args.full ? ' [full]' : ''}…`
    );
    const stats = await syncDevSourcesToFirestore(args.appId, syncOptions);
    console.log(`Wrote dev-sources-* docs to Firestore (${args.appId}, schema v2)`);
    console.log(formatStats(stats));
    return;
  }

  if (args.curatorsOnly) {
    console.log('Syncing curator app IDs only…');
  } else {
    console.log('Syncing NE GRAI list + curator app IDs…');
  }

  const stats = await syncDevSourcesToFiles(syncOptions, DATA_DIR);

  console.log(`Wrote JSON under ${stats.dataDir}`);
  console.log(formatStats(stats));

  if (!args.buildDevIndex && !args.skipCurators) {
    console.log(
      'Tip: dev name index is optional (--build-dev-index). App-ID lookup works without it.'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Remove legacy dev source blob from config/default (devBgCheck.sources).
 * Optionally delete v2 split docs before a fresh --to-firestore seed.
 *
 * Usage:
 *   node scripts/wipe-legacy-dev-sources.mjs [--app-id default_app] [--include-v2-docs]
 *
 * Default: deletes only devBgCheck.sources on config/default (legacy monolithic blob).
 * With --include-v2-docs: also deletes dev-sources-* config documents.
 *
 * Does NOT touch devBgCheck.developers (vetting cache) or game documents.
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
const { getConfigDocPath } = require('./devBgCheck');
const {
  META_DOC_ID,
  NE_GRAI_DOC_ID,
  DEV_INDEX_DOC_ID,
  curatorDocId,
} = require('./devSourceStore');
const { getCuratorKeys } = require('./curatorRegistry');

function parseArgs(argv) {
  let appId = 'default_app';
  let includeV2 = false;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--include-v2-docs') includeV2 = true;
    else if (arg === '--app-id') appId = argv[++i];
    else if (arg.startsWith('--app-id=')) appId = arg.slice('--app-id='.length);
  }
  return { appId, includeV2 };
}

function resolveFirebaseProjectId() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  try {
    const rc = JSON.parse(readFileSync(join(ROOT, '.firebaserc'), 'utf8'));
    if (rc.projects?.default) return rc.projects.default;
    if (rc.projects?.staging) return rc.projects.staging;
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

async function deleteV2Docs(db, appId) {
  const base = `artifacts/${appId}/public/data/config`;
  const ids = [META_DOC_ID, NE_GRAI_DOC_ID, DEV_INDEX_DOC_ID, ...getCuratorKeys().map(curatorDocId)];
  const batch = db.batch();
  for (const id of ids) {
    batch.delete(db.doc(`${base}/${id}`));
  }
  await batch.commit();
  console.log(`Deleted ${ids.length} dev-sources-* config document(s)`);
}

async function main() {
  const { appId, includeV2 } = parseArgs(process.argv);
  initFirebase();
  const db = getFirestore();

  await db.doc(getConfigDocPath(appId)).set(
    { devBgCheck: { sources: FieldValue.delete() } },
    { merge: true }
  );
  console.log('Deleted devBgCheck.sources from config/default');

  if (includeV2) {
    await deleteV2Docs(db, appId);
  }

  console.log('Done. Re-seed with: node scripts/sync-dev-sources.mjs --to-firestore --full');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

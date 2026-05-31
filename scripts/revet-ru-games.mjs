#!/usr/bin/env node
/**
 * Re-apply RU developer vetting to all games already in Firestore.
 *
 * Usage:
 *   node scripts/revet-ru-games.mjs [--dry-run] [--app-id default_app]
 *
 * Use after import if RU flags were missing (e.g. only active games were vetted).
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
const { getFirestore } = require('firebase-admin/firestore');
const { vetAllDevelopers } = require('./devVetting');
const {
  ensureMemoryCache,
  aggregateGameVetting,
  collectUncachedDevelopers,
} = require('./devBgCheck');

function parseArgs(argv) {
  let appId = 'default_app';
  let dryRun = false;

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--app-id') appId = argv[++i];
    else if (arg.startsWith('--app-id=')) appId = arg.slice('--app-id='.length);
  }

  return { appId, dryRun };
}

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
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
  if (getApps().length > 0) return getFirestore();
  const projectId = resolveFirebaseProjectId();
  if (!projectId) {
    throw new Error('Could not resolve Firebase project ID.');
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credential = keyPath && existsSync(keyPath)
    ? cert(JSON.parse(readFileSync(keyPath, 'utf8')))
    : applicationDefault();
  initializeApp({ projectId, credential });
  return getFirestore();
}

function gamesCollection(appId) {
  return `artifacts/${appId}/public/data/games`;
}

async function main() {
  const { appId, dryRun } = parseArgs(process.argv);
  loadDotEnvFile(join(ROOT, 'functions/.env'));

  const db = initFirebase();
  const snap = await db.collection(gamesCollection(appId)).get();
  const games = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  console.log(`Re-vet RU flags for ${games.length} game(s) in ${gamesCollection(appId)}`);
  if (dryRun) console.log('DRY-RUN — no Firestore writes');

  const devCache = new Map();
  await ensureMemoryCache(devCache, db, appId);

  const uniqueDevs = new Set();
  const devAppIdMap = {};
  for (const game of games) {
    for (const name of game.steamStatic?.developers || []) {
      const trimmed = String(name || '').trim();
      if (!trimmed) continue;
      uniqueDevs.add(trimmed);
      if (!devAppIdMap[trimmed]) devAppIdMap[trimmed] = [];
      if (!devAppIdMap[trimmed].includes(game.id)) devAppIdMap[trimmed].push(game.id);
    }
  }

  const uncached = collectUncachedDevelopers([...uniqueDevs], devCache);
  console.log(
    `Developer cache: ${uniqueDevs.size} unique, ${uniqueDevs.size - uncached.length} cached, ${uncached.length} to resolve`
  );

  if (uniqueDevs.size > 0) {
    await vetAllDevelopers([...uniqueDevs], {
      db: dryRun ? null : db,
      appId,
      memoryCache: devCache,
      dryRun,
      devAppIdMap,
      forceRefresh: true,
    });
  }

  let updated = 0;
  let flagged = 0;

  for (const game of games) {
    const vetting = aggregateGameVetting(game, devCache);
    const changed =
      vetting.ruDeveloperAlert !== (game.ruDeveloperAlert === true) ||
      vetting.ruDeveloperExplanation !== String(game.ruDeveloperExplanation || '');

    if (vetting.ruDeveloperAlert) flagged += 1;

    if (!changed) continue;

    updated += 1;
    const label = game.steamStatic?.name || game.id;
    console.log(
      `  ${game.id} ${label}: ruDeveloperAlert=${vetting.ruDeveloperAlert}` +
        (vetting.ruDeveloperAlert ? ` — ${vetting.ruDeveloperExplanation.slice(0, 80)}…` : '')
    );

    if (!dryRun) {
      await db.doc(`${gamesCollection(appId)}/${game.id}`).update(vetting);
    }
  }

  console.log(`\nDone: ${flagged} flagged, ${updated} document(s) ${dryRun ? 'would be ' : ''}updated`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

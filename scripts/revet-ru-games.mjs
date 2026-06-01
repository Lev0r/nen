#!/usr/bin/env node
/**
 * Re-apply RU developer vetting to all games already in Firestore.
 *
 * Usage:
 *   node scripts/revet-ru-games.mjs [--dry-run] [--app-id default_app] [--verbose]
 *
 * Use after dev sources are seeded to Firestore (config/dev-sources-*).
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
  explainGameVetting,
  formatVettingTraceLine,
  collectUncachedDevelopers,
} = require('./devBgCheck');
const { loadDevSourcesBundle } = require('./devSourceStore');
const {
  ensureLiveDevSources,
  getSourceMetadata,
  resetDevSourcesCache,
} = require('./devSources');

function parseArgs(argv) {
  let appId = 'default_app';
  let dryRun = false;
  let verbose = false;

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--verbose') verbose = true;
    else if (arg === '--app-id') appId = argv[++i];
    else if (arg.startsWith('--app-id=')) appId = arg.slice('--app-id='.length);
  }

  return { appId, dryRun, verbose };
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

function printSourceSummary(meta) {
  const curatorParts = Object.entries(meta.curators?.byCurator || {}).map(
    ([key, entry]) => `${key} flagged ${entry.flaggedCount ?? 0}`
  );
  console.log(
    `Dev sources loaded: NE GRAI ${meta.neGrai?.count ?? 0} names` +
      (curatorParts.length ? ` | ${curatorParts.join(' | ')}` : '')
  );
}

async function main() {
  const { appId, dryRun, verbose } = parseArgs(process.argv);
  loadDotEnvFile(join(ROOT, 'functions/.env'));

  const db = initFirebase();
  const bundle = await loadDevSourcesBundle(db, appId);
  if (!bundle) {
    console.error(
      'No dev-sources-* docs in Firestore.\n' +
        'Seed first: npm run sync-dev-sources:firestore:full'
    );
    process.exit(1);
  }

  resetDevSourcesCache();
  await ensureLiveDevSources(db, appId);
  const sourceMeta = getSourceMetadata();
  printSourceSummary(sourceMeta);

  if ((sourceMeta.neGrai?.count ?? 0) === 0) {
    console.error(
      'NE GRAI list is empty after load — aborting.\n' +
        'Re-run: npm run sync-dev-sources:firestore:full'
    );
    process.exit(1);
  }

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
      db,
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
    const explained = explainGameVetting(game, devCache);
    const vetting = {
      ruDeveloperAlert: explained.ruDeveloperAlert,
      ruDeveloperExplanation: explained.ruDeveloperExplanation,
    };
    const wasAlert = game.ruDeveloperAlert === true;
    const changed =
      vetting.ruDeveloperAlert !== wasAlert ||
      vetting.ruDeveloperExplanation !== String(game.ruDeveloperExplanation || '');

    if (vetting.ruDeveloperAlert) flagged += 1;

    if (!changed && !verbose) continue;

    const label = game.steamStatic?.name || game.id;

    if (!changed) {
      console.log(`  ${game.id} ${label}: unchanged ruDeveloperAlert=${vetting.ruDeveloperAlert}`);
      for (const entry of explained.trace) {
        console.log(formatVettingTraceLine(entry));
      }
      continue;
    }

    updated += 1;
    const transition =
      wasAlert === vetting.ruDeveloperAlert
        ? 'explanation changed'
        : `${wasAlert} → ${vetting.ruDeveloperAlert}`;
    console.log(`  ${game.id} ${label}: ruDeveloperAlert ${transition}`);
    for (const entry of explained.trace) {
      console.log(formatVettingTraceLine(entry));
    }

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

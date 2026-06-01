#!/usr/bin/env node
/**
 * One-time bulk import of Steam games into Firestore (no UI).
 *
 * Usage:
 *   node scripts/import-games.mjs path/to/games.json [--dry-run] [--app-id default_app]
 *
 * JSON root: array of entries in either format below.
 *
 * Canonical format — strings or objects with `steamInput` plus optional overrides
 * (`libraryState`, `owned`, `userNotes`, `hypeTier`, `finishedRating`, etc.).
 *
 * Legacy friend-export format — objects with `Game link` (auto-detected):
 *   `Game link` → steamInput
 *   `{VITE_USER0_NICKNAME} owned` → owned.user0 (fallback key: "Lev0r owned")
 *   `{VITE_USER1_NICKNAME} owned` → owned.user1 (fallback key: "Punpun owned")
 *   `Game status` → libraryState (Active, Finished, Waiting-for-updates, replayable, banned)
 *   `Comment` → stateMeta.note (optional; commonly used on banned entries)
 *
 * Nicknames are read from `.env.local` and `functions/.env` (VITE_USER0_NICKNAME /
 * VITE_USER1_NICKNAME).
 *
 * Firebase Admin auth (pick one):
 *   1. Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file path, or
 *   2. Run `firebase login` + `firebase use <project>` (Application Default Credentials).
 *      Project ID is read from the active Firebase CLI project or `.firebaserc`.
 *
 * Developer vetting uses bundled NE GRAI + Steam curator source lists.
 * Results are cached in config/dev-bg-check `developers` (shared with
 * addGameFromSteam). Bulk import pre-vets all unique developers once.
 *
 * Do not run against production without reviewing the JSON and using --dry-run first.
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(join(ROOT, 'functions/package.json'));

const { initializeApp, getApps, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { fetchSteamGame, parseAppId } = require('./steam');
const { vetAllDevelopers } = require('./devVetting');
const { collectVettingNames } = require('./devSources');
const {
  ensureMemoryCache,
  aggregateGameVetting,
  collectUncachedDevelopers,
} = require('./devBgCheck');

const LIBRARY_STATES = new Set([
  'active',
  'replayable',
  'waiting_for_updates',
  'finished',
  'banned',
]);

const OVERRIDE_KEYS = new Set([
  'libraryState',
  'owned',
  'userNotes',
  'hypeTier',
  'finishedRating',
  'stateMeta',
  'ruDeveloperAlert',
  'ruDeveloperExplanation',
]);

const STEAM_IMPORT_DELAY_MS = 450;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let jsonPath = null;
  let dryRun = false;
  let appId = 'default_app';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--app-id') {
      appId = args[i + 1];
      if (!appId) throw new Error('--app-id requires a value');
      i += 1;
    } else if (arg.startsWith('--app-id=')) {
      appId = arg.slice('--app-id='.length);
      if (!appId) throw new Error('--app-id requires a value');
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else if (!jsonPath) {
      jsonPath = arg;
    } else if (!appId || appId === 'default_app') {
      // npm/PowerShell sometimes drops `--app-id` and passes only the value.
      appId = arg;
    } else {
      throw new Error(
        `Unexpected argument: ${arg}\n` +
          'Usage: node scripts/import-games.mjs "path/to/games.json" [--dry-run] [--app-id default_app]\n' +
          'Tip (PowerShell): quote the JSON path; --app-id is optional (defaults to default_app).'
      );
    }
  }

  if (!jsonPath) {
    throw new Error(
      'Usage: node scripts/import-games.mjs "path/to/games.json" [--dry-run] [--app-id default_app]'
    );
  }

  return { jsonPath: resolve(jsonPath), dryRun, appId };
}

function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
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
    if (!(key in process.env)) {
      process.env[key] = value;
    }
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
    const usingMatch = out.match(/Now using project\s+(\S+)/i);
    if (usingMatch) return usingMatch[1];
  } catch {
    // ignore
  }

  return null;
}

function credentialHelp(projectId) {
  return (
    'Firebase Admin credentials not found for the import script.\n\n' +
    '`firebase login` alone does NOT authorize Node.js Admin SDK scripts.\n\n' +
    'Option A — service account key (recommended):\n' +
    '  1. Firebase Console → Project settings → Service accounts → Generate new private key\n' +
    '  2. PowerShell:\n' +
    '     $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\path\\to\\nen-tracker-key.json"\n' +
    '     node scripts/import-games.mjs "docs/all games.json" --dry-run\n\n' +
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
  if (getApps().length > 0) {
    return getFirestore();
  }

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

  return getFirestore();
}

async function assertFirebaseAccess(db) {
  try {
    await db.collection('_import_probe').limit(1).get();
  } catch (err) {
    const message = err?.message || String(err);
    if (/credential|authentication|Could not load the default credentials/i.test(message)) {
      throw new Error(`${credentialHelp(resolveFirebaseProjectId())}\n\nOriginal error: ${message}`);
    }
    throw err;
  }
}

function normalizeFinishedRating(value) {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return n;
  return null;
}

function resolveLegacyOwnershipKeys() {
  const user0Nickname = process.env.VITE_USER0_NICKNAME?.trim();
  const user1Nickname = process.env.VITE_USER1_NICKNAME?.trim();
  return {
    user0Key: user0Nickname ? `${user0Nickname} owned` : 'Lev0r owned',
    user1Key: user1Nickname ? `${user1Nickname} owned` : 'Punpun owned',
  };
}

const LEGACY_LIBRARY_STATE_MAP = {
  active: 'active',
  finished: 'finished',
  'waiting-for-updates': 'waiting_for_updates',
  replayable: 'replayable',
  banned: 'banned',
};

function normalizeLegacyLibraryState(status) {
  const normalized = String(status ?? 'Active').trim().toLowerCase();
  const libraryState = LEGACY_LIBRARY_STATE_MAP[normalized];
  if (!libraryState) {
    throw new Error(`Unknown legacy Game status: ${status}`);
  }
  return libraryState;
}

function isLegacyEntry(entry) {
  return entry && typeof entry === 'object' && !Array.isArray(entry) && 'Game link' in entry;
}

function convertLegacyEntry(entry, ownershipKeys) {
  const steamInput = entry['Game link'];
  if (!steamInput) {
    throw new Error('legacy entry missing Game link');
  }

  const overrides = {};
  const owned = {};

  if (ownershipKeys.user0Key in entry) {
    owned.user0 = Boolean(entry[ownershipKeys.user0Key]);
  }
  if (ownershipKeys.user1Key in entry) {
    owned.user1 = Boolean(entry[ownershipKeys.user1Key]);
  }
  if (Object.keys(owned).length > 0) {
    overrides.owned = owned;
  }

  if (entry['Game status'] != null && String(entry['Game status']).trim() !== '') {
    overrides.libraryState = normalizeLegacyLibraryState(entry['Game status']);
  }

  const comment = entry.Comment ?? entry.comment;
  if (comment != null && String(comment).trim() !== '') {
    overrides.stateMeta = { note: String(comment).trim() };
  }

  return { steamInput: String(steamInput), overrides };
}

function normalizeEntry(entry, index, ownershipKeys) {
  if (typeof entry === 'string') {
    return { steamInput: entry, overrides: {} };
  }
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    if (isLegacyEntry(entry)) {
      try {
        return convertLegacyEntry(entry, ownershipKeys);
      } catch (err) {
        throw new Error(`Entry ${index}: ${err.message}`);
      }
    }
    const { steamInput, ...rest } = entry;
    if (!steamInput) {
      throw new Error(`Entry ${index}: object must include steamInput`);
    }
    return { steamInput: String(steamInput), overrides: rest };
  }
  throw new Error(`Entry ${index}: expected string or object`);
}

function applyOverrides(game, overrides) {
  const merged = { ...game };

  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'steamInput') continue;
    if (!OVERRIDE_KEYS.has(key)) {
      console.warn(`  Warning: ignoring unknown override "${key}"`);
      continue;
    }
    if (key === 'owned' || key === 'userNotes' || key === 'hypeTier') {
      merged[key] = { ...game[key], ...value };
    } else if (key === 'stateMeta') {
      merged.stateMeta = { ...game.stateMeta, ...value };
    } else {
      merged[key] = value;
    }
  }

  const targetState = merged.libraryState ?? 'active';
  if (!LIBRARY_STATES.has(targetState)) {
    throw new Error(`Invalid libraryState: ${targetState}`);
  }
  merged.libraryState = targetState;

  if (targetState !== 'active') {
    merged.hasUpdateSinceState = false;
    merged.stateMeta = {
      versionAtEntry: game.steamDynamic?.currentVersion ?? null,
      note: String(overrides.stateMeta?.note ?? merged.stateMeta?.note ?? '').trim(),
      enteredAt: FieldValue.serverTimestamp(),
    };
    merged.finishedRating =
      targetState === 'finished'
        ? normalizeFinishedRating(overrides.finishedRating ?? merged.finishedRating)
        : null;
  } else if (overrides.finishedRating != null) {
    merged.finishedRating = normalizeFinishedRating(overrides.finishedRating);
  }

  return merged;
}

function gameDocPath(appId, gameId) {
  return `artifacts/${appId}/public/data/games/${gameId}`;
}

async function prepareGame(db, entry, { appId }) {
  const { steamInput, overrides } = entry;
  const parsedId = parseAppId(steamInput);
  const gameRef = db.doc(gameDocPath(appId, parsedId));

  const existing = await gameRef.get();
  if (existing.exists) {
    return { status: 'duplicate', parsedId, steamInput };
  }

  const scraped = await fetchSteamGame(steamInput);
  const game = applyOverrides(scraped, overrides);

  return { status: 'ready', game, steamInput };
}

async function importOne(db, prepared, { appId, dryRun, devCache }) {
  if (prepared.status === 'duplicate') {
    console.log(`  SKIP duplicate: ${prepared.parsedId} (${prepared.steamInput})`);
    return { status: 'duplicate' };
  }

  const { game } = prepared;

  if (dryRun) {
    const vetting = aggregateGameVetting(game, devCache);
    console.log(
      `  DRY-RUN would import: ${game.id} "${game.steamStatic?.name || game.id}" libraryState=${game.libraryState}` +
        (vetting.ruDeveloperAlert ? ' (RU alert)' : '')
    );
    return { status: 'imported' };
  }

  const vetting = aggregateGameVetting(game, devCache);
  await db.doc(gameDocPath(appId, game.id)).set({ ...game, ...vetting });
  console.log(
    `  Imported: ${game.id} "${game.steamStatic?.name || game.id}" libraryState=${game.libraryState}`
  );

  if (vetting.ruDeveloperAlert) {
    console.log(`  RU developer alert — ${vetting.ruDeveloperExplanation}`);
  }

  return { status: 'imported' };
}

function buildDevAppIdMap(preparedGames) {
  const map = {};
  for (const { prepared } of preparedGames) {
    if (prepared.status !== 'ready') continue;
    const steamAppId = prepared.game.id;
    for (const name of collectVettingNames(prepared.game)) {
      if (!map[name]) map[name] = [];
      if (!map[name].includes(steamAppId)) map[name].push(steamAppId);
    }
  }
  return map;
}

async function main() {
  const { jsonPath, dryRun, appId } = parseArgs(process.argv);

  loadDotEnvFile(join(ROOT, '.env.local'));
  loadDotEnvFile(join(ROOT, 'functions/.env'));
  const ownershipKeys = resolveLegacyOwnershipKeys();

  const raw = readFileSync(jsonPath, 'utf8');
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) {
    throw new Error('JSON root must be an array');
  }

  const db = initFirebase();
  await assertFirebaseAccess(db);
  const devCache = new Map();
  await ensureMemoryCache(devCache, db, appId);

  console.log(`Import ${entries.length} entries → artifacts/${appId}/public/data/games/`);
  if (dryRun) console.log('DRY-RUN mode — no Firestore writes');

  const summary = { imported: 0, duplicates: 0, errors: 0, prepareErrors: 0 };

  // Phase 1: normalize + scrape all entries
  const preparedGames = [];
  for (let i = 0; i < entries.length; i += 1) {
    let normalized;
    try {
      normalized = normalizeEntry(entries[i], i, ownershipKeys);
    } catch (err) {
      summary.prepareErrors += 1;
      console.error(`[${i + 1}/${entries.length}] ${err.message}`);
      continue;
    }

    console.log(`[${i + 1}/${entries.length}] ${normalized.steamInput}`);
    try {
      if (i > 0) {
        await sleep(STEAM_IMPORT_DELAY_MS);
      }
      const prepared = await prepareGame(db, normalized, { appId });
      preparedGames.push({ index: i + 1, prepared });
    } catch (err) {
      summary.prepareErrors += 1;
      console.error(`  ERROR: ${err.message}`);
    }
  }

  // Phase 2: pre-vet unique developers across all imported games (cache + bundled sources)
  const uniqueDevs = new Set();
  for (const { prepared } of preparedGames) {
    if (prepared.status !== 'ready') continue;
    for (const name of prepared.game.steamStatic?.developers || []) {
      const trimmed = String(name || '').trim();
      if (trimmed) uniqueDevs.add(trimmed);
    }
  }

  const uncachedBefore = collectUncachedDevelopers([...uniqueDevs], devCache);
  const cacheHitsBefore = uniqueDevs.size - uncachedBefore.length;

  console.log(
    `\nDeveloper vetting: ${uniqueDevs.size} unique across active games` +
      ` (${cacheHitsBefore} cached, ${uncachedBefore.length} to resolve)`
  );

  const devAppIdMap = buildDevAppIdMap(preparedGames);

  if (uniqueDevs.size > 0) {
    try {
      const { stats } = await vetAllDevelopers([...uniqueDevs], {
        db: dryRun ? null : db,
        appId,
        memoryCache: devCache,
        dryRun,
        devAppIdMap,
      });
      console.log(
        `Vetting complete: ${stats.cacheHits} cache hits, ` +
          `${stats.sourceHits} source list hit(s), ${stats.bundledClears} cleared (not in sources)`
      );
    } catch (err) {
      console.error(`Developer pre-vetting failed: ${err.message}`);
    }
  }

  // Phase 3: write games with vetting from cache
  console.log('\nWriting games...');
  for (const { index, prepared } of preparedGames) {
    try {
      const result = await importOne(db, prepared, { appId, dryRun, devCache });
      if (result.status === 'duplicate') summary.duplicates += 1;
      else summary.imported += 1;
    } catch (err) {
      summary.errors += 1;
      console.error(`[${index}] ERROR: ${err.message}`);
    }
  }

  summary.errors += summary.prepareErrors;

  console.log('\n--- Summary ---');
  console.log(`Imported:   ${summary.imported}`);
  console.log(`Duplicates: ${summary.duplicates}`);
  console.log(`Errors:     ${summary.errors}`);
  if (dryRun) console.log('(dry-run — nothing was written)');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

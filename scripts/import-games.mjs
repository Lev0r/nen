#!/usr/bin/env node
/**
 * One-time bulk import of Steam games into Firestore (no UI).
 *
 * Usage:
 *   node scripts/import-games.mjs path/to/games.json [--dry-run] [--app-id default_app]
 *
 * JSON: array of Steam URLs / App IDs (strings) or objects with `steamInput` plus optional
 * overrides (`libraryState`, `owned`, `userNotes`, `hypeTier`, `finishedRating`, etc.).
 *
 * Firebase Admin auth (pick one):
 *   1. Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file path, or
 *   2. Run `firebase login` + `firebase use <project>` (Application Default Credentials).
 *      Project ID is read from the active Firebase CLI project or `.firebaserc`.
 *
 * Gemini: loads GEMINI_API_KEY from functions/.env (if present) or process.env.
 * RU developer vetting runs only when the final saved libraryState is `active`.
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

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { fetchSteamGame, parseAppId } = require('./steam');
const { vetAllDevelopers } = require('./gemini');

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
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else if (!jsonPath) {
      jsonPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!jsonPath) {
    throw new Error(
      'Usage: node scripts/import-games.mjs path/to/games.json [--dry-run] [--app-id default_app]'
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

function initFirebase() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const projectId = resolveFirebaseProjectId();
  const options = projectId ? { projectId } : {};
  initializeApp(options);
  return getFirestore();
}

function normalizeFinishedRating(value) {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return n;
  return null;
}

function normalizeEntry(entry, index) {
  if (typeof entry === 'string') {
    return { steamInput: entry, overrides: {} };
  }
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
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
      versionAtEntry: game.currentVersion ?? null,
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

async function importOne(db, entry, { appId, dryRun, geminiApiKey }) {
  const { steamInput, overrides } = entry;
  const parsedId = parseAppId(steamInput);
  const gameRef = db.doc(gameDocPath(appId, parsedId));

  const existing = await gameRef.get();
  if (existing.exists) {
    console.log(`  SKIP duplicate: ${parsedId} (${steamInput})`);
    return { status: 'duplicate' };
  }

  const scraped = await fetchSteamGame(steamInput);
  const game = applyOverrides(scraped, overrides);
  const shouldVet = game.libraryState === 'active';

  if (dryRun) {
    console.log(
      `  DRY-RUN would import: ${game.id} "${game.name}" libraryState=${game.libraryState}` +
        (shouldVet ? ' (Gemini vetting)' : ' (no vetting)')
    );
    return { status: 'imported' };
  }

  await gameRef.set(game);
  console.log(`  Imported: ${game.id} "${game.name}" libraryState=${game.libraryState}`);

  if (!shouldVet) {
    console.log('  Skipped Gemini vetting (libraryState is not active)');
    return { status: 'imported' };
  }

  if (!geminiApiKey) {
    console.warn('  GEMINI_API_KEY not set — skipping developer vetting');
    return { status: 'imported' };
  }

  try {
    const vetting = await vetAllDevelopers(game.developers, geminiApiKey);
    await gameRef.update(vetting);
    if (vetting.ruDeveloperAlert) {
      console.log(`  Gemini: RU developer alert — ${vetting.ruDeveloperExplanation}`);
    } else {
      console.log('  Gemini: no RU developer flags');
    }
  } catch (err) {
    console.error(`  Gemini vetting failed: ${err.message}`);
    return { status: 'imported', vettingError: err.message };
  }

  return { status: 'imported' };
}

async function main() {
  const { jsonPath, dryRun, appId } = parseArgs(process.argv);

  loadDotEnvFile(join(ROOT, 'functions/.env'));
  const geminiApiKey = process.env.GEMINI_API_KEY || null;

  const raw = readFileSync(jsonPath, 'utf8');
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) {
    throw new Error('JSON root must be an array');
  }

  const db = initFirebase();

  console.log(`Import ${entries.length} entries → artifacts/${appId}/public/data/games/`);
  if (dryRun) console.log('DRY-RUN mode — no Firestore writes');

  const summary = { imported: 0, duplicates: 0, errors: 0 };

  for (let i = 0; i < entries.length; i += 1) {
    let normalized;
    try {
      normalized = normalizeEntry(entries[i], i);
    } catch (err) {
      summary.errors += 1;
      console.error(`[${i + 1}/${entries.length}] ${err.message}`);
      continue;
    }

    console.log(`[${i + 1}/${entries.length}] ${normalized.steamInput}`);
    try {
      const result = await importOne(db, normalized, { appId, dryRun, geminiApiKey });
      if (result.status === 'duplicate') summary.duplicates += 1;
      else summary.imported += 1;
    } catch (err) {
      summary.errors += 1;
      console.error(`  ERROR: ${err.message}`);
    }
  }

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

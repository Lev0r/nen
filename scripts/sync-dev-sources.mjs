#!/usr/bin/env node
/**
 * Sync developer vetting source data to local JSON files under functions/data/.
 *
 * Usage:
 *   npm run sync-dev-sources
 *   node scripts/sync-dev-sources.mjs [--skip-curators] [--curators-only]
 *   node scripts/sync-dev-sources.mjs --build-dev-index [--curator-delay-ms 800]
 *
 * Weekly Cloud Function sync (Firestore, no redeploy needed):
 *   syncDevSourcesScheduled — every 168 hours after firebase deploy
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'functions/data');
const require = createRequire(join(ROOT, 'functions/package.json'));
const { syncDevSourcesToFiles } = require('./devSourceSync');

function parseArgs(argv) {
  const args = {
    skipCurators: false,
    curatorsOnly: false,
    buildDevIndex: false,
    curatorDelayMs: 800,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--skip-curators') args.skipCurators = true;
    if (argv[i] === '--curators-only') args.curatorsOnly = true;
    if (argv[i] === '--build-dev-index') args.buildDevIndex = true;
    if (argv[i] === '--curator-delay-ms') {
      args.curatorDelayMs = Number(argv[i + 1]) || 800;
      i += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.curatorsOnly) {
    console.log('Syncing curator app IDs only…');
  } else {
    console.log('Syncing NE GRAI list + curator app IDs…');
  }

  const stats = await syncDevSourcesToFiles(
    {
      skipNeGrai: args.curatorsOnly,
      skipCurators: args.skipCurators,
      buildDevIndex: args.buildDevIndex,
      curatorDelayMs: args.curatorDelayMs,
    },
    DATA_DIR
  );

  console.log(`Wrote JSON under ${stats.dataDir}`);
  console.log(
    `NE GRAI: ${stats.neGraiCount} names | PlayUA flagged: ${stats.playuaFlaggedCount} | Avoid RU flagged: ${stats.avoidRuFlaggedCount}, cleared: ${stats.avoidRuClearedCount}` +
      (stats.devIndexCount ? ` | dev index: ${stats.devIndexCount}` : '')
  );

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

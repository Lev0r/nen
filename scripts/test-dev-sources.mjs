#!/usr/bin/env node
/** Quick smoke test for devSources lookups (loads local JSON if present). */
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'functions/data');
const require = createRequire(join(__dirname, '../functions/package.json'));
const {
  lookupNeGrai,
  lookupCurators,
  lookupCuratorsByAppId,
  lookupDeterministicSources,
  getSourceMetadata,
  applyDevSourcesPayload,
  resetDevSourcesCache,
} = require('./devSources');

function loadLocalPayload() {
  const payload = {};
  const neGraiPath = join(DATA_DIR, 'ne-grai-russian-publishers.json');
  const appIdsPath = join(DATA_DIR, 'curator-flagged-appids.json');
  const devsPath = join(DATA_DIR, 'curator-flagged-developers.json');

  if (existsSync(neGraiPath)) {
    payload.neGrai = JSON.parse(readFileSync(neGraiPath, 'utf8'));
  }
  if (existsSync(appIdsPath)) {
    const raw = JSON.parse(readFileSync(appIdsPath, 'utf8'));
    /** @type {Record<string, object>} */
    const curators = {};
    for (const [key, entry] of Object.entries(raw.curators || {})) {
      if (entry.flaggedAppIds || entry.clearedAppIds) {
        curators[key] = entry;
        continue;
      }
      const flagged = [];
      const cleared = [];
      for (const [appId, recType] of Object.entries(entry.apps || {})) {
        if (recType === 'not_recommended' || recType === 'informational') flagged.push(appId);
        else if (recType === 'recommended') cleared.push(appId);
      }
      curators[key] = {
        ...entry,
        flaggedAppIds: flagged.sort(),
        clearedAppIds: cleared.sort(),
      };
    }
    payload.curatorAppIds = { curators, meta: raw.meta || {} };
  }
  if (existsSync(devsPath)) {
    payload.curatorDevelopers = JSON.parse(readFileSync(devsPath, 'utf8'));
  }
  return payload;
}

const samples = [
  { name: 'Gaijin Entertainment', appIds: [] },
  { name: 'Mundfish', appIds: [] },
  { name: 'CD Projekt RED', appIds: [] },
  { name: 'Unknown Studio XYZ', appIds: ['668580'] }, // Atomic Heart — PlayUA + Avoid RU not recommended
  { name: 'Unknown Studio XYZ', appIds: ['1643320'] }, // S.T.A.L.K.E.R. 2 — Avoid RU recommended (cleared)
  { name: 'Unknown Studio XYZ', appIds: ['4595550'] }, // Avoid RU recommended (cleared)
];

async function main() {
  resetDevSourcesCache();
  const payload = loadLocalPayload();
  if (Object.keys(payload).length) {
    applyDevSourcesPayload(payload);
    console.log('Loaded local JSON from functions/data/');
  } else {
    console.warn('No local JSON in functions/data/ — run npm run sync-dev-sources first');
  }

  console.log('Source metadata:', getSourceMetadata());
  for (const { name, appIds } of samples) {
    const ne = lookupNeGrai(name);
    const cu = lookupCurators(name, { appIds });
    const det = lookupDeterministicSources(name, { appIds });
    console.log('\n---', name, appIds.length ? `(apps: ${appIds.join(',')})` : '---');
    console.log('NE GRAI:', ne?.explanation || 'not listed');
    console.log('Curators:', cu?.explanation || 'not listed');
    console.log('Deterministic:', det?.explanation || 'cleared (not in sources)');
  }

  const appHit = lookupCuratorsByAppId('668580');
  console.log('\nDirect app lookup 668580 (should flag):', appHit?.explanation || 'not flagged');
  const stalker = lookupCuratorsByAppId('1643320');
  console.log('Direct app lookup 1643320 (curator cleared):', stalker?.explanation || 'not flagged');
  const cleared = lookupCuratorsByAppId('4595550');
  console.log('Direct app lookup 4595550 (curator cleared):', cleared?.explanation || 'not flagged');

  const neGraiNegative = [
    'Rebellion',
    'Iron Gate AB',
    'Total Mayhem Games',
    'Pine Studio',
    'Robot Entertainment',
    'Merge Games',
  ];
  const neGraiPositive = ['Gaijin Entertainment', 'Mundfish'];

  let failed = 0;
  console.log('\n=== NE GRAI regression (exact match only) ===');
  for (const name of neGraiNegative) {
    const hit = lookupNeGrai(name);
    const ok = !hit;
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} should NOT match NE GRAI`);
    if (hit) console.log('  unexpected:', hit.explanation);
  }
  for (const name of neGraiPositive) {
    const hit = lookupNeGrai(name);
    const ok = Boolean(hit);
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name} should match NE GRAI`);
    if (hit) console.log('  matched:', hit.explanation);
  }

  if (failed > 0) {
    console.error(`\n${failed} NE GRAI regression case(s) failed`);
    process.exit(1);
  }
  console.log('\nAll NE GRAI regression cases passed');

  console.log('\n=== Message format checks ===');
  const neHit = lookupNeGrai('Gaijin Entertainment');
  if (!neHit?.explanation?.includes('developer found in "Не Грай" database')) {
    console.error('FAIL: NE GRAI explanation format');
    process.exit(1);
  }
  console.log('PASS: NE GRAI explanation format');

  const curatorHit = lookupCuratorsByAppId('668580');
  if (
    !curatorHit?.explanation?.includes('(not recommended or informational)') ||
    curatorHit.explanation.includes('app/668580')
  ) {
    console.error('FAIL: curator app explanation format');
    process.exit(1);
  }
  console.log('PASS: curator app explanation format');

  const { aggregateGameVetting } = require('./devBgCheck');
  const curatorGame = {
    id: '3176060',
    steamStatic: { developers: ['Rone Vine'] },
  };
  const curatorAgg = aggregateGameVetting(curatorGame, new Map());
  const curatorParts = curatorAgg.ruDeveloperExplanation.split(' | ');
  if (curatorParts.length !== 1) {
    console.error('FAIL: curator aggregation should not duplicate app + dev hits');
    console.error('  got:', curatorAgg.ruDeveloperExplanation);
    process.exit(1);
  }
  console.log('PASS: curator aggregation dedupes app + developer hits');

  const firevoltGame = {
    id: '1',
    steamStatic: { developers: ['Firevolt'], publishers: ['Firevolt'] },
  };
  const firevoltAgg = aggregateGameVetting(firevoltGame, new Map());
  const firevoltParts = firevoltAgg.ruDeveloperExplanation.split(' | ');
  if (firevoltParts.length !== 1) {
    console.error('FAIL: NE GRAI aggregation should dedupe developer + publisher');
    console.error('  got:', firevoltAgg.ruDeveloperExplanation);
    process.exit(1);
  }
  if (!firevoltAgg.ruDeveloperExplanation.includes('developer found in "Не Грай" database')) {
    console.error('FAIL: Firevolt NE GRAI message format');
    process.exit(1);
  }
  console.log('PASS: NE GRAI developer/publisher dedup + message format');
}

main();

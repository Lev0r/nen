#!/usr/bin/env node
/** Smoke tests for HLTB title matching helpers (no network). */
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '../functions/package.json'));
const {
  normalizeTitle,
  buildSearchQueries,
  titleSimilarity,
  stripMarketingSuffixes,
  sanitizeSearchQuery,
} = require('../functions/hltb');

const MIN_TITLE_SIMILARITY = 0.55;

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
}

function assertNoTrademarkInQueries(queries, label) {
  for (const q of queries) {
    assert(!/[™®©]/.test(q), `${label}: query must not contain trademark symbols: "${q}"`);
  }
}

const cases = [
  {
    name: 'Returnal™',
    stripped: 'Returnal™',
    normalized: 'returnal',
    hltbName: 'Returnal',
  },
  {
    name: 'ENDLESS™ Dungeon - Definitive Edition',
    stripped: 'ENDLESS™ Dungeon',
    normalized: 'endless dungeon',
    hltbName: 'ENDLESS Dungeon',
  },
];

let passed = 0;

for (const { name, stripped, normalized, hltbName } of cases) {
  assert(stripMarketingSuffixes(name) === stripped, `stripMarketingSuffixes("${name}")`);
  assert(normalizeTitle(name) === normalized, `normalizeTitle("${name}")`);
  assert(!/[™®©]/.test(sanitizeSearchQuery(name)), `sanitizeSearchQuery("${name}")`);
  assert(!/[™®©]/.test(sanitizeSearchQuery(stripped)), `sanitizeSearchQuery(stripped "${name}")`);
  if (name === stripped) {
    assert(
      sanitizeSearchQuery(name) === sanitizeSearchQuery(stripped),
      `sanitizeSearchQuery("${name}")`
    );
  }

  const queries = buildSearchQueries(name);
  assert(queries.length > 0, `buildSearchQueries("${name}") not empty`);
  assert(queries.includes(normalized), `buildSearchQueries("${name}") includes normalized variant`);
  assertNoTrademarkInQueries(queries, `buildSearchQueries("${name}")`);

  const similarity = titleSimilarity(name, hltbName);
  assert(
    similarity >= MIN_TITLE_SIMILARITY,
    `titleSimilarity("${name}", "${hltbName}") = ${similarity} (need >= ${MIN_TITLE_SIMILARITY})`
  );

  passed += 1;
  console.log(`OK: ${name}`);
}

console.log(`\n${passed}/${cases.length} cases passed`);
process.exit(0);

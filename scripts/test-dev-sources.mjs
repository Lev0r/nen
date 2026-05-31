#!/usr/bin/env node
/** Quick smoke test for devSources lookups. */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '../functions/package.json'));
const {
  lookupNeGrai,
  lookupCurators,
  lookupCuratorsByAppId,
  lookupDeterministicSources,
  getSourceMetadata,
} = require('./devSources');

const samples = [
  { name: 'Gaijin Entertainment', appIds: [] },
  { name: 'Mundfish', appIds: [] },
  { name: 'CD Projekt RED', appIds: [] },
  { name: 'Unknown Studio XYZ', appIds: ['1643320'] }, // S.T.A.L.K.E.R. 2 — often on RU curator lists
];

async function main() {
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

  const appHit = lookupCuratorsByAppId('1643320');
  console.log('\nDirect app lookup 1643320:', appHit?.explanation || 'not on curator lists');
}

main();

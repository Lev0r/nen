#!/usr/bin/env node
/**
 * Resolve legacy "Title on Steam" Game link values to store URLs via Steam search.
 * Usage: node scripts/fix-steam-links.mjs [path/to/games.json]
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const jsonPath = resolve(process.argv[2] || join(ROOT, 'docs/all games.json'));

const STEAM_URL_RE = /store\.steampowered\.com\/app\/(\d+)/i;
const ON_STEAM_RE = /^(.+?)\s+on\s+Steam\s*$/i;

/** Titles Steam search ranks poorly; map normalized title → app ID. */
const KNOWN_APP_IDS = {
  bokura: 1801110,
};

function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromLink(link) {
  const m = String(link).match(ON_STEAM_RE);
  return m ? m[1].trim() : String(link).trim();
}

async function searchSteam(term) {
  const url = new URL('https://store.steampowered.com/api/storesearch/');
  url.searchParams.set('term', term);
  url.searchParams.set('cc', 'US');
  url.searchParams.set('l', 'en');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nen-import/1.0)' },
  });
  if (!res.ok) {
    throw new Error(`Steam search failed (${res.status}) for "${term}"`);
  }
  const data = await res.json();
  return (data.items || []).filter((item) => item.type === 'app');
}

function pickBestMatch(title, items) {
  if (!items.length) return null;

  const want = normalizeTitle(title);
  const exact = items.find((item) => normalizeTitle(item.name) === want);
  if (exact) return { item: exact, score: 100 };

  let best = items[0];
  let bestScore = -1;

  for (const item of items) {
    const got = normalizeTitle(item.name);
    let score = 0;
    if (got === want) score = 100;
    else if (got.startsWith(`${want} `) || got.startsWith(want)) score = 75;
    else if (want.startsWith(got)) score = 70;
    else if (got.includes(want) || want.includes(got)) score = 60;
    else {
      const wantWords = new Set(want.split(' ').filter(Boolean));
      const gotWords = got.split(' ').filter(Boolean);
      const overlap = gotWords.filter((w) => wantWords.has(w)).length;
      score = overlap * 10;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return { item: best, score: bestScore };
}

function steamUrl(appId, slugName) {
  const slug = String(slugName || 'game')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `https://store.steampowered.com/app/${appId}/${slug}/`;
}

async function resolveLink(link) {
  if (STEAM_URL_RE.test(link)) {
    return { link, changed: false };
  }

  const title = titleFromLink(link);
  const knownId = KNOWN_APP_IDS[normalizeTitle(title)];
  if (knownId) {
    return {
      link: steamUrl(knownId, title),
      changed: true,
      title,
      matchedName: title,
      appId: knownId,
      score: 100,
      source: 'known',
    };
  }

  const items = await searchSteam(title);
  const match = pickBestMatch(title, items);
  if (!match || match.score < 20) {
    throw new Error(`No confident Steam match for "${title}" (${items.length} result(s))`);
  }

  const url = steamUrl(match.item.id, match.item.name);
  return {
    link: url,
    changed: true,
    title,
    matchedName: match.item.name,
    appId: match.item.id,
    score: match.score,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const entries = JSON.parse(readFileSync(jsonPath, 'utf8'));
  if (!Array.isArray(entries)) {
    throw new Error('JSON root must be an array');
  }

  const updates = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const link = entry['Game link'] ?? entry.steamInput;
    if (!link || STEAM_URL_RE.test(link)) continue;

    if (i > 0) await sleep(400);
    const result = await resolveLink(link);
    if (result.changed) {
      if ('Game link' in entry) entry['Game link'] = result.link;
      if ('steamInput' in entry) entry.steamInput = result.link;
      updates.push({ index: i + 1, ...result });
      console.log(
        `[${i + 1}] ${result.title} → ${result.matchedName} (${result.appId}) score=${result.score}`
      );
    }
  }

  if (!updates.length) {
    console.log('No links needed updating.');
    return;
  }

  writeFileSync(jsonPath, `${JSON.stringify(entries, null, 4)}\n`, 'utf8');
  console.log(`\nUpdated ${updates.length} link(s) in ${jsonPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

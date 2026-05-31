const { FieldValue } = require('firebase-admin/firestore');

const HLTB_BASE_URL = 'https://howlongtobeat.com';
const DEFAULT_SEARCH_ENDPOINT = '/api/bleed';
const MIN_TITLE_SIMILARITY = 0.55;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const AUTH_CACHE_MS = 3600000;

const SEARCH_ENDPOINT_PATTERN =
  /fetch\s*\(\s*["']\/api\/([a-zA-Z0-9_/]+)[^"']*["']\s*,\s*\{[^}]*method:\s*["']POST["'][^}]*}/i;

let cachedAuth = null;
let cachedAuthExpiry = 0;
let cachedSearchEndpoint = null;

function getHltbHeaders(extra = {}) {
  return {
    'User-Agent': USER_AGENT,
    Referer: `${HLTB_BASE_URL}/`,
    Origin: HLTB_BASE_URL,
    Accept: '*/*',
    ...extra,
  };
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(a, b) {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  if (left.includes(right) || right.includes(left)) {
    const shorter = Math.min(left.length, right.length);
    const longer = Math.max(left.length, right.length);
    return shorter / longer;
  }

  const leftWords = new Set(left.split(' '));
  const rightWords = new Set(right.split(' '));
  let overlap = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) overlap += 1;
  }
  return overlap / Math.max(leftWords.size, rightWords.size);
}

function secondsToHours(seconds) {
  return seconds > 0 ? Math.round(seconds / 3600) : null;
}

function transformRawGame(raw) {
  return {
    id: String(raw.game_id),
    name: raw.game_name,
    completionTimes: {
      main: secondsToHours(raw.comp_main),
      mainExtra: secondsToHours(raw.comp_plus),
      completionist: secondsToHours(raw.comp_100),
      allStyles: secondsToHours(raw.comp_all),
    },
    platforms: raw.profile_platform || null,
    releaseYear: raw.release_world || null,
    reviewScore: raw.review_score || null,
  };
}

async function discoverSearchEndpoint() {
  if (cachedSearchEndpoint) return cachedSearchEndpoint;

  try {
    const homeRes = await fetch(`${HLTB_BASE_URL}/`, { headers: getHltbHeaders() });
    if (!homeRes.ok) {
      cachedSearchEndpoint = DEFAULT_SEARCH_ENDPOINT;
      return cachedSearchEndpoint;
    }

    const html = await homeRes.text();
    const scriptMatches = [
      ...html.matchAll(/<script[^>]+src="([^"]*(?:_app-|\/_next\/static\/chunks\/)[^"]+\.js)"/gi),
    ];
    const scripts = [...new Set(scriptMatches.map((match) => match[1]))];

    for (const src of scripts) {
      const url = src.startsWith('http') ? src : `${HLTB_BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`;
      const jsRes = await fetch(url, { headers: getHltbHeaders() });
      if (!jsRes.ok) continue;

      const js = await jsRes.text();
      if (js.includes('/api/bleed')) {
        cachedSearchEndpoint = DEFAULT_SEARCH_ENDPOINT;
        return cachedSearchEndpoint;
      }

      const match = js.match(SEARCH_ENDPOINT_PATTERN);
      if (match) {
        const basePath = match[1].split('/')[0];
        cachedSearchEndpoint = `/api/${basePath}`;
        return cachedSearchEndpoint;
      }
    }
  } catch {
    // Fall back to the known working endpoint.
  }

  cachedSearchEndpoint = DEFAULT_SEARCH_ENDPOINT;
  return cachedSearchEndpoint;
}

function extractHpFields(data) {
  let hpKey = data.hpKey;
  let hpVal = data.hpVal;

  if (!hpKey || !hpVal) {
    for (const [fieldName, fieldValue] of Object.entries(data)) {
      if (/key/i.test(fieldName)) hpKey = fieldValue;
      if (/val/i.test(fieldName)) hpVal = fieldValue;
    }
  }

  return { hpKey, hpVal };
}

async function getAuth(forceRefresh = false) {
  if (!forceRefresh && cachedAuth && Date.now() < cachedAuthExpiry - 60000) {
    return cachedAuth;
  }

  const endpoint = await discoverSearchEndpoint();
  const initUrl = `${HLTB_BASE_URL}${endpoint}/init?t=${Date.now()}`;
  const res = await fetch(initUrl, { headers: getHltbHeaders() });
  if (!res.ok) {
    cachedSearchEndpoint = null;
    throw new Error(`HLTB auth init failed (${res.status})`);
  }

  const data = await res.json();
  if (!data?.token) {
    throw new Error('HLTB auth init returned no token');
  }

  const { hpKey, hpVal } = extractHpFields(data);
  cachedAuth = { token: data.token, hpKey, hpVal, endpoint };
  cachedAuthExpiry = Date.now() + AUTH_CACHE_MS;
  return cachedAuth;
}

function buildSearchPayload(query, limit, auth) {
  const payload = {
    searchType: 'games',
    searchTerms: query.trim().split(/\s+/),
    searchPage: 1,
    size: Math.min(Math.max(1, limit), 100),
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { min: '', max: '' },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  };

  if (auth.hpKey && auth.hpVal) {
    payload[auth.hpKey] = auth.hpVal;
  }

  return payload;
}

async function searchHltb(query, { limit = 8, retry = true } = {}) {
  const auth = await getAuth();
  const payload = buildSearchPayload(query, limit, auth);
  const url = `${HLTB_BASE_URL}${auth.endpoint}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHltbHeaders({
      'Content-Type': 'application/json',
      'x-auth-token': auth.token,
      'x-hp-key': String(auth.hpKey),
      'x-hp-val': String(auth.hpVal),
    }),
    body: JSON.stringify(payload),
  });

  if ((res.status === 401 || res.status === 403) && retry) {
    cachedAuth = null;
    await getAuth(true);
    return searchHltb(query, { limit, retry: false });
  }

  if (!res.ok) {
    throw new Error(`HLTB search failed (${res.status})`);
  }

  const data = await res.json();
  if (!Array.isArray(data?.data)) return [];
  return data.data.map(transformRawGame);
}

function mapHltbGame(match, steamName) {
  if (!match?.id) return null;

  const times = match.completionTimes || {};
  const mainStoryHours = times.main ?? null;
  const mainExtraHours = times.mainExtra ?? null;
  const completionistHours = times.completionist ?? null;
  const allStylesHours = times.allStyles ?? null;

  if (
    mainStoryHours == null &&
    mainExtraHours == null &&
    completionistHours == null &&
    allStylesHours == null
  ) {
    return null;
  }

  return {
    hltbId: String(match.id),
    matchedName: match.name || null,
    steamName: steamName || null,
    similarity: titleSimilarity(steamName, match.name),
    webUrl: `${HLTB_BASE_URL}/game/${match.id}`,
    mainStoryHours,
    mainExtraHours,
    completionistHours,
    allStylesHours,
    releaseYear: match.releaseYear ?? null,
    reviewScore: match.reviewScore ?? null,
    platforms: match.platforms ?? null,
    syncedAt: FieldValue.serverTimestamp(),
    lastError: null,
  };
}

async function pickBestMatch(gameName, existingHltbId) {
  const results = await searchHltb(gameName.trim(), { limit: 8 });
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const ranked = results
    .map((result) => ({
      result,
      score:
        existingHltbId && String(result.id) === String(existingHltbId)
          ? 1
          : titleSimilarity(gameName, result.name),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < MIN_TITLE_SIMILARITY) {
    return null;
  }

  return best.result;
}

async function fetchHltbForGame(gameName, existingHltbId = null) {
  if (!gameName?.trim()) {
    return { data: null, error: 'Missing game name' };
  }

  try {
    const match = await pickBestMatch(gameName, existingHltbId);
    if (!match) {
      return { data: null, error: 'No confident HLTB match' };
    }

    return { data: mapHltbGame(match, gameName), error: null };
  } catch (err) {
    return {
      data: null,
      error: err.message || 'HLTB fetch failed',
    };
  }
}

module.exports = {
  fetchHltbForGame,
  normalizeTitle,
  titleSimilarity,
};

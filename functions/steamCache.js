const DEFAULT_TTL_MS = 60 * 60 * 1000;
const STEAM_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TTL_BY_PATTERN = [
  { pattern: /store\.steampowered\.com\/api\/appdetails/i, ttlMs: 60 * 60 * 1000 },
  { pattern: /store\.steampowered\.com\/api\/featuredcategories/i, ttlMs: 6 * 60 * 60 * 1000 },
  { pattern: /store\.steampowered\.com\/appreviews\//i, ttlMs: 60 * 60 * 1000 },
  { pattern: /ISteamNews\/GetNewsForApp/i, ttlMs: 6 * 60 * 60 * 1000 },
  { pattern: /static\.nvidiagrid\.net\/supported-public-game-list/i, ttlMs: 24 * 60 * 60 * 1000 },
];

const cache = new Map();

function resolveTtlMs(url, ttlMs) {
  if (ttlMs != null) return ttlMs;
  const match = TTL_BY_PATTERN.find(({ pattern }) => pattern.test(url));
  return match?.ttlMs ?? DEFAULT_TTL_MS;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 403 || status === 429 || status === 502 || status === 503;
}

async function fetchJsonWithRetry(url, { maxAttempts = 4 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': STEAM_USER_AGENT,
          Accept: 'application/json,text/javascript,*/*;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://store.steampowered.com/',
        },
      });

      if (!res.ok) {
        const error = new Error(`HTTP request failed (${res.status})`);
        if (attempt < maxAttempts && isRetryableStatus(res.status)) {
          lastError = error;
          await sleep(400 * attempt * attempt);
          continue;
        }
        throw error;
      }

      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && /403|429|502|503|fetch failed/i.test(err.message || '')) {
        await sleep(400 * attempt * attempt);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('HTTP request failed');
}

async function cachedFetchJson(url, ttlMs) {
  const resolvedTtl = resolveTtlMs(url, ttlMs);
  const now = Date.now();
  const cached = cache.get(url);

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const data = await fetchJsonWithRetry(url);
  cache.set(url, { data, expiresAt: now + resolvedTtl });
  return data;
}

module.exports = { cachedFetchJson, resolveTtlMs, fetchJsonWithRetry };

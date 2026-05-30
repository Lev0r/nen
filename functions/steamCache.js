const DEFAULT_TTL_MS = 60 * 60 * 1000;

const TTL_BY_PATTERN = [
  { pattern: /store\.steampowered\.com\/api\/appdetails/i, ttlMs: 60 * 60 * 1000 },
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

async function cachedFetchJson(url, ttlMs) {
  const resolvedTtl = resolveTtlMs(url, ttlMs);
  const now = Date.now();
  const cached = cache.get(url);

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': 'NenCoopTracker/1.0' },
  });
  if (!res.ok) {
    throw new Error(`HTTP request failed (${res.status})`);
  }

  const data = await res.json();
  cache.set(url, { data, expiresAt: now + resolvedTtl });
  return data;
}

module.exports = { cachedFetchJson, resolveTtlMs };

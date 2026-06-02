const STEAM_WEB_API_BASE = 'https://api.steampowered.com';
const STEAM_WEB_API_DELAY_MS = 300;

let apiCallCount = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSteamWebApiKey(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  // Accept plain hex keys (e.g. C1F410E37C14EC0A…) — also tolerate pasted sample URLs.
  if (/^https?:\/\//i.test(trimmed) || /[?&]key=/i.test(trimmed) || /^key=/i.test(trimmed)) {
    try {
      const url = /^https?:\/\//i.test(trimmed)
        ? new URL(trimmed)
        : new URL(`https://local/?${trimmed.replace(/^\?/, '')}`);
      const fromQuery = url.searchParams.get('key');
      if (fromQuery?.trim()) return fromQuery.trim();
    } catch {
      // fall through to regex
    }
    const keyMatch = trimmed.match(/[?&]key=([^&]+)/i) || trimmed.match(/^key=([^&]+)/i);
    if (keyMatch?.[1]) {
      try {
        return decodeURIComponent(keyMatch[1]).trim();
      } catch {
        return keyMatch[1].trim();
      }
    }
  }

  return trimmed;
}

function getSteamWebApiKey() {
  return normalizeSteamWebApiKey(process.env.STEAM_WEB_API_KEY);
}

function getConfiguredSteamIds() {
  return {
    user0: process.env.STEAM_ID_0 || null,
    user1: process.env.STEAM_ID_1 || null,
  };
}

function normalizeSteamId(steamId) {
  const trimmed = String(steamId ?? '').trim();
  if (!trimmed || !/^\d{5,20}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeAppIds(items, appIdKey = 'appid') {
  if (!Array.isArray(items)) return [];
  const ids = [];
  for (const item of items) {
    const raw = item?.[appIdKey];
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      ids.push(parsed);
    }
  }
  return ids;
}

async function steamWebApiFetch(servicePath, params = {}) {
  const apiKey = getSteamWebApiKey();
  if (!apiKey) {
    return { data: null, error: 'STEAM_WEB_API_KEY not configured' };
  }

  if (apiCallCount > 0) {
    await sleep(STEAM_WEB_API_DELAY_MS);
  }
  apiCallCount += 1;

  const url = new URL(`${STEAM_WEB_API_BASE}/${servicePath}`);
  url.searchParams.set('key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  }

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NenCoopTracker/1.0',
      },
    });
  } catch (err) {
    return { data: null, error: err.message || 'Steam Web API request failed' };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      data: null,
      error: `Steam Web API ${response.status}${text ? `: ${text.slice(0, 120)}` : ''}`,
    };
  }

  try {
    return { data: await response.json(), error: null };
  } catch (err) {
    return { data: null, error: err.message || 'Steam Web API returned invalid JSON' };
  }
}

async function getOwnedGames(steamId) {
  const normalizedId = normalizeSteamId(steamId);
  if (!normalizedId) {
    return { appIds: null, error: 'Invalid Steam ID' };
  }

  const result = await steamWebApiFetch('IPlayerService/GetOwnedGames/v1', {
    steamid: normalizedId,
    include_appinfo: 0,
    include_played_free_games: 1,
  });
  if (result.error) {
    return { appIds: null, error: result.error };
  }

  const games = result.data?.response?.games;
  if (games == null) {
    return {
      appIds: null,
      error: 'Steam Web API returned no owned games (profile may be private)',
    };
  }

  return { appIds: normalizeAppIds(games), error: null };
}

async function getWishlist(steamId) {
  const normalizedId = normalizeSteamId(steamId);
  if (!normalizedId) {
    return { appIds: null, error: 'Invalid Steam ID' };
  }

  const result = await steamWebApiFetch('IWishlistService/GetWishlist/v1', {
    steamid: normalizedId,
  });
  if (result.error) {
    return { appIds: null, error: result.error };
  }

  const items = result.data?.response?.items;
  if (!Array.isArray(items)) {
    return {
      appIds: null,
      error: 'Steam Web API returned no wishlist (profile may be private)',
    };
  }

  return { appIds: normalizeAppIds(items), error: null };
}

module.exports = {
  STEAM_WEB_API_DELAY_MS,
  normalizeSteamWebApiKey,
  getSteamWebApiKey,
  getConfiguredSteamIds,
  getOwnedGames,
  getWishlist,
};

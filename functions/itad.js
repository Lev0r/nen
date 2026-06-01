const ITAD_BASE_URL = 'https://api.isthereanydeal.com';
const STEAM_SHOP_ID = 61;

function getItadApiKey() {
  return process.env.ITAD_API_KEY || null;
}

function getItadCountry() {
  return process.env.ITAD_COUNTRY || 'UA';
}

async function itadFetch(path, { method = 'GET', body } = {}) {
  const apiKey = getItadApiKey();
  if (!apiKey) {
    return { data: null, error: 'ITAD_API_KEY not configured' };
  }

  const url = new URL(`${ITAD_BASE_URL}${path}`);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'NenCoopTracker/1.0',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      data: null,
      error: `ITAD ${response.status}${text ? `: ${text.slice(0, 120)}` : ''}`,
    };
  }

  return { data: await response.json(), error: null };
}

function normalizeLookupGame(data) {
  if (data?.found && data?.game?.id) {
    return data.game;
  }

  if (data?.id) {
    return data;
  }

  if (Array.isArray(data) && data[0]?.id) {
    return data[0];
  }

  return null;
}

async function lookupItadGameByShopId(steamAppId) {
  const shopKey = `app/${steamAppId}`;
  const result = await itadFetch(`/lookup/id/shop/${STEAM_SHOP_ID}/v1`, {
    method: 'POST',
    body: [shopKey],
  });
  if (result.error) return result;

  const itadId = result.data?.[shopKey];
  if (!itadId) {
    return { data: null, error: null };
  }

  return { data: { id: itadId }, error: null };
}

async function lookupItadGame(steamAppId, { gameTitle = null } = {}) {
  const result = await itadFetch(`/games/lookup/v1?appid=${encodeURIComponent(steamAppId)}`);
  if (result.error) return result;

  const match = normalizeLookupGame(result.data);
  if (match?.id) {
    return { data: match, error: null };
  }

  const shopLookup = await lookupItadGameByShopId(steamAppId);
  if (shopLookup.error) return shopLookup;
  if (shopLookup.data?.id) {
    return {
      data: { ...shopLookup.data, title: gameTitle || null },
      error: null,
    };
  }

  if (!gameTitle?.trim()) {
    return { data: null, error: 'Game not found on ITAD' };
  }

  if (gameTitle?.trim()) {
    const searchResult = await itadFetch(
      `/games/search/v1?title=${encodeURIComponent(gameTitle.trim())}&results=5`
    );
    if (searchResult.error) return searchResult;

    const candidates = Array.isArray(searchResult.data) ? searchResult.data : [];
    const exact = candidates.find(
      (entry) => entry?.title?.trim().toLowerCase() === gameTitle.trim().toLowerCase()
    );
    if (exact?.id) {
      return { data: exact, error: null };
    }
    if (candidates[0]?.id) {
      return { data: candidates[0], error: null };
    }
  }

  return { data: null, error: 'Game not found on ITAD' };
}

function pickSteamDeal(deals) {
  if (!Array.isArray(deals)) return null;
  return deals.find((deal) => deal?.shop?.id === STEAM_SHOP_ID) || null;
}

const CRITICS_SOURCE_PRIORITY = ['Metascore', 'OpenCritic'];

function pickCriticsReview(reviews) {
  if (!Array.isArray(reviews)) return null;

  for (const preferred of CRITICS_SOURCE_PRIORITY) {
    const match = reviews.find((entry) => entry?.source === preferred && entry.score != null);
    if (match) {
      return {
        score: Number(match.score),
        source: match.source,
        count: match.count ?? null,
      };
    }
  }

  return null;
}

function mapHistoricalLow(historyLow) {
  if (!historyLow) return null;

  const allTime = historyLow.all || historyLow;
  if (allTime?.amountInt == null) return null;

  return {
    amount: allTime.amount,
    amountInt: allTime.amountInt,
    currency: allTime.currency,
    at: allTime.timestamp || allTime.date || null,
  };
}

async function fetchItadPriceMeta(steamAppId, { gameTitle = null } = {}) {
  const lookup = await lookupItadGame(steamAppId, { gameTitle });
  if (lookup.error) {
    return { data: null, error: lookup.error, detail: null };
  }

  if (!lookup.data?.id) {
    return { data: null, error: 'Game not found on ITAD', detail: null };
  }

  const itadId = lookup.data.id;
  const country = getItadCountry();
  const [pricesResult, infoResult] = await Promise.all([
    itadFetch(`/games/prices/v3?country=${encodeURIComponent(country)}`, {
      method: 'POST',
      body: [itadId],
    }),
    itadFetch(`/games/info/v2?id=${encodeURIComponent(itadId)}`),
  ]);

  if (pricesResult.error) {
    return { data: null, error: pricesResult.error, detail: pricesResult.error };
  }

  const critics = infoResult.error ? null : pickCriticsReview(infoResult.data?.reviews);
  const entry = Array.isArray(pricesResult.data) ? pricesResult.data[0] : null;
  if (!entry) {
    return { data: null, error: 'No ITAD price data', detail: null };
  }

  const steamDeal = pickSteamDeal(entry.deals);
  const historicalLow = mapHistoricalLow(entry.historyLow || entry.lowest);
  const currentAmountInt = steamDeal?.price?.amountInt ?? null;
  const isHistoricalLow =
    currentAmountInt != null &&
    historicalLow?.amountInt != null &&
    currentAmountInt <= historicalLow.amountInt;

  return {
    data: {
      itadId,
      itadTitle: lookup.data.title || null,
      isHistoricalLow,
      historicalLow,
      currentSteamPrice: steamDeal?.price ?? null,
      currentSteamRegular: steamDeal?.regular ?? null,
      currentSteamCut: steamDeal?.cut ?? null,
      criticsScore: critics?.score ?? null,
      criticsSource: critics?.source ?? null,
      criticsCount: critics?.count ?? null,
    },
    error: null,
    detail: null,
  };
}

module.exports = {
  fetchItadPriceMeta,
  lookupItadGame,
  getItadApiKey,
  STEAM_SHOP_ID,
};

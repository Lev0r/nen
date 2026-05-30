const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { cachedFetchJson } = require('./steamCache');
const { getConfigDocPath } = require('./gfnSync');

// Ukraine store region — UAH prices, English text from Steam
const STEAM_CC = 'ua';
const STEAM_LANG = 'english';
const APP_DETAILS_URL = `https://store.steampowered.com/api/appdetails?appids=APPID&cc=${STEAM_CC}&l=${STEAM_LANG}`;
const REVIEW_URLS = (appId) => [
  `https://store.steampowered.com/appreviews/${appId}?json=1&language=english&filter=summary&purchase_type=all`,
  `https://store.steampowered.com/appreviews/${appId}?json=1&language=english&filter=summary&review_type=all`,
  `https://store.steampowered.com/appreviews/${appId}?json=1&filter=summary&purchase_type=all`,
];

const COOP_CATEGORY_IDS = new Set([9, 38, 39, 48]);

let gfnCatalogPromise = null;

function parseAppId(input) {
  const trimmed = String(input || '').trim();
  const match = trimmed.match(/\/app\/(\d+)/);
  if (match) return match[1];
  const digits = trimmed.replace(/\D/g, '');
  return digits || trimmed;
}

async function loadGfnCatalogSteamAppIds(appId = 'default_app') {
  if (!gfnCatalogPromise) {
    gfnCatalogPromise = getFirestore()
      .doc(getConfigDocPath(appId))
      .get()
      .then((snapshot) => {
        const steamAppIds = snapshot.data()?.gfnCatalog?.steamAppIds;
        if (!Array.isArray(steamAppIds)) {
          return null;
        }
        return new Set(steamAppIds.map(String));
      })
      .catch((err) => {
        gfnCatalogPromise = null;
        throw err;
      });
  }
  return gfnCatalogPromise;
}

async function fetchGeForceNowReady(appId, configAppId = 'default_app') {
  try {
    const ids = await loadGfnCatalogSteamAppIds(configAppId);
    if (!ids) {
      return false;
    }
    return ids.has(String(appId));
  } catch (err) {
    console.warn('GeForce NOW lookup failed:', err.message);
    return false;
  }
}

function mapSteamTags(genres, categories) {
  const tags = new Set();

  for (const genre of genres || []) {
    if (genre.description) {
      tags.add(genre.description.toLowerCase());
    }
  }

  for (const category of categories || []) {
    if (COOP_CATEGORY_IDS.has(category.id) && category.description) {
      tags.add(category.description.toLowerCase());
    }
  }

  return [...tags];
}

function percentFromSummary(summary) {
  if (!summary || !summary.total_reviews) return null;

  if (summary.percent_positive != null) {
    return Math.round(summary.percent_positive);
  }

  if (summary.total_positive != null && summary.total_reviews > 0) {
    return Math.round((summary.total_positive / summary.total_reviews) * 100);
  }

  if (summary.review_score != null && summary.review_score <= 10) {
    return Math.round(summary.review_score * 10);
  }

  return null;
}

function percentFromAppDetails(data) {
  const reviews = data?.reviews;
  if (!reviews) return null;

  if (reviews.percent_positive != null) {
    return Math.round(reviews.percent_positive);
  }

  if (reviews.total_positive != null && reviews.total_reviews > 0) {
    return Math.round((reviews.total_positive / reviews.total_reviews) * 100);
  }

  return null;
}

async function fetchReviewPercent(appId, appDetailsData) {
  const fromDetails = percentFromAppDetails(appDetailsData);
  if (fromDetails != null) return fromDetails;

  for (const url of REVIEW_URLS(appId)) {
    try {
      const data = await cachedFetchJson(url);
      const pct = percentFromSummary(data?.query_summary);
      if (pct != null) return pct;
    } catch (err) {
      console.warn('Steam reviews fetch failed:', url, err.message);
    }
  }

  return null;
}

async function fetchCurrentVersion(appId) {
  try {
    const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=3`;
    const data = await cachedFetchJson(url);
    const items = data?.appnews?.newsitems || [];
    const versionPattern = /v?\d+\.\d+(\.\d+)?(-\w+)?/i;
    for (const item of items) {
      const match = (item.title || '').match(versionPattern);
      if (match) return match[0].startsWith('v') ? match[0] : `v${match[0]}`;
    }
  } catch (err) {
    console.warn('Steam news fetch failed:', err.message);
  }
  return 'v1.0.0';
}

function mapDevelopmentStatus(data) {
  const genres = data.genres || [];
  const isEarlyAccess = genres.some((g) => g.id === 70 || g.description === 'Early Access');
  if (data.release_date?.coming_soon) return 'tba';
  if (isEarlyAccess) return 'early_access';
  return 'released';
}

function mapCoopSpecs(categories) {
  const ids = new Set((categories || []).map((c) => c.id));
  return {
    onlineCoop: ids.has(38),
    splitScreen: ids.has(39),
    crossPlay: ids.has(48),
    maxPlayers: 4,
  };
}

async function fetchPriceAndReviews(appId) {
  const payload = await cachedFetchJson(APP_DETAILS_URL.replace('APPID', appId));
  const entry = payload[appId];
  if (!entry?.success || !entry.data) {
    return null;
  }

  const data = entry.data;
  const priceOverview = data.price_overview;
  const discountPercent = priceOverview?.discount_percent || 0;
  const steamReviewPercent = await fetchReviewPercent(appId, data);

  return {
    price: priceOverview?.final_formatted || (data.is_free ? 'Free to Play' : 'N/A'),
    isOnSale: discountPercent > 0,
    discountPercent,
    steamReviewPercent,
  };
}

async function fetchSteamGame(steamInput) {
  const appId = parseAppId(steamInput);
  if (!appId || !/^\d+$/.test(appId)) {
    throw new Error('Invalid Steam URL or App ID');
  }

  const payload = await cachedFetchJson(APP_DETAILS_URL.replace('APPID', appId));
  const entry = payload[appId];
  if (!entry?.success || !entry.data) {
    throw new Error('Steam game not found or API returned no data');
  }

  const data = entry.data;
  const developmentStatus = mapDevelopmentStatus(data);
  const priceOverview = data.price_overview;
  const discountPercent = priceOverview?.discount_percent || 0;
  const steamTags = mapSteamTags(data.genres, data.categories);

  const [steamReviewPercent, currentVersion, geforceNowReady] = await Promise.all([
    fetchReviewPercent(appId, data),
    developmentStatus === 'tba' ? Promise.resolve(null) : fetchCurrentVersion(appId),
    fetchGeForceNowReady(appId),
  ]);

  return {
    id: String(appId),
    name: data.name,
    price: priceOverview?.final_formatted || (data.is_free ? 'Free to Play' : 'N/A'),
    originalPrice: priceOverview?.initial_formatted || priceOverview?.final_formatted || 'N/A',
    currency: 'UAH',
    isOnSale: discountPercent > 0,
    discountPercent,
    thumbnail: data.header_image,
    url: `https://store.steampowered.com/app/${appId}/`,
    developers: data.developers || [],
    ruDeveloperAlert: false,
    ruDeveloperExplanation: '',
    developmentStatus,
    currentVersion: developmentStatus === 'tba' ? null : currentVersion,
    owned: { user0: false, user1: false },
    userNotes: { user0: '', user1: '' },
    hypeTier: { user0: 'morkite_found', user1: 'morkite_found' },
    libraryState: 'active',
    stateMeta: {
      versionAtEntry: developmentStatus === 'tba' ? null : currentVersion,
      note: '',
      enteredAt: FieldValue.serverTimestamp(),
    },
    hasUpdateSinceState: false,
    playerCount: data.recommendations?.total || null,
    steamOverview: data.short_description || '',
    steamReviewPercent,
    steamTags,
    geforceNowReady,
    screenshots: (data.screenshots || []).slice(0, 5).map((s) => s.path_full),
    coopSpecs: mapCoopSpecs(data.categories),
  };
}

module.exports = {
  parseAppId,
  fetchSteamGame,
  fetchCurrentVersion,
  fetchPriceAndReviews,
  fetchGeForceNowReady,
};

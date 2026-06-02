const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { cachedFetchJson } = require('./steamCache');
const { GFN_CATALOG_DOC_ID, configDocPath } = require('./configPaths');

const STEAM_CC = 'ua';
const STEAM_LANG = 'english';
const APP_DETAILS_URL = `https://store.steampowered.com/api/appdetails?appids=APPID&cc=${STEAM_CC}&l=${STEAM_LANG}`;
const REVIEW_URL_ALL = (appId) =>
  `https://store.steampowered.com/appreviews/${appId}?json=1&language=${STEAM_LANG}&filter=summary&purchase_type=all&num_per_page=0&cursor=*`;
const RECENT_REVIEW_DAY_RANGE = 30;
const RECENT_REVIEW_MAX_PAGES = 10;
const REVIEW_URL_RECENT_PAGE = (appId, cursor) =>
  `https://store.steampowered.com/appreviews/${appId}?json=1&language=${STEAM_LANG}&filter=all&day_range=${RECENT_REVIEW_DAY_RANGE}&purchase_type=all&num_per_page=100&cursor=${encodeURIComponent(cursor)}`;
const NEWS_URL = (appId) =>
  `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=3`;
const CURRENT_PLAYERS_URL = (appId) =>
  `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`;

const COOP_CATEGORY_IDS = new Set([9, 38, 39, 48]);
const VERSION_PATTERN = /v?\d+\.\d+(\.\d+)?(-\w+)?/i;
const PLAYTIME_FIELD_CANDIDATES = [
  'estimated_playtime',
  'average_playtime',
  'playtime_disclaimer',
  'playtime',
];

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
      .doc(configDocPath(appId, GFN_CATALOG_DOC_ID))
      .get()
      .then((snapshot) => {
        const steamAppIds = snapshot.data()?.steamAppIds;
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

function mapDevelopmentStatus(data) {
  const genres = data.genres || [];
  const isEarlyAccess = genres.some((g) => g.id === 70 || g.description === 'Early Access');
  if (data.release_date?.coming_soon) return 'tba';
  if (isEarlyAccess) return 'early_access';
  return 'released';
}

function hasCoopCategory(categories) {
  return (categories || []).some((c) => COOP_CATEGORY_IDS.has(c.id));
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

function parseSteamReleaseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  if (!trimmed || /coming soon/i.test(trimmed)) return null;

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;

  return new Date(parsed).toISOString().slice(0, 10);
}

function mapReleaseDates(data, developmentStatus) {
  const rawDate = data.release_date?.coming_soon ? null : data.release_date?.date;
  const parsed = parseSteamReleaseDate(rawDate);

  if (developmentStatus === 'tba') {
    return { releaseDate: null, earlyAccessDate: null };
  }

  if (developmentStatus === 'early_access') {
    return { releaseDate: null, earlyAccessDate: parsed };
  }

  return { releaseDate: parsed, earlyAccessDate: null };
}

function extractEstimatedPlaytimeHours(data) {
  for (const field of PLAYTIME_FIELD_CANDIDATES) {
    const value = data?.[field];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }
    if (typeof value === 'string') {
      const match = value.match(/(\d+(?:\.\d+)?)\s*hours?/i);
      if (match) {
        return Math.round(Number(match[1]));
      }
    }
  }

  return null;
}

function reviewMetricsFromSummary(summary) {
  if (!summary || !summary.total_reviews) {
    return {
      reviewCount: null,
      reviewPercent: null,
      reviewScoreDesc: null,
    };
  }

  let reviewPercent = null;
  if (summary.total_positive != null && summary.total_reviews > 0) {
    reviewPercent = Math.round((summary.total_positive / summary.total_reviews) * 100);
  } else if (summary.percent_positive != null) {
    reviewPercent = Math.round(summary.percent_positive);
  } else if (summary.review_score != null && summary.review_score <= 10) {
    reviewPercent = Math.round(summary.review_score * 10);
  }

  return {
    reviewCount: summary.total_reviews,
    reviewPercent,
    reviewScoreDesc: summary.review_score_desc || null,
  };
}

function reviewMetricsFromReviews(reviews) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return {
      reviewCount: null,
      reviewPercent: null,
    };
  }

  let totalPositive = 0;
  for (const review of reviews) {
    if (review?.voted_up) totalPositive += 1;
  }

  return {
    reviewCount: reviews.length,
    reviewPercent: Math.round((totalPositive / reviews.length) * 100),
  };
}

async function fetchRecentReviewMetrics(appId) {
  let cursor = '*';
  const reviews = [];

  for (let page = 0; page < RECENT_REVIEW_MAX_PAGES; page += 1) {
    const payload = await cachedFetchJson(REVIEW_URL_RECENT_PAGE(appId, cursor)).catch((err) => {
      console.warn('Steam recent reviews fetch failed:', err.message);
      return null;
    });

    const pageReviews = payload?.reviews || [];
    if (pageReviews.length === 0) break;

    reviews.push(...pageReviews);

    const nextCursor = payload?.cursor;
    if (!nextCursor || nextCursor === cursor || pageReviews.length < 100) break;
    cursor = nextCursor;
  }

  return reviewMetricsFromReviews(reviews);
}

function formatVersionFromTitle(title) {
  const match = String(title || '').match(VERSION_PATTERN);
  if (!match) return null;
  return match[0].startsWith('v') ? match[0] : `v${match[0]}`;
}

function unixToIsoTimestamp(unixSeconds) {
  if (unixSeconds == null || !Number.isFinite(Number(unixSeconds))) return null;
  return new Date(Number(unixSeconds) * 1000).toISOString();
}

function sampleTimestampMs(at) {
  if (at == null) return null;
  if (typeof at.toMillis === 'function') return at.toMillis();
  if (typeof at._seconds === 'number') return at._seconds * 1000;
  if (typeof at === 'string' || typeof at === 'number') {
    const parsed = typeof at === 'number' ? at : Date.parse(at);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function computeAvgPlayers7d(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return null;

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = samples.filter((sample) => {
    const ts = sampleTimestampMs(sample.at);
    return ts != null && ts >= sevenDaysAgo && typeof sample.players === 'number';
  });

  if (recent.length === 0) return null;

  const total = recent.reduce((sum, sample) => sum + sample.players, 0);
  return Math.round(total / recent.length);
}

async function fetchAppDetailsEntry(appId) {
  const payload = await cachedFetchJson(APP_DETAILS_URL.replace('APPID', appId));
  const entry = payload[appId];
  if (!entry?.success || !entry.data) {
    return null;
  }
  return entry.data;
}

async function fetchStoreCoopAndName(appId) {
  const data = await fetchAppDetailsEntry(appId);
  if (!data) return null;
  return {
    name: typeof data.name === 'string' ? data.name : null,
    hasCoop: hasCoopCategory(data.categories),
  };
}

function mapPriceData(data) {
  const priceOverview = data.price_overview;
  const discountPercent = priceOverview?.discount_percent || 0;

  return {
    price: priceOverview?.final_formatted || (data.is_free ? 'Free to Play' : 'N/A'),
    originalPrice:
      priceOverview?.initial_formatted || priceOverview?.final_formatted || 'N/A',
    currency: priceOverview?.currency || 'UAH',
    isOnSale: discountPercent > 0,
    discountPercent,
  };
}

async function fetchPriceData(appId) {
  const data = await fetchAppDetailsEntry(appId);
  if (!data) return null;
  return mapPriceData(data);
}

async function fetchReviewData(appId) {
  const [allTimePayload, recentMetrics] = await Promise.all([
    cachedFetchJson(REVIEW_URL_ALL(appId)).catch((err) => {
      console.warn('Steam all-time reviews fetch failed:', err.message);
      return null;
    }),
    fetchRecentReviewMetrics(appId),
  ]);

  const allTime = reviewMetricsFromSummary(allTimePayload?.query_summary);

  return {
    reviewCount: allTime.reviewCount,
    reviewPercent: allTime.reviewPercent,
    recentReviewCount: recentMetrics.reviewCount,
    recentReviewPercent: recentMetrics.reviewPercent,
    reviewScoreDesc: allTime.reviewScoreDesc,
  };
}

async function fetchNewsData(appId) {
  try {
    const data = await cachedFetchJson(NEWS_URL(appId));
    const items = data?.appnews?.newsitems || [];
    if (items.length === 0) {
      return { currentVersion: null, lastUpdateAt: null };
    }

    const latestItem = items.reduce((latest, item) =>
      (item.date || 0) > (latest.date || 0) ? item : latest
    );

    let currentVersion = null;
    for (const item of items) {
      currentVersion = formatVersionFromTitle(item.title);
      if (currentVersion) break;
    }

    return {
      currentVersion,
      lastUpdateAt: unixToIsoTimestamp(latestItem.date),
    };
  } catch (err) {
    console.warn('Steam news fetch failed:', err.message);
    return { currentVersion: null, lastUpdateAt: null };
  }
}

async function fetchCurrentVersion(appId) {
  const { currentVersion } = await fetchNewsData(appId);
  return currentVersion || 'v1.0.0';
}

async function fetchCurrentPlayers(appId) {
  try {
    const data = await cachedFetchJson(CURRENT_PLAYERS_URL(appId));
    const count = data?.response?.player_count;
    return typeof count === 'number' ? count : null;
  } catch (err) {
    console.warn('Steam current players fetch failed:', err.message);
    return null;
  }
}

async function fetchStaticSteamData(appId) {
  const data = await fetchAppDetailsEntry(appId);
  return mapStaticFromAppDetails(data);
}

function mapStaticFromAppDetails(data) {
  if (!data) return null;

  const developmentStatus = mapDevelopmentStatus(data);
  const { releaseDate, earlyAccessDate } = mapReleaseDates(data, developmentStatus);

  return {
    name: data.name,
    developers: data.developers || [],
    publishers: data.publishers || [],
    thumbnail: data.header_image,
    screenshots: (data.screenshots || []).slice(0, 5).map((s) => s.path_full),
    steamOverview: data.short_description || '',
    steamTags: mapSteamTags(data.genres, data.categories),
    hasCoopCategory: hasCoopCategory(data.categories),
    coopSpecs: mapCoopSpecs(data.categories),
    developmentStatus,
    releaseDate,
    earlyAccessDate,
    metacriticScore: data.metacritic?.score ?? null,
    estimatedPlaytimeHours: extractEstimatedPlaytimeHours(data),
    scrapedAt: FieldValue.serverTimestamp(),
  };
}

function mapDynamicFromAppDetails(data, reviewData, newsData, developmentStatus) {
  if (!data) return null;

  const resolvedStatus = developmentStatus || mapDevelopmentStatus(data);
  const priceData = mapPriceData(data);
  const currentVersion =
    resolvedStatus === 'tba' ? null : newsData.currentVersion || 'v1.0.0';

  return {
    ...priceData,
    ...reviewData,
    currentVersion,
    lastUpdateAt: resolvedStatus === 'tba' ? null : newsData.lastUpdateAt,
    syncedAt: FieldValue.serverTimestamp(),
  };
}

async function fetchDynamicSteamData(appId, { developmentStatus, appDetails = null } = {}) {
  const [data, reviewData, newsData] = await Promise.all([
    appDetails ? Promise.resolve(appDetails) : fetchAppDetailsEntry(appId),
    fetchReviewData(appId),
    fetchNewsData(appId),
  ]);

  return mapDynamicFromAppDetails(data, reviewData, newsData, developmentStatus);
}

async function fetchPriceAndReviews(appId) {
  const steamDynamic = await fetchDynamicSteamData(appId);
  if (!steamDynamic) return null;
  return { steamDynamic };
}

function buildSteamStats(developmentStatus) {
  if (developmentStatus === 'tba') return null;

  return {
    currentPlayers: null,
    avgPlayers7d: null,
    samples: [],
    syncedAt: null,
  };
}

function buildUserDefaults(developmentStatus, currentVersion) {
  return {
    owned: { user0: false, user1: false },
    userNotes: { user0: '', user1: '' },
    hypeTier: { user0: 'morkite_found', user1: 'morkite_found' },
    libraryState: 'active',
    finishedRating: null,
    stateMeta: {
      versionAtEntry: developmentStatus === 'tba' ? null : currentVersion,
      note: '',
      enteredAt: FieldValue.serverTimestamp(),
    },
    hasUpdateSinceState: false,
    ruDeveloperAlert: false,
    ruDeveloperExplanation: '',
  };
}

async function fetchSteamGame(steamInput) {
  const appId = parseAppId(steamInput);
  if (!appId || !/^\d+$/.test(appId)) {
    throw new Error('Invalid Steam URL or App ID');
  }

  const appDetails = await fetchAppDetailsEntry(appId);
  const steamStatic = mapStaticFromAppDetails(appDetails);
  if (!steamStatic) {
    throw new Error('Steam game not found or API returned no data');
  }

  const [reviewData, newsData] = await Promise.all([
    fetchReviewData(appId),
    fetchNewsData(appId),
  ]);
  const steamDynamic = mapDynamicFromAppDetails(
    appDetails,
    reviewData,
    newsData,
    steamStatic.developmentStatus
  );
  if (!steamDynamic) {
    throw new Error('Steam game not found or API returned no data');
  }

  const developmentStatus = steamStatic.developmentStatus;
  const currentVersion = steamDynamic.currentVersion;

  return {
    id: String(appId),
    url: `https://store.steampowered.com/app/${appId}/`,
    ...buildUserDefaults(developmentStatus, currentVersion),
    steamStatic,
    steamDynamic,
    steamStats: buildSteamStats(developmentStatus),
  };
}

module.exports = {
  parseAppId,
  hasCoopCategory,
  COOP_CATEGORY_IDS,
  fetchStoreCoopAndName,
  fetchSteamGame,
  fetchCurrentVersion,
  fetchGeForceNowReady,
  fetchReviewData,
  fetchPriceData,
  fetchStaticSteamData,
  fetchDynamicSteamData,
  fetchCurrentPlayers,
  computeAvgPlayers7d,
  fetchPriceAndReviews,
};

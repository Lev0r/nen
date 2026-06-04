/**
 * Steam store events sync — featured spotlights + public Next Fest schedule.
 * Data: store featuredcategories API + known Steamworks calendar dates (not SteamDB).
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { assertAllowedUser } = require('./lib/auth');
const {
  DEFAULT_APP_ID,
  STEAM_EVENTS_DOC_ID,
  configDocPath,
} = require('./lib/firestorePaths');
const { cachedFetchJson } = require('./steamCache');
const { scheduleStoreRequest } = require('./steamRateLimiter');

const FEATURED_URL =
  'https://store.steampowered.com/api/featuredcategories/?cc=us&l=english';
const SALE_PAGE_URL = (slug) => `https://store.steampowered.com/sale/${slug}`;
const FEATURED_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SALE_ENRICHMENTS = 5;

const STEAM_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Public Steamworks / partner calendar dates for 2026 (approximate seasonal placeholders). */
const KNOWN_SCHEDULE = [
  {
    id: 'next-fest-jun-2026',
    slug: 'nextfest',
    name: 'Steam Next Fest: June 2026',
    type: 'festival',
    source: 'known-schedule',
    startDate: '2026-06-15',
    endDate: '2026-06-22',
    url: 'https://store.steampowered.com/sale/nextfest',
  },
  {
    id: 'next-fest-oct-2026',
    slug: 'nextfest',
    name: 'Steam Next Fest: October 2026',
    type: 'festival',
    source: 'known-schedule',
    startDate: '2026-10-19',
    endDate: '2026-10-26',
    url: 'https://store.steampowered.com/sale/nextfest',
  },
  {
    id: 'spring-sale-2026',
    slug: 'spring2026',
    name: 'Steam Spring Sale 2026',
    type: 'seasonal',
    source: 'known-schedule',
    startDate: '2026-03-19',
    endDate: '2026-03-26',
    url: 'https://store.steampowered.com/sale/spring2026',
  },
  {
    id: 'summer-sale-2026',
    slug: 'summer2026',
    name: 'Steam Summer Sale 2026',
    type: 'seasonal',
    source: 'known-schedule',
    startDate: '2026-06-25',
    endDate: '2026-07-09',
    url: 'https://store.steampowered.com/sale/summer2026',
  },
  {
    id: 'autumn-sale-2026',
    slug: 'autumn2026',
    name: 'Steam Autumn Sale 2026',
    type: 'seasonal',
    source: 'known-schedule',
    startDate: '2026-09-29',
    endDate: '2026-10-05',
    url: 'https://store.steampowered.com/sale/autumn2026',
  },
  {
    id: 'winter-sale-2026',
    slug: 'winter2026',
    name: 'Steam Winter Sale 2026',
    type: 'seasonal',
    source: 'known-schedule',
    startDate: '2026-12-17',
    endDate: '2027-01-04',
    url: 'https://store.steampowered.com/sale/winter2026',
  },
];

function extractSaleSlug(url) {
  const match = String(url || '').match(/\/sale\/([^/?#]+)/i);
  return match ? match[1] : null;
}

function parseOgMeta(html) {
  const titleMatch = html.match(/property="og:title"\s+content="([^"]*)"/i);
  const imageMatch = html.match(/property="og:image"\s+content="([^"]*)"/i);
  return {
    name: titleMatch ? titleMatch[1].trim() : null,
    image: imageMatch ? imageMatch[1].trim() : null,
  };
}

async function fetchStoreHtml(url) {
  return scheduleStoreRequest(async () => {
    const res = await fetch(url, {
      headers: {
        'User-Agent': STEAM_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://store.steampowered.com/',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.text();
  });
}

async function fetchFeaturedCategories() {
  return scheduleStoreRequest(() => cachedFetchJson(FEATURED_URL, FEATURED_TTL_MS));
}

function parseSpotlightEvents(payload) {
  const events = [];
  const seenSlugs = new Set();

  const categories = Object.values(payload || {});
  for (const category of categories) {
    if (category?.id !== 'cat_spotlight') continue;

    for (const item of category.items || []) {
      const slug = extractSaleSlug(item.url);
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      events.push({
        id: `sale-${slug}`,
        slug,
        name: item.name || slug,
        image: item.header_image || null,
        url: item.url || SALE_PAGE_URL(slug),
        type: 'sale',
        source: 'steam-api',
        startDate: null,
        endDate: null,
        status: 'active',
      });
    }
  }

  return events;
}

async function enrichSaleEvents(events) {
  const toEnrich = events.filter((e) => e.slug).slice(0, MAX_SALE_ENRICHMENTS);
  const enriched = [...events];

  for (const event of toEnrich) {
    try {
      const html = await fetchStoreHtml(SALE_PAGE_URL(event.slug));
      const og = parseOgMeta(html);
      const idx = enriched.findIndex((e) => e.id === event.id);
      if (idx < 0) continue;

      enriched[idx] = {
        ...enriched[idx],
        name: og.name || enriched[idx].name,
        image: og.image || enriched[idx].image,
      };
    } catch (err) {
      console.warn(`steamEvents: sale enrich failed for ${event.slug}:`, err.message);
    }
  }

  return enriched;
}

function parseDateMs(isoDate) {
  if (!isoDate) return null;
  const ms = Date.parse(`${isoDate}T12:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

function isEventCurrent(event, now) {
  const startMs = parseDateMs(event.startDate);
  const endMs = parseDateMs(event.endDate);
  if (startMs != null && endMs != null) {
    return now >= startMs && now <= endMs + 24 * 60 * 60 * 1000;
  }
  return event.status === 'active';
}

function isEventUpcoming(event, now) {
  const startMs = parseDateMs(event.startDate);
  if (startMs == null) return false;
  return startMs > now;
}

function eventSortKey(event, now) {
  if (isEventCurrent(event, now)) return [0, parseDateMs(event.startDate) ?? 0];
  if (isEventUpcoming(event, now)) return [1, parseDateMs(event.startDate) ?? Number.MAX_SAFE_INTEGER];
  const endMs = parseDateMs(event.endDate);
  if (endMs != null && endMs < now) return [3, endMs];
  if (event.status === 'active') return [0, 0];
  return [2, parseDateMs(event.startDate) ?? Number.MAX_SAFE_INTEGER];
}

function sortEvents(events, now = Date.now()) {
  return events.slice().sort((a, b) => {
    const [aTier, aKey] = eventSortKey(a, now);
    const [bTier, bKey] = eventSortKey(b, now);
    if (aTier !== bTier) return aTier - bTier;
    if (aKey !== bKey) return aKey - bKey;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

function mergeEvents(spotlightEvents, knownEvents) {
  const byId = new Map();

  for (const event of knownEvents) {
    byId.set(event.id, { ...event });
  }

  for (const event of spotlightEvents) {
    const existing = byId.get(event.id);
    if (existing) {
      byId.set(event.id, {
        ...existing,
        name: event.name || existing.name,
        image: event.image || existing.image,
        url: event.url || existing.url,
        status: existing.startDate ? existing.status : 'active',
      });
    } else {
      byId.set(event.id, event);
    }
  }

  return [...byId.values()];
}

function pickFeaturedAndUpcoming(sortedEvents, now = Date.now()) {
  const current = sortedEvents.filter((e) => isEventCurrent(e, now));
  const upcoming = sortedEvents.filter((e) => isEventUpcoming(e, now));

  let nextFeatured = current[0] || upcoming[0] || sortedEvents[0] || null;
  const featuredId = nextFeatured?.id;

  const remainder = sortedEvents.filter((e) => e.id !== featuredId);
  const upcomingList = remainder
    .filter((e) => isEventUpcoming(e, now) || isEventCurrent(e, now))
    .slice(0, 6);

  return { nextFeatured, upcoming: upcomingList };
}

async function syncSteamEventsCore(appId = DEFAULT_APP_ID) {
  const payload = await fetchFeaturedCategories();
  let spotlightEvents = parseSpotlightEvents(payload);
  spotlightEvents = await enrichSaleEvents(spotlightEvents);

  const allEvents = mergeEvents(spotlightEvents, KNOWN_SCHEDULE);
  const sorted = sortEvents(allEvents);
  const { nextFeatured, upcoming } = pickFeaturedAndUpcoming(sorted);

  const db = getFirestore();
  const doc = {
    schemaVersion: 1,
    syncedAt: FieldValue.serverTimestamp(),
    sourceNote:
      'Steam store featuredcategories API + public Next Fest / seasonal schedule (not SteamDB).',
    eventCount: sorted.length,
    events: sorted,
    nextFeatured: nextFeatured || null,
    upcoming,
    spotlightCount: spotlightEvents.length,
  };

  await db.doc(configDocPath(appId, STEAM_EVENTS_DOC_ID)).set(doc, { merge: true });

  return {
    eventCount: sorted.length,
    nextFeaturedId: nextFeatured?.id ?? null,
    upcomingCount: upcoming.length,
    spotlightCount: spotlightEvents.length,
  };
}

async function syncSteamEventsCallable(request) {
  assertAllowedUser(request.auth);
  const appId = request.data?.appId || DEFAULT_APP_ID;

  try {
    return await syncSteamEventsCore(appId);
  } catch (err) {
    console.error('syncSteamEvents failed:', err);
    throw new HttpsError('internal', err.message || 'Failed to sync Steam events.');
  }
}

const syncSteamEvents = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '256MiB',
    cors: true,
  },
  syncSteamEventsCallable
);

module.exports = {
  KNOWN_SCHEDULE,
  syncSteamEventsCore,
  syncSteamEvents,
  parseSpotlightEvents,
  sortEvents,
  pickFeaturedAndUpcoming,
};

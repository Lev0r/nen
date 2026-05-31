/**
 * Developer vetting sources (restricted list for Gemini + deterministic lookups).
 *
 * 1. NE GRAI extension database (ГРАЙ project)
 * 2. Steam curator «Обережно, русняві ігри» (PlayUA) — 42985013
 * 3. Steam curator «Avoid russian games» — 45452241
 * 4. GameDev DOU — context-only (no reliable public search API)
 * 5. OpenCorporates — optional API (OPENCORPORATES_API_KEY)
 */
const { readFileSync, existsSync } = require('fs');
const { join } = require('path');
const { getConfigDocPath } = require('./devBgCheck');

const DATA_DIR = join(__dirname, 'data');

const SOURCE_IDS = {
  NE_GRAI: 'ne_grai',
  CURATOR_PLAYUA: 'curator_playua',
  CURATOR_AVOID_RU: 'curator_avoid_ru',
  DOU: 'gamedev_dou',
  OPENCORPORATES: 'opencorporates',
};

const SOURCE_LABELS = {
  [SOURCE_IDS.NE_GRAI]: 'База даних розширення «НЕ ГРАЙ» (проєкт «ГРАЙ»)',
  [SOURCE_IDS.CURATOR_PLAYUA]:
    'Steam-куратор «Обережно, русняві ігри» (PlayUA)',
  [SOURCE_IDS.CURATOR_AVOID_RU]: 'Steam-куратор «Avoid russian games»',
  [SOURCE_IDS.DOU]: 'GameDev DOU (gamedev.dou.ua)',
  [SOURCE_IDS.OPENCORPORATES]: 'OpenCorporates',
};

const CURATORS = {
  playua: {
    id: '42985013',
    url: 'https://store.steampowered.com/curator/42985013/',
    label: SOURCE_LABELS[SOURCE_IDS.CURATOR_PLAYUA],
    sourceId: SOURCE_IDS.CURATOR_PLAYUA,
  },
  avoidRu: {
    id: '45452241',
    url: 'https://store.steampowered.com/curator/45452241/',
    label: SOURCE_LABELS[SOURCE_IDS.CURATOR_AVOID_RU],
    sourceId: SOURCE_IDS.CURATOR_AVOID_RU,
  },
};

const SOURCE_URLS = {
  [SOURCE_IDS.CURATOR_PLAYUA]: CURATORS.playua.url,
  [SOURCE_IDS.CURATOR_AVOID_RU]: CURATORS.avoidRu.url,
  [SOURCE_IDS.OPENCORPORATES]: 'https://opencorporates.com/',
};

/** Sources that get a clickable citation link in RU alert text. */
const LINKED_SOURCE_IDS = new Set([
  SOURCE_IDS.CURATOR_PLAYUA,
  SOURCE_IDS.CURATOR_AVOID_RU,
  SOURCE_IDS.OPENCORPORATES,
]);

function sourceMarkdownLink(sourceId, label = SOURCE_LABELS[sourceId]) {
  if (!LINKED_SOURCE_IDS.has(sourceId)) return label || '';
  const url = SOURCE_URLS[sourceId];
  if (!url || !label) return label || '';
  return `[${label}](${url})`;
}

function steamAppMarkdownLink(appId) {
  const id = String(appId || '').trim();
  if (!id) return '';
  return `[app/${id}](https://store.steampowered.com/app/${id}/)`;
}

function curatorMarkdownLinks(curatorKeys) {
  return (curatorKeys || [])
    .map((key) => {
      const curator = CURATORS[key];
      if (!curator) return key;
      return `[${curator.label}](${curator.url})`;
    })
    .join('; ');
}

function openCorporatesCompanyUrl(jurisdiction, companyNumber) {
  const j = String(jurisdiction || '').trim().toLowerCase();
  const n = String(companyNumber || '').trim();
  if (j && n) return `https://opencorporates.com/companies/${j}/${n}`;
  return SOURCE_URLS[SOURCE_IDS.OPENCORPORATES];
}

let neGraiSet = null;
let curatorMeta = null;
let curatorDevIndex = null;
let curatorAppIds = null;
let loadedSourcesKey = null;

function applyNeGraiData(data) {
  const names = Array.isArray(data) ? data : data?.names || [];
  neGraiSet = {
    names,
    normalized: new Set(names.map(normalizeDevName).filter(Boolean)),
    updatedAt: data?.updatedAt || null,
    version: data?.version || null,
  };
}

function applyCuratorAppIdsData(data) {
  curatorAppIds = {
    playua: new Set(data?.curators?.playua?.appIds || []),
    avoidRu: new Set(data?.curators?.avoidRu?.appIds || []),
    meta: data?.meta || {},
  };
}

function applyCuratorDevelopersData(data) {
  curatorMeta = data?.meta || {};
  curatorDevIndex = new Map();
  for (const [normalized, entry] of Object.entries(data?.developers || {})) {
    curatorDevIndex.set(normalized, entry);
  }
}

/**
 * Prefer Firestore devBgCheck.sources when present (weekly Cloud Function sync).
 */
async function ensureLiveDevSources(db, appId = 'default_app') {
  if (!db || !appId) return;

  const snap = await db.doc(getConfigDocPath(appId)).get();
  const sources = snap.data()?.devBgCheck?.sources;
  if (!sources) return;

  const syncedAt = sources.syncedAt;
  const key =
    syncedAt && typeof syncedAt.toMillis === 'function'
      ? String(syncedAt.toMillis())
      : String(syncedAt || sources.neGrai?.updatedAt || '');
  if (!key || loadedSourcesKey === key) return;

  if (sources.neGrai?.names?.length) {
    applyNeGraiData(sources.neGrai);
  }
  if (sources.curatorAppIds?.curators) {
    applyCuratorAppIdsData(sources.curatorAppIds);
  }
  if (sources.curatorDevelopers?.developers) {
    applyCuratorDevelopersData(sources.curatorDevelopers);
  }

  loadedSourcesKey = key;
}

function resetDevSourcesCache() {
  neGraiSet = null;
  curatorMeta = null;
  curatorDevIndex = null;
  curatorAppIds = null;
  loadedSourcesKey = null;
}

function loadJson(relativePath, fallback = null) {
  const fullPath = join(DATA_DIR, relativePath);
  if (!existsSync(fullPath)) return fallback;
  return JSON.parse(readFileSync(fullPath, 'utf8'));
}

function normalizeDevName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,'"()]/g, '')
    .replace(/\s+(inc|llc|ltd|corp|corporation|studio|studios|games|entertainment)$/i, '')
    .trim();
}

function namesMatch(a, b) {
  const na = normalizeDevName(a);
  const nb = normalizeDevName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4) {
    if (na.includes(nb) || nb.includes(na)) return true;
  }
  return false;
}

function loadNeGraiSet() {
  if (neGraiSet) return neGraiSet;

  const data = loadJson('ne-grai-russian-publishers.json', { names: [] });
  applyNeGraiData(data);
  return neGraiSet;
}

function loadCuratorAppIds() {
  if (curatorAppIds) return curatorAppIds;

  const data = loadJson('curator-flagged-appids.json', { curators: {}, meta: {} });
  applyCuratorAppIdsData(data);
  return curatorAppIds;
}

function lookupCuratorsByAppId(appId) {
  const sets = loadCuratorAppIds();
  const id = String(appId || '').trim();
  if (!id) return null;

  if (sets.playua.has(id)) {
    return {
      isRussianRelated: true,
      source: SOURCE_IDS.CURATOR_PLAYUA,
      appId: id,
      explanation: `${sourceMarkdownLink(SOURCE_IDS.CURATOR_PLAYUA)}: game ${steamAppMarkdownLink(id)} is on the curator list`,
    };
  }
  if (sets.avoidRu.has(id)) {
    return {
      isRussianRelated: true,
      source: SOURCE_IDS.CURATOR_AVOID_RU,
      appId: id,
      explanation: `${sourceMarkdownLink(SOURCE_IDS.CURATOR_AVOID_RU)}: game ${steamAppMarkdownLink(id)} is on the curator list`,
    };
  }
  return null;
}

function lookupCuratorsByDeveloperApps(developerName, appIds = []) {
  for (const appId of appIds) {
    const hit = lookupCuratorsByAppId(appId);
    if (hit) {
      return {
        ...hit,
        explanation: `${hit.explanation} (developer «${developerName}»)`,
      };
    }
  }
  return null;
}

function loadCuratorIndex() {
  if (curatorDevIndex) return curatorDevIndex;

  const data = loadJson('curator-flagged-developers.json', {
    developers: {},
    meta: {},
  });

  applyCuratorDevelopersData(data);
  return curatorDevIndex;
}

function lookupNeGrai(developerName) {
  const set = loadNeGraiSet();
  const normalized = normalizeDevName(developerName);
  if (set.normalized.has(normalized)) {
    const matched =
      set.names.find((name) => normalizeDevName(name) === normalized) || developerName;
    return {
      isRussianRelated: true,
      source: SOURCE_IDS.NE_GRAI,
      explanation: `${sourceMarkdownLink(SOURCE_IDS.NE_GRAI)}: «${matched}»`,
    };
  }

  for (const name of set.names) {
    if (namesMatch(name, developerName)) {
      return {
        isRussianRelated: true,
        source: SOURCE_IDS.NE_GRAI,
        explanation: `${sourceMarkdownLink(SOURCE_IDS.NE_GRAI)}: «${name}»`,
      };
    }
  }

  return null;
}

function lookupCurators(developerName, options = {}) {
  const appIds = options.appIds || [];
  const byApps = lookupCuratorsByDeveloperApps(developerName, appIds);
  if (byApps) return byApps;

  const index = loadCuratorIndex();
  const normalized = normalizeDevName(developerName);

  const direct = index.get(normalized);
  if (direct) {
    const curatorLinks = curatorMarkdownLinks(direct.curators);
    return {
      isRussianRelated: true,
      source: direct.curators?.includes('playua')
        ? SOURCE_IDS.CURATOR_PLAYUA
        : SOURCE_IDS.CURATOR_AVOID_RU,
      explanation: `${curatorLinks}: «${direct.name || developerName}» (${direct.appCount || 1} curated game(s))`,
    };
  }

  for (const [, entry] of index) {
    if (namesMatch(entry.name, developerName)) {
      const curatorLinks = curatorMarkdownLinks(entry.curators);
      return {
        isRussianRelated: true,
        source: entry.curators?.includes('playua')
          ? SOURCE_IDS.CURATOR_PLAYUA
          : SOURCE_IDS.CURATOR_AVOID_RU,
        explanation: `${curatorLinks}: «${entry.name}» (${entry.appCount || 1} curated game(s))`,
      };
    }
  }

  return null;
}

const RU_JURISDICTIONS = new Set([
  'ru',
  'russia',
  'russian federation',
  'россия',
  'російська федерація',
]);

function summarizeOpenCorporatesCompany(company) {
  const jurisdiction = company?.jurisdiction_code || company?.jurisdiction || '';
  const name = company?.name || company?.company?.name || '';
  const companyNumber = company?.company_number || '';
  const registeredAddress = company?.registered_address_in_full || '';
  return { name, jurisdiction, companyNumber, registeredAddress };
}

async function fetchOpenCorporatesContext(developerName, apiKey) {
  if (!apiKey) {
    return { configured: false, hits: [], excerpt: 'OpenCorporates API key not configured.' };
  }

  const url = new URL('https://api.opencorporates.com/v0.4/companies/search');
  url.searchParams.set('q', developerName);
  url.searchParams.set('format', 'json');
  url.searchParams.set('api_token', apiKey);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      return {
        configured: true,
        hits: [],
        excerpt: `OpenCorporates search failed (${res.status}): ${text.slice(0, 120)}`,
      };
    }

    const data = await res.json();
    const companies = (data?.results?.companies || [])
      .slice(0, 5)
      .map(({ company }) => summarizeOpenCorporatesCompany(company));

    const ruHits = companies.filter((c) =>
      RU_JURISDICTIONS.has(String(c.jurisdiction || '').toLowerCase())
    );

    const excerpt =
      companies.length === 0
        ? `OpenCorporates: no companies found for "${developerName}".`
        : companies
            .map(
              (c) =>
                `- ${c.name} (${c.jurisdiction}${c.companyNumber ? ` #${c.companyNumber}` : ''})`
            )
            .join('\n');

    return { configured: true, hits: companies, ruHits, excerpt };
  } catch (err) {
    return {
      configured: true,
      hits: [],
      excerpt: `OpenCorporates request error: ${err.message}`,
    };
  }
}

function lookupOpenCorporatesDeterministic(ocContext) {
  if (!ocContext?.ruHits?.length) return null;

  const hit = ocContext.ruHits[0];
  const ocUrl = openCorporatesCompanyUrl(hit.jurisdiction, hit.companyNumber);
  return {
    isRussianRelated: true,
    source: SOURCE_IDS.OPENCORPORATES,
    explanation: `[${SOURCE_LABELS[SOURCE_IDS.OPENCORPORATES]}](${ocUrl}): «${hit.name}» registered in ${hit.jurisdiction}`,
  };
}

function buildDeveloperSourceContext(developerName, ocContext, options = {}) {
  const neGrai = lookupNeGrai(developerName);
  const curator = lookupCurators(developerName, options);
  const appIds = options.appIds || [];
  const curatorAppHits = appIds
    .map((appId) => lookupCuratorsByAppId(appId))
    .filter(Boolean);

  const lines = [
    `Studio: "${developerName}"`,
    `1. ${SOURCE_LABELS[SOURCE_IDS.NE_GRAI]}: ${
      neGrai ? `LISTED — ${neGrai.explanation}` : 'not listed'
    }`,
    `2. ${SOURCE_LABELS[SOURCE_IDS.CURATOR_PLAYUA]}: ${
      curator?.source === SOURCE_IDS.CURATOR_PLAYUA
        ? `LISTED — ${curator.explanation}`
        : curatorAppHits.some((h) => h.source === SOURCE_IDS.CURATOR_PLAYUA)
          ? `LISTED — ${curatorAppHits.find((h) => h.source === SOURCE_IDS.CURATOR_PLAYUA).explanation}`
          : 'not on PlayUA curator app list for known game app IDs'
    }`,
    `3. ${SOURCE_LABELS[SOURCE_IDS.CURATOR_AVOID_RU]}: ${
      curator?.source === SOURCE_IDS.CURATOR_AVOID_RU
        ? `LISTED — ${curator.explanation}`
        : curatorAppHits.some((h) => h.source === SOURCE_IDS.CURATOR_AVOID_RU)
          ? `LISTED — ${curatorAppHits.find((h) => h.source === SOURCE_IDS.CURATOR_AVOID_RU).explanation}`
          : 'not on Avoid russian games curator app list for known game app IDs'
    }`,
    `4. ${SOURCE_LABELS[SOURCE_IDS.DOU]}: no automated search API — only cite if explicit excerpt is provided below.`,
    `5. ${SOURCE_LABELS[SOURCE_IDS.OPENCORPORATES]}:\n${ocContext?.excerpt || 'not queried'}`,
  ];

  return {
    developerName,
    neGrai,
    curator,
    ocContext,
    contextText: lines.join('\n'),
  };
}

/**
 * Deterministic lookup across bundled/API sources. Returns null if inconclusive.
 */
async function lookupDeterministicSources(developerName, options = {}) {
  const neGrai = lookupNeGrai(developerName);
  if (neGrai) return neGrai;

  const curator = lookupCurators(developerName, options);
  if (curator) return curator;

  if (options.openCorporatesApiKey) {
    const ocContext = await fetchOpenCorporatesContext(
      developerName,
      options.openCorporatesApiKey
    );
    const ocHit = lookupOpenCorporatesDeterministic(ocContext);
    if (ocHit) return ocHit;
  }

  return null;
}

function allBundledSourcesNegative(developerName, options = {}) {
  return !lookupNeGrai(developerName) && !lookupCurators(developerName, options);
}

function getSourceMetadata() {
  loadNeGraiSet();
  const appIds = loadCuratorAppIds();
  loadCuratorIndex();
  return {
    neGrai: {
      count: loadNeGraiSet().names.length,
      updatedAt: loadNeGraiSet().updatedAt,
      version: loadNeGraiSet().version,
    },
    curators: {
      appIdsUpdatedAt: appIds.meta?.updatedAt || null,
      playuaAppCount: appIds.playua.size,
      avoidRuAppCount: appIds.avoidRu.size,
      devIndexCount: curatorDevIndex?.size || 0,
      devIndexUpdatedAt: curatorMeta?.updatedAt || null,
    },
  };
}

module.exports = {
  SOURCE_IDS,
  SOURCE_LABELS,
  SOURCE_URLS,
  CURATORS,
  normalizeDevName,
  namesMatch,
  loadNeGraiSet,
  loadCuratorAppIds,
  loadCuratorIndex,
  lookupNeGrai,
  lookupCurators,
  lookupCuratorsByAppId,
  lookupCuratorsByDeveloperApps,
  fetchOpenCorporatesContext,
  lookupOpenCorporatesDeterministic,
  buildDeveloperSourceContext,
  lookupDeterministicSources,
  allBundledSourcesNegative,
  getSourceMetadata,
  ensureLiveDevSources,
  resetDevSourcesCache,
};

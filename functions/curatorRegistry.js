/**
 * Shared Steam curator registry for dev source sync and lookups.
 */
const CURATORS = {
  playua: {
    id: '42985013',
    label: 'Обережно, русняві ігри (PlayUA)',
    sourceLabel: 'Steam-куратор «Обережно, русняві ігри» (PlayUA)',
  },
  avoidRu: {
    id: '45452241',
    label: 'Avoid russian games',
    sourceLabel: 'Steam-куратор «Avoid russian games»',
  },
  sich1: {
    id: '37941500',
    label: 'Sich — Ukrainian Spirit (1/5)',
    sourceLabel: 'Steam-куратор «Sich — Ukrainian Spirit» (1/5)',
  },
  sich2: {
    id: '44677918',
    label: 'Sich — Ukrainian Spirit (2/5)',
    sourceLabel: 'Steam-куратор «Sich — Ukrainian Spirit» (2/5)',
  },
  sich3: {
    id: '45525669',
    label: 'Sich — Ukrainian Spirit (3/5)',
    sourceLabel: 'Steam-куратор «Sich — Ukrainian Spirit» (3/5)',
  },
  sich4: {
    id: '45830587',
    label: 'Sich — Ukrainian Spirit (4/5)',
    sourceLabel: 'Steam-куратор «Sich — Ukrainian Spirit» (4/5)',
  },
  sich5: {
    id: '45985173',
    label: 'Sich — Ukrainian Spirit (5/5)',
    sourceLabel: 'Steam-куратор «Sich — Ukrainian Spirit» (5/5)',
  },
};

for (const [key, curator] of Object.entries(CURATORS)) {
  curator.sourceId = `curator_${key}`;
  curator.url = `https://store.steampowered.com/curator/${curator.id}/`;
}

const CURATOR_KEYS = Object.freeze(Object.keys(CURATORS));

function getCuratorKeys() {
  return CURATOR_KEYS;
}

function getCurator(key) {
  return CURATORS[key] || null;
}

function getCuratorSourceIds() {
  /** @type {Record<string, string>} */
  const ids = {};
  for (const key of CURATOR_KEYS) {
    ids[key.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '')] = CURATORS[key].sourceId;
  }
  return ids;
}

function buildCuratorSourceLabels() {
  /** @type {Record<string, string>} */
  const labels = {};
  for (const curator of Object.values(CURATORS)) {
    labels[curator.sourceId] = curator.sourceLabel;
  }
  return labels;
}

function buildCuratorSourceUrls() {
  /** @type {Record<string, string>} */
  const urls = {};
  for (const curator of Object.values(CURATORS)) {
    urls[curator.sourceId] = curator.url;
  }
  return urls;
}

function primaryCuratorSourceId(curatorKeys) {
  for (const key of curatorKeys || []) {
    const curator = CURATORS[key];
    if (curator?.sourceId) return curator.sourceId;
  }
  return null;
}

module.exports = {
  CURATORS,
  getCuratorKeys,
  getCurator,
  getCuratorSourceIds,
  buildCuratorSourceLabels,
  buildCuratorSourceUrls,
  primaryCuratorSourceId,
};

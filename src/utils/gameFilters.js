import { resolveLibraryState } from './libraryState';
import { isRuDeveloperAlert } from './gameHelpers';
import {
  getGameName,
  getDevelopmentStatus,
  getSteamTags,
  getIsOnSale,
  isFreeToPlay,
} from './gameAccessors';

const EMPTY_PAIR = { include: [], exclude: [] };

export const DEFAULT_GAME_FILTERS = {
  searchText: '',
  libraryStates: { include: [], exclude: [] },
  developmentStatuses: { include: [], exclude: [] },
  steamTags: { include: [], exclude: [] },
  ownerships: { include: [], exclude: [] },
  onSaleOnly: 'off',
  gfnOnly: 'off',
  updateAvailableOnly: 'off',
  ruOnly: 'off',
};

export function cloneGameFilters(filters = DEFAULT_GAME_FILTERS) {
  return {
    searchText: filters.searchText ?? '',
    libraryStates: {
      include: [...(filters.libraryStates?.include ?? [])],
      exclude: [...(filters.libraryStates?.exclude ?? [])],
    },
    developmentStatuses: {
      include: [...(filters.developmentStatuses?.include ?? [])],
      exclude: [...(filters.developmentStatuses?.exclude ?? [])],
    },
    steamTags: {
      include: [...(filters.steamTags?.include ?? [])],
      exclude: [...(filters.steamTags?.exclude ?? [])],
    },
    ownerships: {
      include: [...(filters.ownerships?.include ?? [])],
      exclude: [...(filters.ownerships?.exclude ?? [])],
    },
    onSaleOnly: filters.onSaleOnly ?? 'off',
    gfnOnly: filters.gfnOnly ?? 'off',
    updateAvailableOnly: filters.updateAvailableOnly ?? 'off',
    ruOnly: filters.ruOnly ?? 'off',
  };
}

export function cycleChipState(current) {
  if (current === 'off') return 'include';
  if (current === 'include') return 'exclude';
  return 'off';
}

export function getValueTriState(pair, value) {
  const include = pair?.include ?? [];
  const exclude = pair?.exclude ?? [];
  if (include.includes(value)) return 'include';
  if (exclude.includes(value)) return 'exclude';
  return 'off';
}

export function applyChipTriState(pair, value, nextState) {
  const include = [...(pair?.include ?? [])].filter((item) => item !== value);
  const exclude = [...(pair?.exclude ?? [])].filter((item) => item !== value);
  if (nextState === 'include') include.push(value);
  if (nextState === 'exclude') exclude.push(value);
  return { include, exclude };
}

export function filtersForSidebarNav(activeTab, activeSubTab = 'active') {
  const base = cloneGameFilters();
  if (activeTab === 'active' && activeSubTab === 'tba') {
    return {
      ...base,
      libraryStates: { include: ['active'], exclude: [] },
      developmentStatuses: { include: ['tba'], exclude: [] },
    };
  }
  if (activeTab === 'active' && activeSubTab === 'active') {
    return {
      ...base,
      libraryStates: { include: ['active'], exclude: [] },
      developmentStatuses: { include: [], exclude: ['tba'] },
    };
  }
  return {
    ...base,
    libraryStates: { include: [activeTab], exclude: [] },
  };
}

export function getOwnershipCategory(owned) {
  const user0 = Boolean(owned?.user0);
  const user1 = Boolean(owned?.user1);

  if (user0 && user1) return 'both';
  if (user0 || user1) return 'one';
  return 'neither';
}

export function getEffectiveOwnership(game) {
  if (isFreeToPlay(game)) return 'both';
  return getOwnershipCategory(game?.owned);
}

function hasTriStateArrayActivity(pair) {
  return (pair?.include?.length ?? 0) > 0 || (pair?.exclude?.length ?? 0) > 0;
}

export function hasActiveFilters(filters) {
  return (
    Boolean(filters.searchText?.trim()) ||
    hasTriStateArrayActivity(filters.steamTags) ||
    hasTriStateArrayActivity(filters.developmentStatuses) ||
    hasTriStateArrayActivity(filters.ownerships) ||
    hasTriStateArrayActivity(filters.libraryStates) ||
    filters.onSaleOnly !== 'off' ||
    filters.gfnOnly !== 'off' ||
    filters.updateAvailableOnly !== 'off' ||
    filters.ruOnly !== 'off'
  );
}

function matchesTriStateArray(gameValue, pair) {
  const include = pair?.include ?? [];
  const exclude = pair?.exclude ?? [];
  if (include.length > 0 && !include.includes(gameValue)) {
    return false;
  }
  if (exclude.length > 0 && exclude.includes(gameValue)) {
    return false;
  }
  return true;
}

function matchesOnSaleCondition(game) {
  if (!getIsOnSale(game)) return false;
  if (getEffectiveOwnership(game) === 'both') return false;
  return true;
}

function matchesFooterTriState(condition, state) {
  if (state === 'include') return condition;
  if (state === 'exclude') return !condition;
  return true;
}

export function filterGames(games, filters, gfnSteamAppIds = new Set()) {
  const searchText = filters.searchText?.trim().toLowerCase() ?? '';

  return games.filter((game) => {
    if (searchText && !getGameName(game).toLowerCase().includes(searchText)) {
      return false;
    }

    if (!matchesTriStateArray(resolveLibraryState(game), filters.libraryStates)) {
      return false;
    }

    if (!matchesTriStateArray(getDevelopmentStatus(game), filters.developmentStatuses)) {
      return false;
    }

    if (!matchesTriStateArray(getEffectiveOwnership(game), filters.ownerships)) {
      return false;
    }

    const gameTags = getSteamTags(game);
    const tagPair = filters.steamTags ?? EMPTY_PAIR;
    const tagInclude = tagPair.include ?? [];
    const tagExclude = tagPair.exclude ?? [];
    if (tagInclude.length > 0 && !tagInclude.some((tag) => gameTags.includes(tag))) {
      return false;
    }
    if (tagExclude.length > 0 && tagExclude.some((tag) => gameTags.includes(tag))) {
      return false;
    }

    if (!matchesFooterTriState(matchesOnSaleCondition(game), filters.onSaleOnly ?? 'off')) {
      return false;
    }

    if (
      !matchesFooterTriState(gfnSteamAppIds.has(String(game.id)), filters.gfnOnly ?? 'off')
    ) {
      return false;
    }

    if (
      !matchesFooterTriState(
        game.hasUpdateSinceState === true,
        filters.updateAvailableOnly ?? 'off'
      )
    ) {
      return false;
    }

    if (!matchesFooterTriState(isRuDeveloperAlert(game), filters.ruOnly ?? 'off')) {
      return false;
    }

    return true;
  });
}

const EXCLUDED_STEAM_FILTER_TAGS = new Set([
  'co-op',
  'multi-player',
  'online co-op',
  'split screen co-op',
  'shared/split screen co-op',
  'cross-platform multiplayer',
  'early access',
]);

function isExcludedSteamFilterTag(tag) {
  const normalized = tag.toLowerCase();
  if (EXCLUDED_STEAM_FILTER_TAGS.has(normalized)) return true;
  if (normalized.includes('co-op') || normalized.includes('coop')) return true;
  if (normalized.includes('multi-player') || normalized.includes('multiplayer')) return true;
  return false;
}

export function countGamesForFilterOption(games, filters, gfnSteamAppIds, overrides) {
  return filterGames(games, { ...filters, ...overrides }, gfnSteamAppIds).length;
}

export function isLibraryStateFilterEnabled(games, filters, gfnSteamAppIds, state) {
  if (getValueTriState(filters.libraryStates, state) !== 'off') return true;
  return (
    countGamesForFilterOption(games, filters, gfnSteamAppIds, {
      libraryStates: applyChipTriState(filters.libraryStates ?? EMPTY_PAIR, state, 'include'),
    }) > 0
  );
}

export function isDevelopmentStatusFilterEnabled(games, filters, gfnSteamAppIds, status) {
  if (getValueTriState(filters.developmentStatuses, status) !== 'off') return true;
  return (
    countGamesForFilterOption(games, filters, gfnSteamAppIds, {
      developmentStatuses: applyChipTriState(
        filters.developmentStatuses ?? EMPTY_PAIR,
        status,
        'include'
      ),
    }) > 0
  );
}

export function isOwnershipFilterEnabled(games, filters, gfnSteamAppIds, ownership) {
  if (getValueTriState(filters.ownerships, ownership) !== 'off') return true;
  return (
    countGamesForFilterOption(games, filters, gfnSteamAppIds, {
      ownerships: applyChipTriState(filters.ownerships ?? EMPTY_PAIR, ownership, 'include'),
    }) > 0
  );
}

export function isSteamTagFilterEnabled(games, filters, gfnSteamAppIds, tag) {
  if (getValueTriState(filters.steamTags, tag) !== 'off') return true;
  return (
    countGamesForFilterOption(games, filters, gfnSteamAppIds, {
      steamTags: applyChipTriState(filters.steamTags ?? EMPTY_PAIR, tag, 'include'),
    }) > 0
  );
}

export function isFooterFilterEnabled(games, filters, gfnSteamAppIds, key) {
  if (filters[key] !== 'off') return true;
  return countGamesForFilterOption(games, filters, gfnSteamAppIds, { [key]: 'include' }) > 0;
}

/**
 * Tags for the filter chip cloud — only from games matching `filters` (Steam tag
 * selection cleared so the cloud reflects the current nav + other filters).
 */
export function collectSteamTags(games, filters = null, gfnSteamAppIds = new Set()) {
  const pool =
    filters != null
      ? filterGames(games, { ...filters, steamTags: EMPTY_PAIR }, gfnSteamAppIds)
      : games;

  const tagSet = new Set();
  for (const game of pool) {
    for (const tag of getSteamTags(game)) {
      if (!isExcludedSteamFilterTag(tag)) {
        tagSet.add(tag);
      }
    }
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b));
}

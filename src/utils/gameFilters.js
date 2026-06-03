import { resolveLibraryState } from './libraryState';
import { isRuDeveloperAlert } from './gameHelpers';
import {
  getGameName,
  getDevelopmentStatus,
  getSteamTags,
  getIsOnSale,
  isFreeToPlay,
} from './gameAccessors';

export const DEFAULT_GAME_FILTERS = {
  searchText: '',
  steamTags: [],
  developmentStatuses: [],
  excludeDevelopmentStatuses: [],
  ownerships: [],
  onSaleOnly: false,
  gfnOnly: false,
  updateAvailableOnly: false,
  ruOnly: false,
  libraryStates: [],
};

export function filtersForSidebarNav(activeTab, activeSubTab = 'active') {
  const base = { ...DEFAULT_GAME_FILTERS };
  if (activeTab === 'active' && activeSubTab === 'tba') {
    return {
      ...base,
      libraryStates: ['active'],
      developmentStatuses: ['tba'],
    };
  }
  if (activeTab === 'active' && activeSubTab === 'active') {
    return {
      ...base,
      libraryStates: ['active'],
      excludeDevelopmentStatuses: ['tba'],
    };
  }
  return {
    ...base,
    libraryStates: [activeTab],
  };
}

function sortedArrayKey(arr) {
  return [...(arr ?? [])].sort().join('\0');
}

export function filtersMatchNavPreset(filters, activeTab, activeSubTab = 'active') {
  const preset = filtersForSidebarNav(activeTab, activeSubTab);
  return (
    (filters.searchText?.trim() ?? '') === (preset.searchText?.trim() ?? '') &&
    sortedArrayKey(filters.steamTags) === sortedArrayKey(preset.steamTags) &&
    sortedArrayKey(filters.developmentStatuses) ===
      sortedArrayKey(preset.developmentStatuses) &&
    sortedArrayKey(filters.excludeDevelopmentStatuses) ===
      sortedArrayKey(preset.excludeDevelopmentStatuses) &&
    sortedArrayKey(filters.ownerships) === sortedArrayKey(preset.ownerships) &&
    Boolean(filters.onSaleOnly) === Boolean(preset.onSaleOnly) &&
    Boolean(filters.gfnOnly) === Boolean(preset.gfnOnly) &&
    Boolean(filters.updateAvailableOnly) === Boolean(preset.updateAvailableOnly) &&
    Boolean(filters.ruOnly) === Boolean(preset.ruOnly) &&
    sortedArrayKey(filters.libraryStates) === sortedArrayKey(preset.libraryStates)
  );
}

export function hasFiltersBeyondNavPreset(filters, activeTab, activeSubTab = 'active') {
  return !filtersMatchNavPreset(filters, activeTab, activeSubTab);
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

export function hasActiveFilters(filters) {
  return (
    Boolean(filters.searchText?.trim()) ||
    (filters.steamTags?.length ?? 0) > 0 ||
    (filters.developmentStatuses?.length ?? 0) > 0 ||
    (filters.ownerships?.length ?? 0) > 0 ||
    Boolean(filters.onSaleOnly) ||
    Boolean(filters.gfnOnly) ||
    Boolean(filters.updateAvailableOnly) ||
    Boolean(filters.ruOnly) ||
    (filters.libraryStates?.length ?? 0) > 0
  );
}

export function filterGames(games, filters, gfnSteamAppIds = new Set()) {
  const searchText = filters.searchText?.trim().toLowerCase() ?? '';
  const selectedTags = filters.steamTags ?? [];
  const developmentStatuses = filters.developmentStatuses ?? [];
  const excludeDevelopmentStatuses = filters.excludeDevelopmentStatuses ?? [];
  const ownerships = filters.ownerships ?? [];
  const onSaleOnly = Boolean(filters.onSaleOnly);
  const gfnOnly = Boolean(filters.gfnOnly);
  const updateAvailableOnly = Boolean(filters.updateAvailableOnly);
  const ruOnly = Boolean(filters.ruOnly);
  const libraryStates = filters.libraryStates ?? [];

  return games.filter((game) => {
    if (searchText && !getGameName(game).toLowerCase().includes(searchText)) {
      return false;
    }

    if (selectedTags.length > 0) {
      const gameTags = getSteamTags(game);
      const hasMatchingTag = selectedTags.some((tag) => gameTags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    if (
      developmentStatuses.length > 0 &&
      !developmentStatuses.includes(getDevelopmentStatus(game))
    ) {
      return false;
    }

    if (
      excludeDevelopmentStatuses.length > 0 &&
      excludeDevelopmentStatuses.includes(getDevelopmentStatus(game))
    ) {
      return false;
    }

    if (ownerships.length > 0 && !ownerships.includes(getEffectiveOwnership(game))) {
      return false;
    }

    if (onSaleOnly) {
      if (!getIsOnSale(game)) {
        return false;
      }
      if (getEffectiveOwnership(game) === 'both') {
        return false;
      }
    }

    if (gfnOnly && !gfnSteamAppIds.has(String(game.id))) {
      return false;
    }

    if (updateAvailableOnly && game.hasUpdateSinceState !== true) {
      return false;
    }

    if (ruOnly && !isRuDeveloperAlert(game)) {
      return false;
    }

    if (
      libraryStates.length > 0 &&
      !libraryStates.includes(resolveLibraryState(game))
    ) {
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
  if (filters.libraryStates?.includes(state)) return true;
  return (
    countGamesForFilterOption(games, filters, gfnSteamAppIds, { libraryStates: [state] }) > 0
  );
}

export function isDevelopmentStatusFilterEnabled(games, filters, gfnSteamAppIds, status) {
  if (filters.developmentStatuses?.includes(status)) return true;
  return (
    countGamesForFilterOption(games, filters, gfnSteamAppIds, { developmentStatuses: [status] }) >
    0
  );
}

export function isOwnershipFilterEnabled(games, filters, gfnSteamAppIds, ownership) {
  if (filters.ownerships?.includes(ownership)) return true;
  return countGamesForFilterOption(games, filters, gfnSteamAppIds, { ownerships: [ownership] }) > 0;
}

export function isSteamTagFilterEnabled(games, filters, gfnSteamAppIds, tag) {
  if (filters.steamTags?.includes(tag)) return true;
  return countGamesForFilterOption(games, filters, gfnSteamAppIds, { steamTags: [tag] }) > 0;
}

export function isBooleanFilterEnabled(games, filters, gfnSteamAppIds, key) {
  if (Boolean(filters[key])) return true;
  return countGamesForFilterOption(games, filters, gfnSteamAppIds, { [key]: true }) > 0;
}

/**
 * Tags for the filter chip cloud — only from games matching `filters` (Steam tag
 * selection cleared so the cloud reflects the current nav + other filters).
 */
export function collectSteamTags(games, filters = null, gfnSteamAppIds = new Set()) {
  const pool =
    filters != null
      ? filterGames(games, { ...filters, steamTags: [] }, gfnSteamAppIds)
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

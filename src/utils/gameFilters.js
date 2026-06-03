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
  developmentStatus: 'all',
  ownership: 'all',
  onSaleOnly: false,
  gfnOnly: false,
  updateAvailableOnly: false,
  ruOnly: false,
  libraryStates: [],
};

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
    (filters.developmentStatus && filters.developmentStatus !== 'all') ||
    (filters.ownership && filters.ownership !== 'all') ||
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
  const developmentStatus = filters.developmentStatus ?? 'all';
  const ownership = filters.ownership ?? 'all';
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

    if (developmentStatus !== 'all' && getDevelopmentStatus(game) !== developmentStatus) {
      return false;
    }

    if (ownership !== 'all' && getEffectiveOwnership(game) !== ownership) {
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
  if ((filters.developmentStatus ?? 'all') === status) return true;
  return (
    countGamesForFilterOption(games, filters, gfnSteamAppIds, { developmentStatus: status }) > 0
  );
}

export function isOwnershipFilterEnabled(games, filters, gfnSteamAppIds, ownership) {
  if ((filters.ownership ?? 'all') === ownership) return true;
  return countGamesForFilterOption(games, filters, gfnSteamAppIds, { ownership }) > 0;
}

export function isSteamTagFilterEnabled(games, filters, gfnSteamAppIds, tag) {
  if (filters.steamTags?.includes(tag)) return true;
  return countGamesForFilterOption(games, filters, gfnSteamAppIds, { steamTags: [tag] }) > 0;
}

export function isBooleanFilterEnabled(games, filters, gfnSteamAppIds, key) {
  if (Boolean(filters[key])) return true;
  return countGamesForFilterOption(games, filters, gfnSteamAppIds, { [key]: true }) > 0;
}

export function collectSteamTags(games) {
  const tagSet = new Set();
  for (const game of games) {
    for (const tag of getSteamTags(game)) {
      if (!isExcludedSteamFilterTag(tag)) {
        tagSet.add(tag);
      }
    }
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b));
}

import { resolveLibraryState } from './libraryState';
import { isRuDeveloperAlert } from './gameHelpers';
import {
  getGameName,
  getDevelopmentStatus,
  getSteamTags,
  getIsOnSale,
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

    if (ownership !== 'all' && getOwnershipCategory(game.owned) !== ownership) {
      return false;
    }

    if (onSaleOnly && !getIsOnSale(game)) {
      return false;
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

export function collectSteamTags(games) {
  const tagSet = new Set();
  for (const game of games) {
    for (const tag of getSteamTags(game)) {
      tagSet.add(tag);
    }
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b));
}

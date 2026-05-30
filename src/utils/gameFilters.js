import { resolveLibraryState } from './libraryState';

export const DEFAULT_GAME_FILTERS = {
  searchText: '',
  steamTags: [],
  developmentStatus: 'all',
  ownership: 'all',
  onSaleOnly: false,
  gfnOnly: false,
  updateAvailableOnly: false,
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
  const libraryStates = filters.libraryStates ?? [];

  return games.filter((game) => {
    if (searchText && !game.name?.toLowerCase().includes(searchText)) {
      return false;
    }

    if (selectedTags.length > 0) {
      const gameTags = game.steamTags ?? [];
      const hasMatchingTag = selectedTags.some((tag) => gameTags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    if (developmentStatus !== 'all' && game.developmentStatus !== developmentStatus) {
      return false;
    }

    if (ownership !== 'all' && getOwnershipCategory(game.owned) !== ownership) {
      return false;
    }

    if (onSaleOnly && !game.isOnSale) {
      return false;
    }

    if (gfnOnly && !gfnSteamAppIds.has(String(game.id))) {
      return false;
    }

    if (updateAvailableOnly && game.hasUpdateSinceState !== true) {
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
    for (const tag of game.steamTags ?? []) {
      tagSet.add(tag);
    }
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b));
}

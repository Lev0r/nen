import React, { useEffect, useRef } from 'react';
import useMatchMedia from '../hooks/useMatchMedia';
import {
  hasActiveFilters,
  cycleChipState,
  getValueTriState,
  applyChipTriState,
  isFooterFilterEnabled,
} from '../utils/gameFilters';
import GameFiltersPanelContent from './GameFiltersPanelContent';
import FilterSheetModal from './FilterSheetModal';

const MOBILE_MEDIA = '(max-width: 768px)';

export default function GameFiltersBar({
  filters,
  onChange,
  filterSourceGames,
  allGames,
  gfnSteamAppIds = new Set(),
  availableTags,
  resultCount,
  totalCount,
  filterMode = false,
  showClearFilters = false,
  onResetFilters,
  hideSearch = false,
  filtersExpanded = false,
  onFiltersExpandedChange,
  filterSheetOpen = false,
  onFilterSheetOpenChange,
}) {
  const active = hasActiveFilters(filters);
  const facetGating = filterMode;
  const chipEnabled = (fn, ...args) => (facetGating ? fn(...args) : true);
  const barRef = useRef(null);
  const isMobile = useMatchMedia(MOBILE_MEDIA);

  const setExpanded = (value) => {
    if (onFiltersExpandedChange) {
      onFiltersExpandedChange(value);
    }
  };
  const expanded = filtersExpanded;

  const setFilterSheetOpen = (value) => {
    if (onFilterSheetOpenChange) {
      onFilterSheetOpenChange(value);
    }
  };

  const applyFilterPatch = (patch) => {
    onChange({ ...filters, ...patch });
  };

  const updateFilter = (patch) => {
    if (!isMobile) {
      setExpanded(true);
    }
    applyFilterPatch(patch);
  };

  useEffect(() => {
    if (isMobile) return undefined;

    const handlePointerDown = (event) => {
      if (barRef.current && !barRef.current.contains(event.target)) {
        if (event.target.closest('.sidebar, .sidebar-drawer-root, .filter-sheet-root')) {
          return;
        }
        setExpanded(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile]);

  const cycleDimensionValue = (dimensionKey, value) => {
    const pair = filters[dimensionKey] ?? { include: [], exclude: [] };
    const nextState = cycleChipState(getValueTriState(pair, value));
    updateFilter({ [dimensionKey]: applyChipTriState(pair, value, nextState) });
  };

  const cycleDimensionValueInSheet = (dimensionKey, value) => {
    const pair = filters[dimensionKey] ?? { include: [], exclude: [] };
    const nextState = cycleChipState(getValueTriState(pair, value));
    applyFilterPatch({ [dimensionKey]: applyChipTriState(pair, value, nextState) });
  };

  const clearFilters = () => {
    if (onResetFilters) {
      onResetFilters();
    }
    setExpanded(false);
    setFilterSheetOpen(false);
  };

  const cycleFooterFilter = (key) => {
    if (!chipEnabled(isFooterFilterEnabled, filterSourceGames, filters, gfnSteamAppIds, key)) {
      return;
    }
    updateFilter({ [key]: cycleChipState(filters[key] ?? 'off') });
  };

  const cycleFooterFilterInSheet = (key) => {
    if (!chipEnabled(isFooterFilterEnabled, filterSourceGames, filters, gfnSteamAppIds, key)) {
      return;
    }
    applyFilterPatch({ [key]: cycleChipState(filters[key] ?? 'off') });
  };

  const panelProps = {
    filters,
    filterSourceGames,
    allGames,
    gfnSteamAppIds,
    availableTags,
    facetGating,
  };

  return (
    <div className="game-filters-bar glass-panel" ref={barRef}>
      <div
        className={`game-filters-header${hideSearch ? ' game-filters-header--search-hidden' : ''}`}
      >
        {!hideSearch && (
          <div className="game-filters-search-row">
            <svg
              className="game-filters-search-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="11"
                cy="11"
                r="6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M16 16l4.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              className="game-filters-search-input"
              placeholder="Search"
              value={filters.searchText}
              onChange={(event) => updateFilter({ searchText: event.target.value })}
              onFocus={() => setExpanded(true)}
              aria-label="Search games by name"
              aria-expanded={expanded}
            />
          </div>
        )}

        <div className="game-filters-header-actions">
          <span className="game-filters-count">
            {resultCount} of {totalCount}
          </span>
          {isMobile && (
            <button
              type="button"
              className="btn-secondary game-filters-open"
              onClick={() => setFilterSheetOpen(true)}
              aria-expanded={filterSheetOpen}
              aria-controls="game-filters-sheet"
            >
              Filters{active ? ' · on' : ''}
            </button>
          )}
          {showClearFilters && !isMobile && (
            <button
              type="button"
              className="btn-secondary game-filters-clear"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {!isMobile && (
        <div
          id="game-filters-panel"
          className={`game-filters-expanded${expanded ? ' game-filters-expanded--open' : ''}`}
        >
          <div className="game-filters-expanded-inner">
            <div className="game-filters-expanded-header">
              <button
                type="button"
                className="game-filters-collapse"
                onClick={() => setExpanded(false)}
                aria-label="Collapse filters"
              >
                ×
              </button>
            </div>
            <GameFiltersPanelContent
              {...panelProps}
              onCycleDimensionValue={cycleDimensionValue}
              onCycleFooterFilter={cycleFooterFilter}
            />
          </div>
        </div>
      )}

      {isMobile && (
        <FilterSheetModal
          open={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          resultCount={resultCount}
          totalCount={totalCount}
          showClearFilters={showClearFilters}
          onClearFilters={clearFilters}
        >
          <GameFiltersPanelContent
            {...panelProps}
            onCycleDimensionValue={cycleDimensionValueInSheet}
            onCycleFooterFilter={cycleFooterFilterInSheet}
          />
        </FilterSheetModal>
      )}
    </div>
  );
}

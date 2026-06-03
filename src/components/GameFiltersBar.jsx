import React, { useEffect, useRef, useState } from 'react';
import {
  hasActiveFilters,
  isLibraryStateFilterEnabled,
  isDevelopmentStatusFilterEnabled,
  isOwnershipFilterEnabled,
  isSteamTagFilterEnabled,
  isFooterFilterEnabled,
  cycleChipState,
  getValueTriState,
  applyChipTriState,
} from '../utils/gameFilters';
import { LIBRARY_STATES, getLibraryStateLabel } from '../utils/libraryState';

const DEVELOPMENT_STATUS_OPTIONS = [
  { value: 'released', label: 'Released' },
  { value: 'early_access', label: 'Early Access' },
  { value: 'tba', label: 'TBA' },
];

const OWNERSHIP_OPTIONS = [
  { value: 'neither', label: 'Neither' },
  { value: 'one', label: 'One owns' },
  { value: 'both', label: 'Both own' },
];

const FOOTER_FILTERS = [
  { key: 'onSaleOnly', label: 'On sale only' },
  { key: 'gfnOnly', label: 'GeForce NOW' },
  { key: 'ruOnly', label: 'RU alert' },
  { key: 'updateAvailableOnly', label: 'Update available' },
];

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
  expandFiltersSignal = 0,
}) {
  const active = hasActiveFilters(filters);
  const facetGating = filterMode;
  const chipEnabled = (fn, ...args) => (facetGating ? fn(...args) : true);
  const barRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MEDIA).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!isMobile && active) {
      setExpanded(true);
    }
  }, [active, isMobile]);

  useEffect(() => {
    if (expandFiltersSignal > 0) {
      setExpanded(true);
    }
  }, [expandFiltersSignal]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (barRef.current && !barRef.current.contains(event.target)) {
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
  }, []);

  const updateFilter = (patch) => {
    setExpanded(true);
    onChange({ ...filters, ...patch });
  };

  const cycleDimensionValue = (dimensionKey, value) => {
    const pair = filters[dimensionKey] ?? { include: [], exclude: [] };
    const nextState = cycleChipState(getValueTriState(pair, value));
    updateFilter({ [dimensionKey]: applyChipTriState(pair, value, nextState) });
  };

  const clearFilters = () => {
    if (onResetFilters) {
      onResetFilters();
    }
    setExpanded(false);
  };

  const cycleFooterFilter = (key) => {
    if (!chipEnabled(isFooterFilterEnabled, filterSourceGames, filters, gfnSteamAppIds, key)) {
      return;
    }
    updateFilter({ [key]: cycleChipState(filters[key] ?? 'off') });
  };

  const chipClassName = (triState, enabled) => {
    let cls = 'filter-chip';
    if (triState === 'include') cls += ' filter-chip--include';
    else if (triState === 'exclude') cls += ' filter-chip--exclude';
    if (!enabled) cls += ' filter-chip--disabled';
    return cls;
  };

  const footerSwitchClassName = (triState, enabled) => {
    let cls = 'game-filters-switch';
    if (triState === 'include') cls += ' game-filters-switch--include';
    else if (triState === 'exclude') cls += ' game-filters-switch--exclude';
    if (!enabled) cls += ' game-filters-switch--disabled';
    return cls;
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
              onClick={() => setExpanded(true)}
              aria-expanded={expanded}
              aria-controls="game-filters-panel"
            >
              Filters{active ? ' · on' : ''}
            </button>
          )}
          {showClearFilters && (
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
          <div className="game-filters-groups">
            <div className="game-filters-group">
              <span className="game-filters-label">Lifecycle</span>
              <div className="game-filters-chips">
                {LIBRARY_STATES.map((state) => {
                  const triState = getValueTriState(filters.libraryStates, state);
                  const enabled = chipEnabled(
                    isLibraryStateFilterEnabled,
                    allGames,
                    filters,
                    gfnSteamAppIds,
                    state
                  );
                  return (
                    <button
                      key={state}
                      type="button"
                      className={chipClassName(triState, enabled)}
                      disabled={!enabled}
                      aria-pressed={triState !== 'off'}
                      onClick={() => enabled && cycleDimensionValue('libraryStates', state)}
                    >
                      {getLibraryStateLabel(state)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="game-filters-group">
              <span className="game-filters-label">Status</span>
              <div className="game-filters-chips">
                {DEVELOPMENT_STATUS_OPTIONS.map((option) => {
                  const triState = getValueTriState(
                    filters.developmentStatuses,
                    option.value
                  );
                  const enabled = chipEnabled(
                    isDevelopmentStatusFilterEnabled,
                    filterSourceGames,
                    filters,
                    gfnSteamAppIds,
                    option.value
                  );
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={chipClassName(triState, enabled)}
                      disabled={!enabled}
                      aria-pressed={triState !== 'off'}
                      onClick={() =>
                        enabled && cycleDimensionValue('developmentStatuses', option.value)
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="game-filters-group">
              <span className="game-filters-label">Ownership</span>
              <div className="game-filters-chips">
                {OWNERSHIP_OPTIONS.map((option) => {
                  const triState = getValueTriState(filters.ownerships, option.value);
                  const enabled = chipEnabled(
                    isOwnershipFilterEnabled,
                    filterSourceGames,
                    filters,
                    gfnSteamAppIds,
                    option.value
                  );
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={chipClassName(triState, enabled)}
                      disabled={!enabled}
                      aria-pressed={triState !== 'off'}
                      onClick={() =>
                        enabled && cycleDimensionValue('ownerships', option.value)
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {availableTags.length > 0 && (
              <div className="game-filters-group game-filters-group--tags">
                <span className="game-filters-label">Steam tags</span>
                <div className="game-filters-chips game-filters-chips--tags">
                  {availableTags.map((tag) => {
                    const triState = getValueTriState(filters.steamTags, tag);
                    const enabled = chipEnabled(
                      isSteamTagFilterEnabled,
                      filterSourceGames,
                      filters,
                      gfnSteamAppIds,
                      tag
                    );
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`${chipClassName(triState, enabled)} filter-chip--tag`}
                        disabled={!enabled}
                        aria-pressed={triState !== 'off'}
                        onClick={() => enabled && cycleDimensionValue('steamTags', tag)}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="game-filters-footer">
            {FOOTER_FILTERS.map(({ key, label }) => {
              const triState = filters[key] ?? 'off';
              const enabled = chipEnabled(
                isFooterFilterEnabled,
                filterSourceGames,
                filters,
                gfnSteamAppIds,
                key
              );
              return (
                <button
                  key={key}
                  type="button"
                  className={footerSwitchClassName(triState, enabled)}
                  aria-pressed={triState !== 'off'}
                  disabled={!enabled}
                  onClick={() => cycleFooterFilter(key)}
                >
                  <span className="game-filters-switch-label">{label}</span>
                  <span className="game-filters-switch-track" aria-hidden="true">
                    <span className="game-filters-switch-thumb" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

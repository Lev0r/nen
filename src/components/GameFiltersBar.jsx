import React, { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_GAME_FILTERS,
  hasActiveFilters,
  isLibraryStateFilterEnabled,
  isDevelopmentStatusFilterEnabled,
  isOwnershipFilterEnabled,
  isSteamTagFilterEnabled,
  isBooleanFilterEnabled,
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

const FOOTER_BOOLEAN_FILTERS = [
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

  const toggleSteamTag = (tag) => {
    const current = filters.steamTags ?? [];
    const next = current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag];
    updateFilter({ steamTags: next });
  };

  const toggleLibraryState = (state) => {
    const current = filters.libraryStates ?? [];
    const next = current.includes(state)
      ? current.filter((item) => item !== state)
      : [...current, state];
    updateFilter({ libraryStates: next });
  };

  const toggleDevelopmentStatus = (status) => {
    const current = filters.developmentStatuses ?? [];
    const next = current.includes(status)
      ? current.filter((item) => item !== status)
      : [...current, status];
    updateFilter({ developmentStatuses: next });
  };

  const toggleOwnership = (ownership) => {
    const current = filters.ownerships ?? [];
    const next = current.includes(ownership)
      ? current.filter((item) => item !== ownership)
      : [...current, ownership];
    updateFilter({ ownerships: next });
  };

  const clearFilters = () => {
    onChange({ ...DEFAULT_GAME_FILTERS });
    setExpanded(false);
  };

  const toggleBooleanFilter = (key) => {
    if (!chipEnabled(isBooleanFilterEnabled, filterSourceGames, filters, gfnSteamAppIds, key))
      return;
    updateFilter({ [key]: !Boolean(filters[key]) });
  };

  const chipClassName = (active, enabled) =>
    `filter-chip${active ? ' filter-chip--active' : ''}${
      enabled ? '' : ' filter-chip--disabled'
    }`;

  return (
    <div className="game-filters-bar glass-panel" ref={barRef}>
      <div className="game-filters-header">
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
          {active && (
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
                  const active = filters.libraryStates?.includes(state);
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
                      className={chipClassName(active, enabled)}
                      disabled={!enabled}
                      onClick={() => enabled && toggleLibraryState(state)}
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
                  const active = filters.developmentStatuses?.includes(option.value);
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
                      className={chipClassName(active, enabled)}
                      disabled={!enabled}
                      onClick={() => enabled && toggleDevelopmentStatus(option.value)}
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
                  const active = filters.ownerships?.includes(option.value);
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
                      className={chipClassName(active, enabled)}
                      disabled={!enabled}
                      onClick={() => enabled && toggleOwnership(option.value)}
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
                    const active = filters.steamTags?.includes(tag);
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
                        className={`${chipClassName(active, enabled)} filter-chip--tag`}
                        disabled={!enabled}
                        onClick={() => enabled && toggleSteamTag(tag)}
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
            {FOOTER_BOOLEAN_FILTERS.map(({ key, label }) => {
              const on = Boolean(filters[key]);
              const enabled = chipEnabled(
                isBooleanFilterEnabled,
                filterSourceGames,
                filters,
                gfnSteamAppIds,
                key
              );
              return (
                <button
                  key={key}
                  type="button"
                  className={`game-filters-switch${on ? ' game-filters-switch--on' : ''}${
                    enabled ? '' : ' game-filters-switch--disabled'
                  }`}
                  aria-pressed={on}
                  disabled={!enabled}
                  onClick={() => toggleBooleanFilter(key)}
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

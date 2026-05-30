import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_GAME_FILTERS, hasActiveFilters } from '../utils/gameFilters';
import { LIBRARY_STATES, getLibraryStateLabel } from '../utils/libraryState';

const DEVELOPMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'released', label: 'Released' },
  { value: 'early_access', label: 'Early Access' },
  { value: 'tba', label: 'TBA' },
];

const OWNERSHIP_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'neither', label: 'Neither' },
  { value: 'one', label: 'One owns' },
  { value: 'both', label: 'Both own' },
];

export default function GameFiltersBar({ filters, onChange, availableTags, resultCount, totalCount }) {
  const active = hasActiveFilters(filters);
  const barRef = useRef(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (active) {
      setExpanded(true);
    }
  }, [active]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (barRef.current && !barRef.current.contains(event.target)) {
        if (!hasActiveFilters(filters)) {
          setExpanded(false);
        }
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filters]);

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

  const clearFilters = () => {
    onChange({ ...DEFAULT_GAME_FILTERS });
    setExpanded(false);
  };

  const toggleBooleanFilter = (key) => {
    updateFilter({ [key]: !Boolean(filters[key]) });
  };

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

      <div className={`game-filters-expanded${expanded ? ' game-filters-expanded--open' : ''}`}>
        <div className="game-filters-expanded-inner">
          <div className="game-filters-groups">
            <div className="game-filters-group">
              <span className="game-filters-label">Lifecycle</span>
              <div className="game-filters-chips">
                {LIBRARY_STATES.map((state) => (
                  <button
                    key={state}
                    type="button"
                    className={`filter-chip ${
                      filters.libraryStates?.includes(state) ? 'filter-chip--active' : ''
                    }`}
                    onClick={() => toggleLibraryState(state)}
                  >
                    {getLibraryStateLabel(state)}
                  </button>
                ))}
              </div>
            </div>

            <div className="game-filters-group">
              <span className="game-filters-label">Status</span>
              <div className="game-filters-chips">
                {DEVELOPMENT_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`filter-chip ${filters.developmentStatus === option.value ? 'filter-chip--active' : ''}`}
                    onClick={() => updateFilter({ developmentStatus: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="game-filters-group">
              <span className="game-filters-label">Ownership</span>
              <div className="game-filters-chips">
                {OWNERSHIP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`filter-chip ${filters.ownership === option.value ? 'filter-chip--active' : ''}`}
                    onClick={() => updateFilter({ ownership: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {availableTags.length > 0 && (
              <div className="game-filters-group game-filters-group--tags">
                <span className="game-filters-label">Steam tags</span>
                <div className="game-filters-chips game-filters-chips--tags">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`filter-chip filter-chip--tag ${
                        filters.steamTags?.includes(tag) ? 'filter-chip--active' : ''
                      }`}
                      onClick={() => toggleSteamTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="game-filters-footer">
            <button
              type="button"
              className={`game-filters-switch${filters.onSaleOnly ? ' game-filters-switch--on' : ''}`}
              aria-pressed={Boolean(filters.onSaleOnly)}
              onClick={() => toggleBooleanFilter('onSaleOnly')}
            >
              <span className="game-filters-switch-label">On sale only</span>
              <span className="game-filters-switch-track" aria-hidden="true">
                <span className="game-filters-switch-thumb" />
              </span>
            </button>

            <button
              type="button"
              className={`game-filters-switch${filters.gfnOnly ? ' game-filters-switch--on' : ''}`}
              aria-pressed={Boolean(filters.gfnOnly)}
              onClick={() => toggleBooleanFilter('gfnOnly')}
            >
              <span className="game-filters-switch-label">GeForce NOW</span>
              <span className="game-filters-switch-track" aria-hidden="true">
                <span className="game-filters-switch-thumb" />
              </span>
            </button>

            <button
              type="button"
              className={`game-filters-switch${filters.updateAvailableOnly ? ' game-filters-switch--on' : ''}`}
              aria-pressed={Boolean(filters.updateAvailableOnly)}
              onClick={() => toggleBooleanFilter('updateAvailableOnly')}
            >
              <span className="game-filters-switch-label">Update available</span>
              <span className="game-filters-switch-track" aria-hidden="true">
                <span className="game-filters-switch-thumb" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { DEFAULT_GAME_FILTERS, hasActiveFilters } from '../utils/gameFilters';

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

  const updateFilter = (patch) => {
    onChange({ ...filters, ...patch });
  };

  const toggleSteamTag = (tag) => {
    const current = filters.steamTags ?? [];
    const next = current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag];
    updateFilter({ steamTags: next });
  };

  const clearFilters = () => {
    onChange({ ...DEFAULT_GAME_FILTERS });
  };

  return (
    <div className="game-filters-bar glass-panel">
      <div className="game-filters-row game-filters-row--primary">
        <label className="game-filters-search">
          <span className="game-filters-label">Search</span>
          <input
            type="search"
            className="game-filters-search-input"
            placeholder="Filter by name..."
            value={filters.searchText}
            onChange={(event) => updateFilter({ searchText: event.target.value })}
          />
        </label>

        <div className="game-filters-meta">
          <label className="game-filters-switch">
            <span className="game-filters-switch-label">On sale only</span>
            <input
              type="checkbox"
              className="game-filters-switch-input"
              checked={Boolean(filters.onSaleOnly)}
              onChange={(event) => updateFilter({ onSaleOnly: event.target.checked })}
            />
            <span className="game-filters-switch-track" aria-hidden="true">
              <span className="game-filters-switch-thumb" />
            </span>
          </label>

          <span className="game-filters-count">
            {resultCount} of {totalCount}
          </span>
          {active && (
            <button type="button" className="btn-secondary game-filters-clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="game-filters-groups">
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
    </div>
  );
}

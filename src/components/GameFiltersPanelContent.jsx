import React from 'react';
import {
  isLibraryStateFilterEnabled,
  isDevelopmentStatusFilterEnabled,
  isOwnershipFilterEnabled,
  isSteamTagFilterEnabled,
  isFooterFilterEnabled,
  getValueTriState,
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

export default function GameFiltersPanelContent({
  filters,
  filterSourceGames,
  allGames,
  gfnSteamAppIds = new Set(),
  availableTags,
  facetGating = false,
  onCycleDimensionValue,
  onCycleFooterFilter,
}) {
  const chipEnabled = (fn, ...args) => (facetGating ? fn(...args) : true);

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
    <>
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
                  onClick={() => enabled && onCycleDimensionValue('libraryStates', state)}
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
              const triState = getValueTriState(filters.developmentStatuses, option.value);
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
                    enabled && onCycleDimensionValue('developmentStatuses', option.value)
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
                  onClick={() => enabled && onCycleDimensionValue('ownerships', option.value)}
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
                    onClick={() => enabled && onCycleDimensionValue('steamTags', tag)}
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
              onClick={() => onCycleFooterFilter(key)}
            >
              <span className="game-filters-switch-label">{label}</span>
              <span className="game-filters-switch-track" aria-hidden="true">
                <span className="game-filters-switch-thumb" />
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

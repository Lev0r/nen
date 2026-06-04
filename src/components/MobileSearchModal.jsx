import React from 'react';

function SearchIcon() {
  return (
    <svg className="app-mobile-header-icon" viewBox="0 0 24 24" aria-hidden="true">
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
  );
}

export default function MobileSearchModal({
  open,
  onClose,
  searchInputRef,
  searchText,
  onSearchTextChange,
  resultCount,
  totalCount,
  showFiltersLink,
  filtersActive,
  onOpenFilters,
}) {
  if (!open) return null;

  return (
    <div className="search-modal-root">
      <button
        type="button"
        className="search-modal-backdrop"
        aria-label="Close search"
        onClick={onClose}
      />
      <div className="search-modal glass-panel" role="dialog" aria-label="Search games">
        <div className="search-modal-header">
          <label className="search-modal-label" htmlFor="mobile-game-search">
            Search
          </label>
          <button
            type="button"
            className="search-modal-close"
            aria-label="Close search"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="search-modal-input-row">
          <SearchIcon />
          <input
            ref={searchInputRef}
            id="mobile-game-search"
            type="search"
            className="game-filters-search-input search-modal-input"
            placeholder="Search games"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
          />
        </div>
        <p className="search-modal-count">
          {resultCount} of {totalCount}
        </p>
        {showFiltersLink && (
          <button
            type="button"
            className="btn-secondary search-modal-filters-link"
            onClick={onOpenFilters}
          >
            Open filters{filtersActive ? ' · on' : ''}
          </button>
        )}
      </div>
    </div>
  );
}

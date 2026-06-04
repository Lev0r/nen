import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function FilterSheetModal({
  open,
  onClose,
  resultCount,
  totalCount,
  showClearFilters,
  onClearFilters,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;

    document.body.classList.add('scroll-locked');

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('scroll-locked');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="filter-sheet-root">
      <button
        type="button"
        className="filter-sheet-backdrop"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div className="filter-sheet" role="dialog" aria-label="Game filters">
        <header className="filter-sheet-header">
          <h2 className="filter-sheet-title">Filters</h2>
          <span className="filter-sheet-count">
            {resultCount} of {totalCount}
          </span>
          <button
            type="button"
            className="filter-sheet-close"
            aria-label="Close filters"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="filter-sheet-body">{children}</div>
        <footer className="filter-sheet-footer">
          {showClearFilters && onClearFilters && (
            <button type="button" className="btn-secondary" onClick={onClearFilters}>
              Clear filters
            </button>
          )}
          <button type="button" className="btn-primary filter-sheet-done" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

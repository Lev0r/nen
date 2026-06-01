import React from 'react';

const STARS = [1, 2, 3, 4, 5];

const RATING_COLORS = {
  1: 'var(--accent-red)',
  2: '#f97316',
  3: 'var(--accent-yellow)',
  4: 'var(--accent-teal)',
  5: 'var(--accent-mint)',
};

export function getFinishedRatingColor(rating) {
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return 'var(--text-muted)';
  }
  return RATING_COLORS[value];
}

export default function FinishedRatingPicker({
  value,
  onChange,
  disabled = false,
  idPrefix = 'finished-rating',
  className = '',
}) {
  const rating = value ?? null;

  return (
    <div className={`finished-rating-picker${className ? ` ${className}` : ''}`}>
      <span className="finished-rating-label" id={`${idPrefix}-label`}>
        Rating <span className="lifecycle-note-optional">(optional)</span>
      </span>
      <div
        className="finished-rating-stars"
        role="group"
        aria-labelledby={`${idPrefix}-label`}
      >
        {STARS.map((star) => (
          <button
            key={star}
            id={`${idPrefix}-star-${star}`}
            type="button"
            className={`finished-rating-star${
              rating != null && star <= rating ? ' finished-rating-star--filled' : ''
            }`}
            onClick={() => onChange(star)}
            disabled={disabled}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            aria-pressed={rating != null && star <= rating}
          >
            ★
          </button>
        ))}
        <button
          type="button"
          className="finished-rating-clear"
          onClick={() => onChange(null)}
          disabled={disabled || rating == null}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export function FinishedRatingDisplay({ rating, className = '' }) {
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 5) return null;

  return (
    <span
      className={`finished-rating-display${className ? ` ${className}` : ''}`}
      title={`Rated ${value}/5`}
      aria-label={`Rated ${value} out of 5 stars`}
    >
      <span className="finished-rating-display-filled" aria-hidden="true">
        {'★'.repeat(value)}
      </span>
      <span className="finished-rating-display-empty" aria-hidden="true">
        {'☆'.repeat(5 - value)}
      </span>
    </span>
  );
}

export function FinishedRatingMetaDigit({ rating, className = '', onClick }) {
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 5) return null;

  const color = getFinishedRatingColor(value);

  return (
    <button
      type="button"
      className={`finished-rating-meta-digit${className ? ` ${className}` : ''}`}
      style={{ color }}
      onClick={onClick}
      aria-label={`Finished rating ${value} out of 5. Click to edit.`}
    >
      {value}
    </button>
  );
}

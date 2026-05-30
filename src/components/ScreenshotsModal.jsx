import React, { useState } from 'react';

export default function ScreenshotsModal({ images, gameName, onClose }) {
  const [index, setIndex] = useState(0);
  const list = images?.length ? images : [];

  if (!list.length) return null;

  const prev = () => setIndex((i) => (i === 0 ? list.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === list.length - 1 ? 0 : i + 1));

  return (
    <div className="screenshots-modal-backdrop" onClick={onClose}>
      <div
        className="screenshots-modal glass-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Screenshots for ${gameName}`}
      >
        <div className="screenshots-modal-header">
          <h3>{gameName}</h3>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="screenshots-modal-body">
          <button type="button" className="carousel-nav" onClick={prev} aria-label="Previous">
            ‹
          </button>
          <div className="screenshots-modal-viewport">
            <img
              src={list[index]}
              alt={`Screenshot ${index + 1}`}
              className="screenshots-modal-img"
            />
          </div>
          <button type="button" className="carousel-nav" onClick={next} aria-label="Next">
            ›
          </button>
        </div>
        <p className="screenshots-modal-counter">
          {index + 1} / {list.length}
        </p>
      </div>
    </div>
  );
}

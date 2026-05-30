import React, { useState, useEffect, useCallback } from 'react';

export default function ScreenshotsModal({ images, gameName, onClose }) {
  const [index, setIndex] = useState(0);
  const list = images?.length ? images : [];

  const prev = useCallback(
    () => setIndex((i) => (i === 0 ? list.length - 1 : i - 1)),
    [list.length],
  );
  const next = useCallback(
    () => setIndex((i) => (i === list.length - 1 ? 0 : i + 1)),
    [list.length],
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [prev, next, onClose]);

  if (!list.length) return null;

  return (
    <div
      className="screenshots-fullscreen-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Screenshots for ${gameName}`}
    >
      <img
        key={index}
        src={list[index]}
        alt={`Screenshot ${index + 1} of ${list.length}`}
        className="screenshots-fullscreen-img"
        draggable={false}
      />

      <div className="screenshots-fullscreen-zones" aria-hidden="true">
        <button
          type="button"
          className="screenshots-fullscreen-zone screenshots-fullscreen-zone--prev"
          onClick={prev}
          aria-label="Previous screenshot"
        />
        <button
          type="button"
          className="screenshots-fullscreen-zone screenshots-fullscreen-zone--exit"
          onClick={onClose}
          aria-label="Close fullscreen"
        />
        <button
          type="button"
          className="screenshots-fullscreen-zone screenshots-fullscreen-zone--next"
          onClick={next}
          aria-label="Next screenshot"
        />
      </div>

      <p className="screenshots-fullscreen-counter">
        {index + 1} / {list.length}
      </p>
    </div>
  );
}

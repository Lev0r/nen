import React, { useEffect, useMemo, useState } from 'react';
import { calculateTotalHype } from '../utils/hypeScore';
import { resolveLibraryState } from '../utils/libraryState';

const SLIDE_DURATION_MS = 60000;
const CROSSFADE_DURATION_MS = 4000;

export function isDynamicBackgroundEnabled() {
  return import.meta.env.VITE_ENABLE_DYNAMIC_BG !== 'false';
}

function pickScreenshotUrl(game) {
  const screenshots = game.screenshots;
  if (Array.isArray(screenshots)) {
    const url = screenshots.find(
      (item) => typeof item === 'string' && item.trim()
    );
    if (url) return url.trim();
  }

  if (typeof game.thumbnail === 'string' && game.thumbnail.trim()) {
    return game.thumbnail.trim();
  }

  return null;
}

function buildBackgroundPool(games) {
  if (!Array.isArray(games) || games.length === 0) return [];

  return games
    .filter((game) => resolveLibraryState(game) !== 'banned')
    .map((game) => ({
      imageUrl: pickScreenshotUrl(game),
      hype: calculateTotalHype(game).total,
    }))
    .filter((entry) => entry.imageUrl)
    .sort((a, b) => b.hype - a.hype)
    .slice(0, 5)
    .map(({ imageUrl }) => imageUrl);
}

export default function DynamicBackground({ games }) {
  const images = useMemo(() => buildBackgroundPool(games), [games]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    images.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [images]);

  useEffect(() => {
    if (images.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, SLIDE_DURATION_MS);

    return () => window.clearInterval(timer);
  }, [images.length]);

  if (!isDynamicBackgroundEnabled() || images.length === 0) {
    return null;
  }

  return (
    <div
      className="dynamic-bg"
      aria-hidden="true"
      style={{ '--dynamic-bg-fade-ms': `${CROSSFADE_DURATION_MS}ms` }}
    >
      {images.map((url, index) => (
        <div
          key={url}
          className={`dynamic-bg-layer${index === activeIndex ? ' dynamic-bg-layer--active' : ''}`}
          style={{ backgroundImage: `url("${url}")` }}
        />
      ))}
      <div className="dynamic-bg-overlay" />
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { calculateTotalHype } from '../utils/hypeScore';
import { resolveLibraryState } from '../utils/libraryState';

const SLIDE_DURATION_MS = 60000;
const CROSSFADE_DURATION_MS = 4000;

export function isDynamicBackgroundEnabled() {
  return import.meta.env.VITE_ENABLE_DYNAMIC_BG !== 'false';
}

function buildThumbnailPool(games) {
  if (!Array.isArray(games) || games.length === 0) return [];

  return games
    .filter((game) => resolveLibraryState(game) !== 'banned')
    .filter((game) => typeof game.thumbnail === 'string' && game.thumbnail.trim())
    .map((game) => ({
      thumbnail: game.thumbnail.trim(),
      hype: calculateTotalHype(game).total,
    }))
    .sort((a, b) => b.hype - a.hype)
    .slice(0, 5)
    .map(({ thumbnail }) => thumbnail);
}

export default function DynamicBackground({ games }) {
  const thumbnails = useMemo(() => buildThumbnailPool(games), [games]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    thumbnails.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [thumbnails]);

  useEffect(() => {
    if (thumbnails.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % thumbnails.length);
    }, SLIDE_DURATION_MS);

    return () => window.clearInterval(timer);
  }, [thumbnails.length]);

  if (!isDynamicBackgroundEnabled() || thumbnails.length === 0) {
    return null;
  }

  return (
    <div
      className="dynamic-bg"
      aria-hidden="true"
      style={{ '--dynamic-bg-fade-ms': `${CROSSFADE_DURATION_MS}ms` }}
    >
      {thumbnails.map((url, index) => (
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

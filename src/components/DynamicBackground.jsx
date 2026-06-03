import React from 'react';

const NEBULA_SRC = '/backgrounds/nebula1.webp';

export function isDynamicBackgroundEnabled() {
  return import.meta.env.VITE_ENABLE_DYNAMIC_BG !== 'false';
}

export default function DynamicBackground() {
  if (!isDynamicBackgroundEnabled()) {
    return null;
  }

  return (
    <div className="app-background" aria-hidden="true">
      <div
        className="app-background__image"
        style={{ backgroundImage: `url(${NEBULA_SRC})` }}
      />
      <div className="app-background__overlay" />
    </div>
  );
}

import React from 'react';

export function isDynamicBackgroundEnabled() {
  return import.meta.env.VITE_ENABLE_DYNAMIC_BG !== 'false';
}

export default function DynamicBackground({ games }) {
  void games;

  if (!isDynamicBackgroundEnabled()) {
    return null;
  }

  return (
    <div className="dynamic-bg" aria-hidden="true">
      <div className="dynamic-bg-base" />
      <div className="dynamic-bg-sheen" />
      <div className="dynamic-bg-wave dynamic-bg-wave--a" />
      <div className="dynamic-bg-wave dynamic-bg-wave--b" />
      <div className="dynamic-bg-wave dynamic-bg-wave--c" />
      <div className="dynamic-bg-overlay" />
    </div>
  );
}

import React, { useEffect, useRef } from 'react';
import { HYPE_TIERS } from '../utils/hypeScore';
import useOutsidePointerDismiss, { useOpenGrace } from '../hooks/useOutsidePointerDismiss';

const TIER_ORDER = ['worthless_crystal', 'morkite_found', 'we_rich'];

export default function HypePicker({ currentTier, onSelect, onClose, anchorRect }) {
  const ref = useRef(null);
  const withinOpenGrace = useOpenGrace();

  useOutsidePointerDismiss(ref, onClose);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const style = anchorRect
    ? {
        position: 'fixed',
        top: Math.min(anchorRect.bottom + 8, window.innerHeight - 200),
        left: Math.min(anchorRect.left, window.innerWidth - 220),
        zIndex: 1000,
      }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000 };

  return (
    <div
      className="hype-picker-backdrop"
      onClick={() => {
        if (!withinOpenGrace()) onClose();
      }}
    >
      <div
        ref={ref}
        className="hype-picker glass-panel"
        style={style}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choose personal hype tier"
      >
        <p className="hype-picker-title">Personal hype</p>
        {TIER_ORDER.map((tier) => (
          <button
            key={tier}
            type="button"
            className={`hype-picker-option ${currentTier === tier ? 'active' : ''}`}
            onClick={() => {
              onSelect(tier);
              onClose();
            }}
          >
            {HYPE_TIERS[tier].label}
          </button>
        ))}
      </div>
    </div>
  );
}

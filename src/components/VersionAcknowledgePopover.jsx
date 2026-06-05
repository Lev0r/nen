import React, { useEffect, useRef } from 'react';
import useOutsidePointerDismiss, { useOpenGrace } from '../hooks/useOutsidePointerDismiss';

export default function VersionAcknowledgePopover({
  anchorRect,
  onConfirm,
  onClose,
  saving = false,
}) {
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
        top: Math.min(anchorRect.bottom + 8, window.innerHeight - 120),
        left: Math.min(anchorRect.left, window.innerWidth - 200),
        zIndex: 1000,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
      };

  return (
    <div
      className="version-ack-backdrop"
      onClick={() => {
        if (!withinOpenGrace()) onClose();
      }}
    >
      <div
        ref={ref}
        className="version-ack-popover glass-panel"
        style={style}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Acknowledge update"
      >
        <p className="version-ack-popover-text">Acknowledge?</p>
        <button
          type="button"
          className="btn-primary version-ack-popover-btn"
          onClick={onConfirm}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Yes'}
        </button>
      </div>
    </div>
  );
}

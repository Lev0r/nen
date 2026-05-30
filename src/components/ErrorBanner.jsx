import React, { useEffect } from 'react';

export default function ErrorBanner({
  message,
  onDismiss,
  autoDismissMs = 8000,
  fixed = false,
}) {
  useEffect(() => {
    if (!message || !autoDismissMs || !onDismiss) {
      return undefined;
    }
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [message, autoDismissMs, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <div
      className={`error-banner ${fixed ? 'error-banner--fixed' : 'error-banner--inline'}`}
      role="alert"
    >
      <span className="error-banner-message">{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="error-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  );
}

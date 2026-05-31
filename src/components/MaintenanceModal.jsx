import React, { useEffect } from 'react';
import { formatDateTime } from '../utils/formatDuration';

export default function MaintenanceModal({
  isOpen,
  onClose,
  errors,
  onAcknowledge,
  canAcknowledge,
  syncingMeta,
  syncingGfn,
  onLoadMeta,
  onSyncGfn,
  metaSyncedAtLabel,
  gfnSyncedAtLabel,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel animate-fade-in maintenance-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Maintenance"
      >
        <h2 className="maintenance-modal-title">Maintenance</h2>
        <p className="maintenance-modal-desc">
          Load external metadata and review sync issues across your library.
        </p>

        <section className="maintenance-section">
          <h3 className="maintenance-section-title">Data loads</h3>
          <div className="maintenance-actions">
            <button
              type="button"
              className="btn-secondary maintenance-action-btn"
              onClick={onLoadMeta}
              disabled={syncingMeta || syncingGfn}
            >
              <span className="maintenance-action-label">
                {syncingMeta ? 'Loading…' : 'Load meta info'}
              </span>
              {metaSyncedAtLabel && !syncingMeta && (
                <span className="maintenance-action-meta">Last load {metaSyncedAtLabel}</span>
              )}
            </button>
            <button
              type="button"
              className="btn-secondary maintenance-action-btn"
              onClick={onSyncGfn}
              disabled={syncingMeta || syncingGfn}
            >
              <span className="maintenance-action-label">
                {syncingGfn ? 'Syncing…' : 'Sync GeForce NOW'}
              </span>
              {gfnSyncedAtLabel && !syncingGfn && (
                <span className="maintenance-action-meta">Last sync {gfnSyncedAtLabel}</span>
              )}
            </button>
          </div>
        </section>

        <section className="maintenance-section maintenance-section--errors" aria-live="polite">
          <div className="maintenance-section-header">
            <h3 className="maintenance-section-title maintenance-section-title--warning">
              Errors
            </h3>
            {canAcknowledge && (
              <button
                type="button"
                className="btn-secondary maintenance-ack-btn"
                onClick={onAcknowledge}
              >
                Acknowledge current errors
              </button>
            )}
          </div>

          {errors.length === 0 ? (
            <p className="maintenance-empty">No errors recorded.</p>
          ) : (
            <ul className="maintenance-errors-list">
              {errors.map((entry) => {
                const when = formatDateTime(entry.at);
                const context =
                  entry.scope === 'game'
                    ? entry.gameName
                    : entry.scope === 'library'
                      ? 'Library'
                      : 'Action';

                return (
                  <li key={entry.id} className="maintenance-error-item">
                    <div className="maintenance-error-head">
                      <span className="maintenance-error-label">{entry.label}</span>
                      {when && <time className="maintenance-error-at">{when}</time>}
                    </div>
                    <p className="maintenance-error-context">{context}</p>
                    <p className="maintenance-error-message">{entry.message}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="maintenance-modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

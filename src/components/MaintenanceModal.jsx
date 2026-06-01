import React, { useEffect, useMemo } from 'react';
import { formatErrorDateTime } from '../utils/formatDuration';
import {
  groupAppErrors,
  formatErrorLine,
  countErrorsBySeverity,
} from '../utils/appErrors';

function isSyncBusy({ syncingMeta, syncingGfn, syncingDevSources, reVettingGames }) {
  return syncingMeta || syncingGfn || syncingDevSources || reVettingGames;
}

export default function MaintenanceModal({
  isOpen,
  onClose,
  errors,
  onAcknowledge,
  canAcknowledge,
  onClearInfo,
  canClearInfo,
  clearingInfo,
  syncingMeta,
  syncingGfn,
  syncingDevSources = false,
  reVettingGames = false,
  onLoadMeta,
  onSyncGfn,
  onSyncDevSources,
  onRevetAllGames,
  metaSyncedAtLabel,
  gfnSyncedAtLabel,
  devSourcesSyncedAtLabel,
  devSourceSummary,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const groupedErrors = useMemo(() => groupAppErrors(errors), [errors]);
  const severityCounts = useMemo(() => countErrorsBySeverity(errors), [errors]);
  const hasActionableErrors = severityCounts.error + severityCounts.warning > 0;
  const syncBusy = isSyncBusy({ syncingMeta, syncingGfn, syncingDevSources, reVettingGames });

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
              disabled={syncBusy || clearingInfo}
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
              disabled={syncBusy || clearingInfo}
            >
              <span className="maintenance-action-label">
                {syncingGfn ? 'Syncing…' : 'Sync GeForce NOW'}
              </span>
              {gfnSyncedAtLabel && !syncingGfn && (
                <span className="maintenance-action-meta">Last sync {gfnSyncedAtLabel}</span>
              )}
            </button>
            {onSyncDevSources && (
              <button
                type="button"
                className="btn-secondary maintenance-action-btn"
                onClick={onSyncDevSources}
                disabled={syncBusy || clearingInfo}
              >
                <span className="maintenance-action-label">
                  {syncingDevSources ? 'Syncing…' : 'Sync dev sources'}
                </span>
                {devSourcesSyncedAtLabel && !syncingDevSources && (
                  <span className="maintenance-action-meta">
                    Last sync {devSourcesSyncedAtLabel}
                  </span>
                )}
              </button>
            )}
            {onRevetAllGames && (
              <button
                type="button"
                className="btn-secondary maintenance-action-btn"
                onClick={onRevetAllGames}
                disabled={syncBusy || clearingInfo}
              >
                <span className="maintenance-action-label">
                  {reVettingGames ? 'Re-vetting…' : 'Re-vet all games'}
                </span>
              </button>
            )}
          </div>

          {devSourceSummary && (
            <div className="maintenance-dev-sources">
              <p className="maintenance-dev-sources-line">
                NE GRAI names: {devSourceSummary.neGraiCount}
              </p>
              {devSourceSummary.curatorRows?.length > 0 ? (
                <ul className="maintenance-curator-list">
                  {devSourceSummary.curatorRows.map((row) => (
                    <li key={row.key} className="maintenance-curator-item">
                      <span className="maintenance-curator-label">{row.label}</span>
                      <span className="maintenance-curator-counts">
                        {row.flaggedCount} flagged · {row.clearedCount} cleared
                      </span>
                      <span
                        className={`maintenance-curator-status ${
                          row.complete
                            ? 'maintenance-curator-status--complete'
                            : 'maintenance-curator-status--pending'
                        }`}
                      >
                        {row.complete ? 'Complete' : 'In progress'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="maintenance-dev-sources-hint">
                  No curator source data yet — run Sync dev sources.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="maintenance-section maintenance-section--errors" aria-live="polite">
          <div className="maintenance-section-header">
            <h3 className="maintenance-section-title maintenance-section-title--warning">
              Errors
            </h3>
            <div className="maintenance-error-actions">
              {canClearInfo && (
                <button
                  type="button"
                  className="btn-secondary maintenance-clear-info-btn"
                  onClick={onClearInfo}
                  disabled={clearingInfo || syncBusy}
                >
                  {clearingInfo ? 'Clearing…' : 'Clear info'}
                </button>
              )}
              {canAcknowledge && hasActionableErrors && (
                <button
                  type="button"
                  className="btn-secondary maintenance-ack-btn"
                  onClick={onAcknowledge}
                >
                  Acknowledge current errors
                </button>
              )}
            </div>
          </div>

          {errors.length === 0 ? (
            <p className="maintenance-empty">No errors recorded.</p>
          ) : (
            <div className="maintenance-errors-grouped">
              {groupedErrors.map((severityGroup) => (
                <section
                  key={severityGroup.severity}
                  className={`maintenance-severity-group maintenance-severity-group--${severityGroup.severity}`}
                >
                  <h4 className="maintenance-severity-title">{severityGroup.label}</h4>
                  {severityGroup.sources.map((sourceGroup) => (
                    <div key={sourceGroup.source} className="maintenance-source-group">
                      <h5 className="maintenance-source-title">{sourceGroup.label}</h5>
                      <ul className="maintenance-errors-list">
                        {sourceGroup.items.map((entry) => {
                          const line = formatErrorLine(entry, formatErrorDateTime);
                          const itemKey = `${entry.severity}|${entry.source}|${entry.errorKey || entry.message}|${entry.gameId || ''}|${entry.at || ''}`;

                          return (
                            <li key={itemKey} className="maintenance-error-item">
                              <p className="maintenance-error-line">{line}</p>
                              {entry.detail && (
                                <p className="maintenance-error-detail">{entry.detail}</p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
            </div>
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

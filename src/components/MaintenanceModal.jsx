import React, { useEffect, useMemo, useState } from 'react';
import { formatErrorDateTime } from '../utils/formatDuration';
import {
  groupAppErrors,
  formatErrorLine,
  countErrorsBySeverity,
} from '../utils/appErrors';
import { addGameFromSteam, previewSteamGame } from '../services/cloudFunctions';
import { getNickname } from '../utils/userConfig';
import { reportError } from '../utils/errorReport';

const DUPLICATE_MESSAGE = 'This game is already in your library.';

function steamStoreUrl(appId) {
  return `https://store.steampowered.com/app/${appId}/`;
}

function isSyncBusy({
  syncingMeta,
  syncingGfn,
  syncingSteamOwnership,
  syncingSteamWishlists,
  syncingDevSources,
  syncingSteamEvents,
  reVettingGames,
}) {
  return (
    syncingMeta ||
    syncingGfn ||
    syncingSteamOwnership ||
    syncingSteamWishlists ||
    syncingDevSources ||
    syncingSteamEvents ||
    reVettingGames
  );
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
  syncingSteamOwnership = false,
  syncingSteamWishlists = false,
  syncingDevSources = false,
  syncingSteamEvents = false,
  reVettingGames = false,
  onLoadMeta,
  onSyncGfn,
  onSyncSteamOwnership,
  onSyncSteamWishlists,
  onSyncDevSources,
  onSyncSteamEvents,
  onRevetAllGames,
  metaSyncedAtLabel,
  gfnSyncedAtLabel,
  steamOwnershipSyncedAtLabel,
  steamOwnershipSummary,
  steamWishlistSyncedAtLabel,
  steamWishlistSummary,
  wishlistCandidates = [],
  libraryGameIds = new Set(),
  devSourcesSyncedAtLabel,
  devSourceSummary,
  steamEventsSyncedAtLabel,
}) {
  const [addingAppId, setAddingAppId] = useState(null);
  const [addErrorByAppId, setAddErrorByAppId] = useState({});

  useEffect(() => {
    if (!isOpen) {
      setAddingAppId(null);
      setAddErrorByAppId({});
    }
  }, [isOpen]);

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
  const syncBusy = isSyncBusy({
    syncingMeta,
    syncingGfn,
    syncingSteamOwnership,
    syncingSteamWishlists,
    syncingDevSources,
    syncingSteamEvents,
    reVettingGames,
  });

  const isDuplicateAppId = (appId) => libraryGameIds.has(String(appId));

  const clearAddError = (appId) => {
    setAddErrorByAppId((prev) => {
      if (!prev[appId]) return prev;
      const next = { ...prev };
      delete next[appId];
      return next;
    });
  };

  const persistWishlistCandidate = async (previewData, appId) => {
    if (isDuplicateAppId(appId)) {
      setAddErrorByAppId((prev) => ({ ...prev, [appId]: DUPLICATE_MESSAGE }));
      return;
    }

    setAddingAppId(appId);
    clearAddError(appId);
    try {
      const result = await addGameFromSteam(steamStoreUrl(appId), 'default_app', {
        preloadedGame: previewData.game,
        skipScrape: true,
      });
      if (result?.vettingError) {
        setAddErrorByAppId((prev) => ({
          ...prev,
          [appId]: `Game added, but developer source check failed: ${result.vettingError}`,
        }));
      }
    } catch (err) {
      if (err?.code === 'functions/already-exists') {
        setAddErrorByAppId((prev) => ({ ...prev, [appId]: DUPLICATE_MESSAGE }));
      } else {
        const message = reportError('Add wishlist game', err);
        setAddErrorByAppId((prev) => ({ ...prev, [appId]: message }));
      }
    } finally {
      setAddingAppId(null);
    }
  };

  const handleAddWishlistCandidate = async (candidate) => {
    const appId = String(candidate.appId);
    if (addingAppId) return;

    if (isDuplicateAppId(appId)) {
      setAddErrorByAppId((prev) => ({ ...prev, [appId]: DUPLICATE_MESSAGE }));
      return;
    }

    setAddingAppId(appId);
    clearAddError(appId);
    try {
      const previewData = await previewSteamGame(steamStoreUrl(appId));
      if (isDuplicateAppId(previewData.appId)) {
        setAddErrorByAppId((prev) => ({ ...prev, [appId]: DUPLICATE_MESSAGE }));
        return;
      }

      await persistWishlistCandidate(previewData, appId);
    } catch (err) {
      if (err?.code === 'functions/already-exists') {
        setAddErrorByAppId((prev) => ({ ...prev, [appId]: DUPLICATE_MESSAGE }));
      } else {
        const message = reportError('Steam preview', err);
        setAddErrorByAppId((prev) => ({ ...prev, [appId]: message }));
      }
    } finally {
      setAddingAppId((current) => (current === appId ? null : current));
    }
  };

  const formatWishlistUsers = (candidate) => {
    const users = [];
    if (candidate.onWishlistUser0) users.push(getNickname(0));
    if (candidate.onWishlistUser1) users.push(getNickname(1));
    return users.length > 0 ? users.join(', ') : '—';
  };

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
            {onSyncSteamOwnership && (
              <button
                type="button"
                className="btn-secondary maintenance-action-btn"
                onClick={onSyncSteamOwnership}
                disabled={syncBusy || clearingInfo}
              >
                <span className="maintenance-action-label">
                  {syncingSteamOwnership ? 'Syncing…' : 'Sync Steam ownership'}
                </span>
                {steamOwnershipSyncedAtLabel && !syncingSteamOwnership && (
                  <span className="maintenance-action-meta">
                    Last sync {steamOwnershipSyncedAtLabel}
                    {steamOwnershipSummary ? ` · ${steamOwnershipSummary}` : ''}
                  </span>
                )}
              </button>
            )}
            {onSyncSteamWishlists && (
              <button
                type="button"
                className="btn-secondary maintenance-action-btn"
                onClick={onSyncSteamWishlists}
                disabled={syncBusy || clearingInfo}
              >
                <span className="maintenance-action-label">
                  {syncingSteamWishlists ? 'Syncing…' : 'Sync Steam wishlists'}
                </span>
                {steamWishlistSyncedAtLabel && !syncingSteamWishlists && (
                  <span className="maintenance-action-meta">
                    Last sync {steamWishlistSyncedAtLabel}
                    {steamWishlistSummary ? ` · ${steamWishlistSummary}` : ''}
                  </span>
                )}
              </button>
            )}
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
            {onSyncSteamEvents && (
              <button
                type="button"
                className="btn-secondary maintenance-action-btn"
                onClick={onSyncSteamEvents}
                disabled={syncBusy || clearingInfo}
              >
                <span className="maintenance-action-label">
                  {syncingSteamEvents ? 'Syncing…' : 'Sync Steam events'}
                </span>
                {steamEventsSyncedAtLabel && !syncingSteamEvents && (
                  <span className="maintenance-action-meta">
                    Last sync {steamEventsSyncedAtLabel}
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

          {wishlistCandidates.length > 0 && (
            <div className="maintenance-wishlist-candidates">
              <p className="maintenance-wishlist-candidates-title">
                Co-op wishlist candidates ({wishlistCandidates.length})
              </p>
              <ul className="maintenance-wishlist-list">
                {wishlistCandidates.map((candidate) => {
                  const appId = String(candidate.appId);
                  const inLibrary = isDuplicateAppId(appId);
                  const rowError = addErrorByAppId[appId];
                  const isAdding = addingAppId === appId;
                  const displayName = candidate.name?.trim() || `App ${appId}`;

                  return (
                    <li key={appId} className="maintenance-wishlist-item">
                      <div className="maintenance-wishlist-item-main">
                        <a
                          className="maintenance-wishlist-link"
                          href={steamStoreUrl(appId)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {displayName}
                        </a>
                        <span className="maintenance-wishlist-users">
                          {formatWishlistUsers(candidate)}
                        </span>
                        {inLibrary ? (
                          <span className="maintenance-wishlist-status">In library</span>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary maintenance-wishlist-add-btn"
                            onClick={() => handleAddWishlistCandidate(candidate)}
                            disabled={syncBusy || clearingInfo || Boolean(addingAppId)}
                          >
                            {isAdding ? 'Adding…' : 'Add'}
                          </button>
                        )}
                      </div>
                      {rowError && (
                        <p className="maintenance-wishlist-error">{rowError}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
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

import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GameCard from './GameCard';
import AddGameModal from './AddGameModal';
import GameFiltersBar from './GameFiltersBar';
import MaintenanceModal from './MaintenanceModal';
import { useGames, useAppConfig } from '../services/db';
import { syncGfnCatalog, syncSteamLibrary } from '../services/cloudFunctions';
import { getNickname } from '../utils/userConfig';
import {
  LIBRARY_STATES,
  resolveLibraryState,
  getLibraryStateLabel,
} from '../utils/libraryState';
import {
  DEFAULT_GAME_FILTERS,
  filterGames,
  collectSteamTags,
  hasActiveFilters,
} from '../utils/gameFilters';
import { formatRelativeTimeShort } from '../utils/formatDuration';
import { reportError } from '../utils/errorReport';
import {
  collectAppErrors,
  fingerprintAppErrors,
  hasUnacknowledgedErrors,
  readAcknowledgedFingerprint,
  writeAcknowledgedFingerprint,
} from '../utils/appErrors';
import DynamicBackground from './DynamicBackground';

const LIFECYCLE_TABS = LIBRARY_STATES.map((id) => ({
  id,
  label: getLibraryStateLabel(id),
}));

function appendRuntimeError(setter, label, message) {
  setter((prev) => [
    ...prev,
    {
      id: `action-${Date.now()}-${label}`,
      scope: 'action',
      label,
      message,
      at: new Date().toISOString(),
    },
  ]);
}

export default function DashboardShell() {
  const { userIndex, logout } = useAuth();
  const { games, loading, subscriptionError, loadErrors } = useGames('default_app');
  const { config } = useAppConfig('default_app');

  const [activeTab, setActiveTab] = useState('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [gameFilters, setGameFilters] = useState(DEFAULT_GAME_FILTERS);
  const [syncingGfn, setSyncingGfn] = useState(false);
  const [syncingMeta, setSyncingMeta] = useState(false);
  const [runtimeErrors, setRuntimeErrors] = useState([]);
  const [acknowledgedFingerprint, setAcknowledgedFingerprint] = useState(
    readAcknowledgedFingerprint
  );

  const gfnSteamAppIds = useMemo(() => {
    const ids = config?.gfnCatalog?.steamAppIds;
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  }, [config?.gfnCatalog?.steamAppIds]);

  const gfnSyncedAtLabel = useMemo(() => {
    const syncedAt = config?.gfnCatalog?.syncedAt;
    return formatRelativeTimeShort(syncedAt);
  }, [config?.gfnCatalog?.syncedAt]);

  const metaSyncedAtLabel = useMemo(() => {
    const syncedAt = config?.steamLibrarySync?.syncedAt;
    return formatRelativeTimeShort(syncedAt);
  }, [config?.steamLibrarySync?.syncedAt]);

  const appErrors = useMemo(() => {
    const errors = collectAppErrors({ config, games, runtimeErrors });
    if (subscriptionError) {
      errors.unshift({
        id: 'firestore-games-subscription',
        scope: 'library',
        label: 'Firestore',
        message: subscriptionError,
        at: new Date().toISOString(),
      });
    }
    if (loadErrors > 0) {
      errors.unshift({
        id: 'firestore-games-load',
        scope: 'library',
        label: 'Game data',
        message: `${loadErrors} game document(s) could not be loaded — check the browser console.`,
        at: new Date().toISOString(),
      });
    }
    return errors;
  }, [config, games, runtimeErrors, subscriptionError, loadErrors]);

  const errorFingerprint = useMemo(() => fingerprintAppErrors(appErrors), [appErrors]);
  const showErrorDot = hasUnacknowledgedErrors(appErrors, acknowledgedFingerprint);

  async function handleSyncGfn() {
    setSyncingGfn(true);
    try {
      await syncGfnCatalog();
    } catch (err) {
      const message = reportError('Sync GeForce NOW', err);
      appendRuntimeError(setRuntimeErrors, 'Sync GeForce NOW', message);
    } finally {
      setSyncingGfn(false);
    }
  }

  async function handleLoadMeta() {
    setSyncingMeta(true);
    try {
      await syncSteamLibrary();
    } catch (err) {
      const message = reportError('Load meta info', err);
      appendRuntimeError(setRuntimeErrors, 'Load meta info', message);
    } finally {
      setSyncingMeta(false);
    }
  }

  function handleAcknowledgeErrors() {
    writeAcknowledgedFingerprint(errorFingerprint);
    setAcknowledgedFingerprint(errorFingerprint);
  }

  const tabCounts = LIFECYCLE_TABS.reduce((counts, tab) => {
    counts[tab.id] = games.filter(
      (game) => resolveLibraryState(game) === tab.id
    ).length;
    return counts;
  }, {});

  const lifecycleGames = games.filter(
    (game) => resolveLibraryState(game) === activeTab
  );
  const filtersScopeGlobal = hasActiveFilters(gameFilters);
  const filterSourceGames = filtersScopeGlobal ? games : lifecycleGames;
  const filteredGames = filterGames(filterSourceGames, gameFilters, gfnSteamAppIds);
  const availableTags = collectSteamTags(games);
  const filtersActive = hasActiveFilters(gameFilters);
  const activeTabLabel = LIFECYCLE_TABS.find((tab) => tab.id === activeTab)?.label ?? 'Active';

  return (
    <>
      <DynamicBackground games={games} />
      <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 style={{ color: 'var(--accent-mint)' }}>Nen?</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Co-op Tracker</p>
        </div>

        <nav className="sidebar-nav">
          {LIFECYCLE_TABS.map((tab) => (
            <div
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setGameFilters(DEFAULT_GAME_FILTERS);
              }}
            >
              <span>{tab.label}</span>
              <span className="nav-item-badge">{tabCounts[tab.id]}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="btn-primary sidebar-action-btn"
            onClick={() => setIsModalOpen(true)}
          >
            + Add Game
          </button>
          <button
            type="button"
            className="btn-secondary sidebar-action-btn sidebar-maintenance-btn"
            onClick={() => setMaintenanceOpen(true)}
            aria-label={showErrorDot ? 'Maintenance (unacknowledged errors)' : 'Maintenance'}
          >
            <span className="sidebar-maintenance-btn-label">
              Maintenance
              {showErrorDot && (
                <span className="sidebar-maintenance-dot" aria-hidden="true" />
              )}
            </span>
          </button>
          <div className="sidebar-user-row">
            <span className="sidebar-user">{getNickname(userIndex)}</span>
            <button className="btn-secondary sidebar-sign-out" onClick={logout}>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {!loading && games.length > 0 && (
          <GameFiltersBar
            filters={gameFilters}
            onChange={setGameFilters}
            availableTags={availableTags}
            resultCount={filteredGames.length}
            totalCount={filterSourceGames.length}
          />
        )}

        <div className="dashboard-grid">
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading games from Firestore...</p>
          ) : filteredGames.length > 0 ? (
            filteredGames.map((game) => (
              <GameCard key={game.id} game={game} gfnSteamAppIds={gfnSteamAppIds} />
            ))
          ) : (
            <div className="dashboard-empty">
              {games.length === 0 ? (
                <>
                  <p>No games in your library yet.</p>
                  <p className="dashboard-empty-hint">
                    {subscriptionError
                      ? 'Firestore could not load games — open Maintenance for details.'
                      : 'Use + Add Game, or bulk-import with scripts/import-games.mjs using --app-id default_app.'}
                  </p>
                </>
              ) : filterSourceGames.length === 0 ? (
                <>
                  <p>No games in {activeTabLabel}.</p>
                  <p className="dashboard-empty-hint">
                    Your library has {games.length} game{games.length === 1 ? '' : 's'} — check
                    other tabs in the sidebar.
                  </p>
                </>
              ) : filtersActive ? (
                <>
                  <p>No games match your filters.</p>
                  <p className="dashboard-empty-hint">
                    Try clearing filters or adjusting your search.
                  </p>
                  <button
                    type="button"
                    className="btn-secondary dashboard-empty-action"
                    onClick={() => setGameFilters(DEFAULT_GAME_FILTERS)}
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <p>No games in {activeTabLabel}.</p>
                  <p className="dashboard-empty-hint">
                    {games.length} game{games.length === 1 ? '' : 's'} in your library — try another
                    tab or clear filters.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      <AddGameModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        games={games}
      />

      <MaintenanceModal
        isOpen={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
        errors={appErrors}
        canAcknowledge={appErrors.length > 0}
        onAcknowledge={handleAcknowledgeErrors}
        syncingMeta={syncingMeta}
        syncingGfn={syncingGfn}
        onLoadMeta={handleLoadMeta}
        onSyncGfn={handleSyncGfn}
        metaSyncedAtLabel={metaSyncedAtLabel}
        gfnSyncedAtLabel={gfnSyncedAtLabel}
      />
      </div>
    </>
  );
}

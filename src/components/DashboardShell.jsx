import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GameCard from './GameCard';
import AddGameModal from './AddGameModal';
import GameFiltersBar from './GameFiltersBar';
import MaintenanceModal from './MaintenanceModal';
import { useGames, useGfnCatalog, useMaintenanceAudit, useMaintenanceErrors } from '../services/db';
import { syncGfnCatalog, syncSteamLibrary, syncDevSources, revetAllGames, clearMaintenanceInfoErrors } from '../services/cloudFunctions';
import { getNickname } from '../utils/userConfig';
import {
  LIBRARY_STATES,
  resolveLibraryState,
  getLibraryStateLabel,
} from '../utils/libraryState';
import { getDevelopmentStatus } from '../utils/gameAccessors';
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

const ACTIVE_SUB_TABS = [
  { id: 'active', label: 'Active' },
  { id: 'tba', label: 'TBA' },
];

function isActiveLibraryGame(game) {
  return resolveLibraryState(game) === 'active';
}

function isTbaGame(game) {
  return getDevelopmentStatus(game) === 'tba';
}

function matchesActiveSubTab(game, subTab) {
  if (!isActiveLibraryGame(game)) return false;
  return subTab === 'tba' ? isTbaGame(game) : !isTbaGame(game);
}

function appendRuntimeError(setter, source, message) {
  setter((prev) => [
    ...prev,
    {
      severity: 'warning',
      source: 'action',
      message,
      at: new Date().toISOString(),
    },
  ]);
}

export default function DashboardShell() {
  const { userIndex, logout } = useAuth();
  const { games, loading, subscriptionError, loadErrors } = useGames('default_app');
  const { catalog: gfnCatalog } = useGfnCatalog('default_app');
  const { audit: maintenanceAudit } = useMaintenanceAudit('default_app');
  const { errorsDoc: maintenanceErrorsDoc } = useMaintenanceErrors('default_app');

  const [activeTab, setActiveTab] = useState('active');
  const [activeSubTab, setActiveSubTab] = useState('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [gameFilters, setGameFilters] = useState(DEFAULT_GAME_FILTERS);
  const [syncingGfn, setSyncingGfn] = useState(false);
  const [syncingMeta, setSyncingMeta] = useState(false);
  const [syncingDevSources, setSyncingDevSources] = useState(false);
  const [reVettingGames, setReVettingGames] = useState(false);
  const [clearingInfo, setClearingInfo] = useState(false);
  const [runtimeErrors, setRuntimeErrors] = useState([]);
  const [acknowledgedFingerprint, setAcknowledgedFingerprint] = useState(
    readAcknowledgedFingerprint
  );

  const gfnSteamAppIds = useMemo(() => {
    const ids = gfnCatalog?.steamAppIds;
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  }, [gfnCatalog?.steamAppIds]);

  const gfnSyncedAtLabel = useMemo(() => {
    const syncedAt = maintenanceAudit?.gfn?.syncedAt ?? gfnCatalog?.syncedAt;
    return formatRelativeTimeShort(syncedAt);
  }, [maintenanceAudit?.gfn?.syncedAt, gfnCatalog?.syncedAt]);

  const metaSyncedAtLabel = useMemo(() => {
    const syncedAt = maintenanceAudit?.metaLoad?.syncedAt;
    return formatRelativeTimeShort(syncedAt);
  }, [maintenanceAudit?.metaLoad?.syncedAt]);

  const devSourcesSyncedAtLabel = useMemo(() => {
    const syncedAt = maintenanceAudit?.devSources?.syncedAt;
    return formatRelativeTimeShort(syncedAt);
  }, [maintenanceAudit?.devSources?.syncedAt]);

  const devSourceSummary = useMemo(() => {
    const devSources = maintenanceAudit?.devSources;
    if (!devSources) return null;

    const neGraiCount = devSources.neGraiCount ?? 0;
    const curators = devSources.curators || {};
    const curatorRows = Object.entries(curators)
      .map(([key, entry]) => ({
        key,
        label: entry?.label || key,
        flaggedCount: entry?.flaggedCount ?? 0,
        clearedCount: entry?.clearedCount ?? 0,
        complete: Boolean(entry?.complete),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { neGraiCount, curatorRows, pendingCurators: devSources.pendingCurators || [] };
  }, [maintenanceAudit?.devSources]);

  const appErrors = useMemo(() => {
    const errors = collectAppErrors({ errorsDoc: maintenanceErrorsDoc, runtimeErrors });
    if (subscriptionError) {
      errors.unshift({
        severity: 'error',
        source: 'firestore',
        gameName: null,
        gameId: null,
        message: subscriptionError,
        count: 1,
        at: new Date().toISOString(),
        detail: null,
        errorKey: null,
      });
    }
    if (loadErrors > 0) {
      errors.unshift({
        severity: 'warning',
        source: 'game-data',
        gameName: null,
        gameId: null,
        message: `${loadErrors} game document(s) could not be loaded — check the browser console.`,
        count: 1,
        at: new Date().toISOString(),
        detail: null,
        errorKey: null,
      });
    }
    return errors;
  }, [maintenanceErrorsDoc, runtimeErrors, subscriptionError, loadErrors]);

  const errorFingerprint = useMemo(
    () => fingerprintAppErrors(appErrors, { severities: ['error', 'warning'] }),
    [appErrors]
  );
  const showErrorDot = hasUnacknowledgedErrors(appErrors, acknowledgedFingerprint);
  const hasInfoErrors = appErrors.some((entry) => entry.severity === 'info');

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

  async function handleSyncDevSources() {
    setSyncingDevSources(true);
    try {
      await syncDevSources();
    } catch (err) {
      const message = reportError('Sync dev sources', err);
      appendRuntimeError(setRuntimeErrors, 'Sync dev sources', message);
    } finally {
      setSyncingDevSources(false);
    }
  }

  async function handleRevetAllGames() {
    setReVettingGames(true);
    try {
      await revetAllGames();
    } catch (err) {
      const message = reportError('Re-vet all games', err);
      appendRuntimeError(setRuntimeErrors, 'Re-vet all games', message);
    } finally {
      setReVettingGames(false);
    }
  }

  function handleAcknowledgeErrors() {
    writeAcknowledgedFingerprint(errorFingerprint);
    setAcknowledgedFingerprint(errorFingerprint);
  }

  async function handleClearInfo() {
    setClearingInfo(true);
    try {
      await clearMaintenanceInfoErrors('default_app');
    } catch (err) {
      const message = reportError('Clear info errors', err);
      appendRuntimeError(setRuntimeErrors, 'action', message);
    } finally {
      setClearingInfo(false);
    }
  }

  const tabCounts = LIFECYCLE_TABS.reduce((counts, tab) => {
    if (tab.id === 'active') {
      counts[tab.id] = games.filter(
        (game) => isActiveLibraryGame(game) && !isTbaGame(game)
      ).length;
    } else {
      counts[tab.id] = games.filter(
        (game) => resolveLibraryState(game) === tab.id
      ).length;
    }
    return counts;
  }, {});

  const activeSubTabCounts = ACTIVE_SUB_TABS.reduce((counts, subTab) => {
    counts[subTab.id] = games.filter((game) =>
      matchesActiveSubTab(game, subTab.id)
    ).length;
    return counts;
  }, {});

  const lifecycleGames = games.filter((game) => {
    if (activeTab === 'active') {
      return matchesActiveSubTab(game, activeSubTab);
    }
    return resolveLibraryState(game) === activeTab;
  });
  const filtersScopeGlobal = hasActiveFilters(gameFilters);
  const filterSourceGames = filtersScopeGlobal ? games : lifecycleGames;
  const filteredGames = filterGames(filterSourceGames, gameFilters, gfnSteamAppIds);
  const availableTags = collectSteamTags(games);
  const filtersActive = hasActiveFilters(gameFilters);
  const activeTabLabel =
    activeTab === 'active'
      ? ACTIVE_SUB_TABS.find((subTab) => subTab.id === activeSubTab)?.label ?? 'Active'
      : LIFECYCLE_TABS.find((tab) => tab.id === activeTab)?.label ?? 'Active';

  function handleLifecycleTabClick(tabId) {
    setActiveTab(tabId);
    setActiveSubTab('active');
    setGameFilters(DEFAULT_GAME_FILTERS);
  }

  function handleActiveSubTabClick(subTabId) {
    setActiveSubTab(subTabId);
    setGameFilters(DEFAULT_GAME_FILTERS);
  }

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
            <div key={tab.id} className="nav-item-group">
              <div
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleLifecycleTabClick(tab.id)}
              >
                <span>{tab.label}</span>
                <span className="nav-item-badge">{tabCounts[tab.id]}</span>
              </div>
              {tab.id === 'active' && activeTab === 'active' && (
                <div className="nav-sub-nav" role="group" aria-label="Active subcategories">
                  {ACTIVE_SUB_TABS.map((subTab) => (
                    <div
                      key={subTab.id}
                      className={`nav-sub-item ${activeSubTab === subTab.id ? 'active' : ''}`}
                      onClick={() => handleActiveSubTabClick(subTab.id)}
                    >
                      <span>{subTab.label}</span>
                      <span className="nav-item-badge">{activeSubTabCounts[subTab.id]}</span>
                    </div>
                  ))}
                </div>
              )}
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
              <GameCard
                key={game.id}
                game={game}
                gfnSteamAppIds={gfnSteamAppIds}
                showLifecycleBadge={filtersScopeGlobal}
              />
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
        canAcknowledge={appErrors.some(
          (entry) => entry.severity === 'error' || entry.severity === 'warning'
        )}
        onAcknowledge={handleAcknowledgeErrors}
        canClearInfo={hasInfoErrors}
        onClearInfo={handleClearInfo}
        clearingInfo={clearingInfo}
        syncingMeta={syncingMeta}
        syncingGfn={syncingGfn}
        syncingDevSources={syncingDevSources}
        reVettingGames={reVettingGames}
        onLoadMeta={handleLoadMeta}
        onSyncGfn={handleSyncGfn}
        onSyncDevSources={handleSyncDevSources}
        onRevetAllGames={handleRevetAllGames}
        metaSyncedAtLabel={metaSyncedAtLabel}
        gfnSyncedAtLabel={gfnSyncedAtLabel}
        devSourcesSyncedAtLabel={devSourcesSyncedAtLabel}
        devSourceSummary={devSourceSummary}
      />
      </div>
    </>
  );
}

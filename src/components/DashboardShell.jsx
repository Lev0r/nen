import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GameCard from './GameCard';
import AddGameModal from './AddGameModal';
import GameFiltersBar from './GameFiltersBar';
import { useGames, useAppConfig } from '../services/db';
import { syncGfnCatalog } from '../services/cloudFunctions';
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
import { reportError } from '../utils/errorReport';
import ErrorBanner from './ErrorBanner';
import DynamicBackground from './DynamicBackground';

const LIFECYCLE_TABS = LIBRARY_STATES.map((id) => ({
  id,
  label: getLibraryStateLabel(id),
}));

export default function DashboardShell() {
  const { userIndex, logout } = useAuth();
  const { games, loading } = useGames('default_app');
  const { config } = useAppConfig('default_app');

  const [activeTab, setActiveTab] = useState('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gameFilters, setGameFilters] = useState(DEFAULT_GAME_FILTERS);
  const [syncingGfn, setSyncingGfn] = useState(false);
  const [gfnSyncError, setGfnSyncError] = useState(null);

  const gfnSteamAppIds = useMemo(() => {
    const ids = config?.gfnCatalog?.steamAppIds;
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  }, [config?.gfnCatalog?.steamAppIds]);

  const gfnSyncedAtLabel = useMemo(() => {
    const syncedAt = config?.gfnCatalog?.syncedAt;
    if (!syncedAt) {
      return null;
    }
    const date = syncedAt.toDate ? syncedAt.toDate() : new Date(syncedAt.seconds * 1000);
    return date.toLocaleDateString();
  }, [config?.gfnCatalog?.syncedAt]);

  async function handleSyncGfn() {
    setSyncingGfn(true);
    setGfnSyncError(null);
    try {
      await syncGfnCatalog();
    } catch (err) {
      reportError('Sync GeForce', err, setGfnSyncError);
    } finally {
      setSyncingGfn(false);
    }
  }

  const tabCounts = LIFECYCLE_TABS.reduce((counts, tab) => {
    counts[tab.id] = games.filter(
      (game) => resolveLibraryState(game) === tab.id
    ).length;
    return counts;
  }, {});

  const isGlobalSearch = Boolean(gameFilters.searchText?.trim());
  const lifecycleGames = games.filter(
    (game) => resolveLibraryState(game) === activeTab
  );
  const filterSourceGames = isGlobalSearch ? games : lifecycleGames;
  const filteredGames = filterGames(filterSourceGames, gameFilters, gfnSteamAppIds);
  const availableTags = collectSteamTags(filterSourceGames);
  const filtersActive = hasActiveFilters(gameFilters);

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
            className="btn-secondary sidebar-action-btn"
            onClick={handleSyncGfn}
            disabled={syncingGfn}
          >
            {syncingGfn ? 'Syncing…' : 'Sync GeForce'}
          </button>
          {gfnSyncedAtLabel && (
            <span className="sidebar-sync-label">GFN synced {gfnSyncedAtLabel}</span>
          )}
          <ErrorBanner
            message={gfnSyncError}
            onDismiss={() => setGfnSyncError(null)}
          />
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
              {filterSourceGames.length === 0 ? (
                <>
                  <p>No games in this view.</p>
                  <p className="dashboard-empty-hint">Use + Add Game to import from Steam.</p>
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
                  <p>No games in this view.</p>
                  <p className="dashboard-empty-hint">Use + Add Game to import from Steam.</p>
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
      </div>
    </>
  );
}

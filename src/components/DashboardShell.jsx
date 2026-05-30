import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GameCard from './GameCard';
import AddGameModal from './AddGameModal';
import GameFiltersBar from './GameFiltersBar';
import { useGames } from '../services/db';
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

const LIFECYCLE_TABS = LIBRARY_STATES.map((id) => ({
  id,
  label: getLibraryStateLabel(id),
}));

export default function DashboardShell() {
  const { currentUser, userIndex, logout } = useAuth();
  const { games, loading } = useGames('default_app');

  const [activeTab, setActiveTab] = useState('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gameFilters, setGameFilters] = useState(DEFAULT_GAME_FILTERS);

  const tabCounts = LIFECYCLE_TABS.reduce((counts, tab) => {
    counts[tab.id] = games.filter(
      (game) => resolveLibraryState(game) === tab.id
    ).length;
    return counts;
  }, {});

  const lifecycleGames = games.filter(
    (game) => resolveLibraryState(game) === activeTab
  );
  const filteredGames = filterGames(lifecycleGames, gameFilters);
  const availableTags = collectSteamTags(lifecycleGames);
  const filtersActive = hasActiveFilters(gameFilters);

  return (
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
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h3 style={{ fontWeight: 500 }}>Library Overview</h3>
            <button
              className="btn-primary"
              style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}
              onClick={() => setIsModalOpen(true)}
            >
              + Add Game
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {getNickname(userIndex)} ({currentUser?.email})
            </span>
            <button className="btn-secondary" onClick={logout}>
              Sign Out
            </button>
          </div>
        </header>

        {!loading && lifecycleGames.length > 0 && (
          <GameFiltersBar
            filters={gameFilters}
            onChange={setGameFilters}
            availableTags={availableTags}
            resultCount={filteredGames.length}
            totalCount={lifecycleGames.length}
          />
        )}

        <div className="dashboard-grid">
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading games from Firestore...</p>
          ) : filteredGames.length > 0 ? (
            filteredGames.map((game) => <GameCard key={game.id} game={game} />)
          ) : (
            <div className="dashboard-empty">
              {lifecycleGames.length === 0 ? (
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
  );
}

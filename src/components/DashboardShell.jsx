import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GameCard from './GameCard';
import AddGameModal from './AddGameModal';
import { useGames } from '../services/db';
import { getNickname } from '../utils/userConfig';

export default function DashboardShell() {
  const { currentUser, userIndex, logout } = useAuth();
  const { games, loading } = useGames('default_app');

  const [activeTab, setActiveTab] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredGames = games.filter((game) => {
    if (game.abandoned) return false;

    if (activeTab === 'ready') {
      return game.owned.user0 && game.owned.user1 && !game.finished;
    }
    if (activeTab === 'finished') {
      return game.finished;
    }
    return true;
  });

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 style={{ color: 'var(--accent-mint)' }}>Nen?</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Co-op Tracker</p>
        </div>

        <nav className="sidebar-nav">
          <div
            className={`nav-item ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Active
          </div>
          <div
            className={`nav-item ${activeTab === 'ready' ? 'active' : ''}`}
            onClick={() => setActiveTab('ready')}
          >
            Ready to Play
          </div>
          <div
            className={`nav-item ${activeTab === 'finished' ? 'active' : ''}`}
            onClick={() => setActiveTab('finished')}
          >
            Finished
          </div>
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

        <div className="dashboard-grid">
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading games from Firestore...</p>
          ) : filteredGames.length > 0 ? (
            filteredGames.map((game) => <GameCard key={game.id} game={game} />)
          ) : (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '3rem',
                color: 'var(--text-muted)',
              }}
            >
              <p style={{ marginBottom: '1rem' }}>No games in this view.</p>
              <p style={{ fontSize: '0.9rem' }}>Use + Add Game to import from Steam.</p>
            </div>
          )}
        </div>
      </main>

      <AddGameModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

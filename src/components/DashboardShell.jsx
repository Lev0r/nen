import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GameCard from './GameCard';

const DUMMY_GAMES = [
  {
    id: '1',
    name: 'Helldivers 2',
    price: '$39.99',
    isOnSale: false,
    thumbnail: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/header.jpg',
    matchScore: 95,
    ruDeveloperAlert: false,
    coopSpecs: { onlineCoop: true },
    tags: ['replayable', 'shooter']
  },
  {
    id: '2',
    name: 'Lethal Company',
    price: '$9.99',
    isOnSale: true,
    thumbnail: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1966720/header.jpg',
    matchScore: 40,
    ruDeveloperAlert: false,
    coopSpecs: { onlineCoop: true },
    tags: ['horror']
  },
  {
    id: '3',
    name: 'Suspicious Game',
    price: '$19.99',
    isOnSale: false,
    thumbnail: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/105600/header.jpg',
    matchScore: 0,
    ruDeveloperAlert: true,
    coopSpecs: { onlineCoop: true },
    tags: ['survival']
  }
];

export default function DashboardShell() {
  const { currentUser, userIndex, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="app-layout">
      {/* Sidebar */}
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

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <h3 style={{ fontWeight: 500 }}>Library Overview</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              User {userIndex} ({currentUser?.email})
            </span>
            <button className="btn-secondary" onClick={logout}>Sign Out</button>
          </div>
        </header>

        <div className="dashboard-grid">
          {DUMMY_GAMES.map(game => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </main>
    </div>
  );
}

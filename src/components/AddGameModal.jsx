import React, { useState } from 'react';

export default function AddGameModal({ isOpen, onClose }) {
  const [steamUrl, setSteamUrl] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    // Phase 5 integration will go here:
    // Call Firebase Cloud Function with steamUrl
    alert(`Backend scraper not yet implemented (Phase 5). Tried to add: ${steamUrl}`);
    setSteamUrl('');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)'
    }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '500px' }}>
        <h2 style={{ marginBottom: '1rem', color: '#fff' }}>Add New Game</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Paste a Steam Store URL or App ID. Our AI scraper will pull the metadata and run a background developer check.
        </p>

        <form onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="e.g., https://store.steampowered.com/app/105600/"
            value={steamUrl}
            onChange={(e) => setSteamUrl(e.target.value)}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: '8px',
              border: '1px solid var(--glass-border)',
              backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff',
              marginBottom: '1.5rem', outline: 'none'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={!steamUrl}>Scan & Add</button>
          </div>
        </form>
      </div>
    </div>
  );
}

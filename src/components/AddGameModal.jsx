import React, { useState } from 'react';
import { addGameFromSteam } from '../services/cloudFunctions';
import { parseSteamAppId } from '../utils/steamInput';

const DUPLICATE_MESSAGE = 'This game is already in your library.';

export default function AddGameModal({ isOpen, onClose, games = [] }) {
  const [steamUrl, setSteamUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const appId = parseSteamAppId(steamUrl);
    if (!appId || !/^\d+$/.test(appId)) {
      setError('Enter a valid Steam Store URL or App ID.');
      return;
    }

    if (games.some((game) => game.id === appId)) {
      setError(DUPLICATE_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      const result = await addGameFromSteam(steamUrl);
      setSteamUrl('');
      if (result?.vettingError) {
        setError(`Game added, but AI vetting failed: ${result.vettingError}`);
        return;
      }
      onClose();
    } catch (err) {
      console.error('Add game failed:', err);
      const message =
        err?.code === 'functions/already-exists'
          ? DUPLICATE_MESSAGE
          : err?.message || 'Failed to add game. Deploy functions and configure secrets.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="glass-panel animate-fade-in add-game-modal">
        <h2 className="add-game-modal-title">Add New Game</h2>
        <p className="add-game-modal-desc">
          Paste a Steam Store URL or App ID. Cloud Functions will scrape metadata and run
          Gemini developer vetting.
        </p>

        {error && <div className="login-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="e.g., https://store.steampowered.com/app/105600/"
            value={steamUrl}
            onChange={(e) => setSteamUrl(e.target.value)}
            disabled={loading}
            className="add-game-input"
          />
          <div className="add-game-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!steamUrl || loading}>
              {loading ? 'Scanning & vetting…' : 'Scan & Add'}
            </button>
          </div>
        </form>

        {loading && (
          <p className="add-game-loading-hint">
            Fetching Steam data and running developer checks. This can take 15–30 seconds on
            cold start.
          </p>
        )}
      </div>
    </div>
  );
}

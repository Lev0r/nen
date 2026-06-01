import React, { useEffect, useState } from 'react';
import { addGameFromSteam, previewSteamGame } from '../services/cloudFunctions';
import { parseSteamAppId } from '../utils/steamInput';
import { reportError } from '../utils/errorReport';

const DUPLICATE_MESSAGE = 'This game is already in your library.';

export default function AddGameModal({ isOpen, onClose, games = [] }) {
  const [steamUrl, setSteamUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [awaitingCoopConfirm, setAwaitingCoopConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) return;
    setSteamUrl('');
    setLoading(false);
    setLoadingPhase(null);
    setError('');
    setPreview(null);
    setAwaitingCoopConfirm(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || loading) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!loading) onClose();
  };

  const isDuplicate = (appId) => games.some((game) => game.id === appId);

  const persistPreview = async (previewData, steamInput) => {
    if (isDuplicate(previewData.appId)) {
      setError(DUPLICATE_MESSAGE);
      return;
    }

    setLoading(true);
    setLoadingPhase('persist');
    setError('');
    try {
      const result = await addGameFromSteam(steamInput, 'default_app', {
        preloadedGame: previewData.game,
        skipScrape: true,
      });
      setSteamUrl('');
      setPreview(null);
      setAwaitingCoopConfirm(false);
      if (result?.vettingError) {
        setError(`Game added, but developer source check failed: ${result.vettingError}`);
        return;
      }
      onClose();
    } catch (err) {
      if (err?.code === 'functions/already-exists') {
        setError(DUPLICATE_MESSAGE);
      } else {
        reportError('Add game', err, setError);
      }
    } finally {
      setLoading(false);
      setLoadingPhase(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPreview(null);
    setAwaitingCoopConfirm(false);

    const appId = parseSteamAppId(steamUrl);
    if (!appId || !/^\d+$/.test(appId)) {
      setError('Enter a valid Steam Store URL or App ID.');
      return;
    }

    if (isDuplicate(appId)) {
      setError(DUPLICATE_MESSAGE);
      return;
    }

    setLoading(true);
    setLoadingPhase('preview');
    let clearPreviewLoading = true;
    try {
      const previewData = await previewSteamGame(steamUrl);
      if (isDuplicate(previewData.appId)) {
        setError(DUPLICATE_MESSAGE);
        return;
      }

      setPreview(previewData);
      if (previewData.hasCoopCategory) {
        clearPreviewLoading = false;
        await persistPreview(previewData, steamUrl);
        return;
      }

      setAwaitingCoopConfirm(true);
    } catch (err) {
      if (err?.code === 'functions/already-exists') {
        setError(DUPLICATE_MESSAGE);
      } else {
        reportError('Steam preview', err, setError);
      }
    } finally {
      if (clearPreviewLoading) {
        setLoading(false);
        setLoadingPhase(null);
      }
    }
  };

  const handleCoopConfirmNo = () => {
    setPreview(null);
    setAwaitingCoopConfirm(false);
    setError('');
  };

  const handleCoopConfirmYes = async () => {
    if (!preview) return;
    await persistPreview(preview, steamUrl);
  };

  const loadingHint =
    loadingPhase === 'persist'
      ? 'Saving the game and running developer checks. This can take 15–30 seconds on cold start.'
      : 'Fetching Steam metadata. This can take 15–30 seconds on cold start.';

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="glass-panel animate-fade-in add-game-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Add new game"
      >
        {awaitingCoopConfirm && preview ? (
          <>
            <h2 className="add-game-modal-title">Co-op tags missing</h2>
            <p className="add-game-modal-desc">
              This game does not have co-op tags. Are you sure you want to add it?
            </p>
            <p className="add-game-preview-name">{preview.name}</p>

            {error && (
              <div className="login-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <div className="add-game-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCoopConfirmNo}
                disabled={loading}
              >
                No
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCoopConfirmYes}
                disabled={loading}
              >
                {loading ? 'Adding & vetting…' : 'Yes, add anyway'}
              </button>
            </div>

            {loading && <p className="add-game-loading-hint">{loadingHint}</p>}
          </>
        ) : (
          <>
            <h2 className="add-game-modal-title">Add New Game</h2>
            <p className="add-game-modal-desc">
              Paste a Steam Store URL or App ID. Cloud Functions will scrape metadata, confirm
              co-op tags when needed, and check developer sources (NE GRAI + Steam curator lists).
            </p>

            {error && (
              <div className="login-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

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
                  {loading ? 'Scanning Steam…' : 'Scan & Add'}
                </button>
              </div>
            </form>

            {loading && <p className="add-game-loading-hint">{loadingHint}</p>}
          </>
        )}
      </div>
    </div>
  );
}

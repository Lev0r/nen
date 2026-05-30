import React, { useEffect, useState } from 'react';
import { setGameLifecycle } from '../services/db';
import { reportError } from '../utils/errorReport';
import {
  LIBRARY_STATES,
  STATE_DESCRIPTIONS,
  resolveLibraryState,
  getLibraryStateLabel,
} from '../utils/libraryState';

const APP_ID = 'default_app';

export default function LifecycleModal({ game, isOpen, onClose }) {
  const [selectedState, setSelectedState] = useState('active');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !game) return;
    setSelectedState(resolveLibraryState(game));
    setNote(game.stateMeta?.note || '');
    setError('');
  }, [isOpen, game]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !game) return null;

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      await setGameLifecycle(
        APP_ID,
        game.id,
        selectedState,
        note,
        game.currentVersion ?? null
      );
      onClose();
    } catch (err) {
      reportError('Lifecycle save', err, setError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel animate-fade-in lifecycle-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Set library lifecycle state"
      >
        <h2 className="lifecycle-modal-title">{game.name}</h2>
        <p className="lifecycle-modal-desc">
          Choose where this game sits in your library. Re-selecting the current state
          refreshes the version snapshot and clears update alerts.
        </p>

        {error && (
          <div className="login-error lifecycle-modal-error">{error}</div>
        )}

        <div className="lifecycle-state-grid">
          {LIBRARY_STATES.map((state) => (
            <button
              key={state}
              type="button"
              className={`lifecycle-state-btn lifecycle-state-btn--${state} ${
                selectedState === state ? 'lifecycle-state-btn--selected' : ''
              }`}
              onClick={() => setSelectedState(state)}
              disabled={saving}
            >
              <span className="lifecycle-state-btn-label">
                {getLibraryStateLabel(state)}
              </span>
              <span className="lifecycle-state-btn-desc">
                {STATE_DESCRIPTIONS[state]}
              </span>
            </button>
          ))}
        </div>

        <label className="lifecycle-note-label" htmlFor="lifecycle-note">
          Note <span className="lifecycle-note-optional">(optional)</span>
        </label>
        <textarea
          id="lifecycle-note"
          className="lifecycle-note-input"
          placeholder={
            selectedState === 'banned'
              ? 'Why is this game banned? (optional but helpful)'
              : 'Optional note about this state…'
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving}
          rows={3}
        />

        <div className="lifecycle-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

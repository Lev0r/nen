import React, { useEffect, useState } from 'react';
import { updateGame } from '../services/db';
import { reportError } from '../utils/errorReport';
import { getNickname } from '../utils/userConfig';
import { HYPE_TIERS, getTier } from '../utils/hypeScore';
import {
  LIBRARY_STATES,
  STATE_DESCRIPTIONS,
  resolveLibraryState,
  getLibraryStateLabel,
  buildStateMetaUpdates,
} from '../utils/libraryState';

const APP_ID = 'default_app';

const DEVELOPMENT_STATUSES = [
  { value: 'released', label: 'Released' },
  { value: 'early_access', label: 'Early Access' },
  { value: 'tba', label: 'TBA' },
];

function initForm(game) {
  return {
    name: game.name || '',
    steamOverview: game.steamOverview || '',
    developmentStatus: game.developmentStatus || 'released',
    libraryState: resolveLibraryState(game),
    lifecycleNote: game.stateMeta?.note || '',
    ownedUser0: game.owned?.user0 === true,
    ownedUser1: game.owned?.user1 === true,
    hypeTierUser0: getTier(game, 'user0'),
    hypeTierUser1: getTier(game, 'user1'),
    ruDeveloperAlert: game.ruDeveloperAlert === true,
    ruDeveloperExplanation: game.ruDeveloperExplanation || '',
    userNote0: game.userNotes?.user0 || '',
    userNote1: game.userNotes?.user1 || '',
    price: game.price || '',
    originalPrice: game.originalPrice || '',
    isOnSale: game.isOnSale === true,
    discountPercent: game.discountPercent ?? 0,
    onlineCoop: game.coopSpecs?.onlineCoop === true,
    splitScreen: game.coopSpecs?.splitScreen === true,
    crossPlay: game.coopSpecs?.crossPlay === true,
  };
}

export default function GameEditModal({ game, isOpen, onClose }) {
  const [form, setForm] = useState(() => initForm(game));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !game) return;
    setForm(initForm(game));
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

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    const previousState = resolveLibraryState(game);
    const stateChanged = form.libraryState !== previousState;

    const updates = {
      name: form.name.trim(),
      steamOverview: form.steamOverview.trim(),
      developmentStatus: form.developmentStatus,
      'owned.user0': form.ownedUser0,
      'owned.user1': form.ownedUser1,
      'hypeTier.user0': form.hypeTierUser0,
      'hypeTier.user1': form.hypeTierUser1,
      ruDeveloperAlert: form.ruDeveloperAlert,
      ruDeveloperExplanation: form.ruDeveloperExplanation.trim(),
      'userNotes.user0': form.userNote0.trim(),
      'userNotes.user1': form.userNote1.trim(),
      price: form.price.trim(),
      originalPrice: form.originalPrice.trim(),
      isOnSale: form.isOnSale,
      discountPercent: Number(form.discountPercent) || 0,
      'coopSpecs.onlineCoop': form.onlineCoop,
      'coopSpecs.splitScreen': form.splitScreen,
      'coopSpecs.crossPlay': form.crossPlay,
    };

    if (stateChanged) {
      Object.assign(
        updates,
        buildStateMetaUpdates(
          form.libraryState,
          form.lifecycleNote,
          game.currentVersion ?? null
        )
      );
    } else {
      updates.libraryState = form.libraryState;
      const trimmedNote = form.lifecycleNote.trim();
      if (trimmedNote !== (game.stateMeta?.note || '')) {
        updates['stateMeta.note'] = trimmedNote;
      }
    }

    try {
      await updateGame(APP_ID, game.id, updates);
      onClose();
    } catch (err) {
      reportError('Game edit save', err, setError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="game-edit-modal glass-panel animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Edit ${game.name}`}
      >
        <h2 className="game-edit-modal-title">{game.name}</h2>
        <p className="game-edit-modal-desc">
          Edit game metadata. Both users can change all fields.
        </p>

        {error && (
          <div className="login-error game-edit-modal-error">{error}</div>
        )}

        <div className="game-edit-sections">
          <section className="game-edit-section">
            <h3 className="game-edit-section-title">Basic</h3>
            <label className="game-edit-label" htmlFor="edit-name">
              Name
            </label>
            <input
              id="edit-name"
              type="text"
              className="game-edit-input"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              disabled={saving}
            />
            <label className="game-edit-label" htmlFor="edit-overview">
              Steam overview
            </label>
            <textarea
              id="edit-overview"
              className="game-edit-textarea"
              value={form.steamOverview}
              onChange={(e) => setField('steamOverview', e.target.value)}
              disabled={saving}
              rows={3}
            />
            <label className="game-edit-label" htmlFor="edit-dev-status">
              Development status
            </label>
            <select
              id="edit-dev-status"
              className="game-edit-select"
              value={form.developmentStatus}
              onChange={(e) => setField('developmentStatus', e.target.value)}
              disabled={saving}
            >
              {DEVELOPMENT_STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </section>

          <section className="game-edit-section">
            <h3 className="game-edit-section-title">Lifecycle</h3>
            <div className="lifecycle-state-grid game-edit-lifecycle-grid">
              {LIBRARY_STATES.map((state) => (
                <button
                  key={state}
                  type="button"
                  className={`lifecycle-state-btn lifecycle-state-btn--${state} ${
                    form.libraryState === state ? 'lifecycle-state-btn--selected' : ''
                  }`}
                  onClick={() => setField('libraryState', state)}
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
            <label className="game-edit-label" htmlFor="edit-lifecycle-note">
              Lifecycle note <span className="lifecycle-note-optional">(optional)</span>
            </label>
            <textarea
              id="edit-lifecycle-note"
              className="game-edit-textarea"
              placeholder="Optional note about this lifecycle state…"
              value={form.lifecycleNote}
              onChange={(e) => setField('lifecycleNote', e.target.value)}
              disabled={saving}
              rows={2}
            />
          </section>

          <section className="game-edit-section">
            <h3 className="game-edit-section-title">Ownership</h3>
            <div className="game-edit-check-row">
              <label className="game-edit-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.ownedUser0}
                  onChange={(e) => setField('ownedUser0', e.target.checked)}
                  disabled={saving}
                />
                {getNickname(0)} owns
              </label>
              <label className="game-edit-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.ownedUser1}
                  onChange={(e) => setField('ownedUser1', e.target.checked)}
                  disabled={saving}
                />
                {getNickname(1)} owns
              </label>
            </div>
          </section>

          <section className="game-edit-section">
            <h3 className="game-edit-section-title">Hype tiers</h3>
            <div className="game-edit-row">
              <label className="game-edit-label" htmlFor="edit-tier-0">
                {getNickname(0)}
              </label>
              <select
                id="edit-tier-0"
                className="game-edit-select"
                value={form.hypeTierUser0}
                onChange={(e) => setField('hypeTierUser0', e.target.value)}
                disabled={saving}
              >
                {Object.entries(HYPE_TIERS).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="game-edit-row">
              <label className="game-edit-label" htmlFor="edit-tier-1">
                {getNickname(1)}
              </label>
              <select
                id="edit-tier-1"
                className="game-edit-select"
                value={form.hypeTierUser1}
                onChange={(e) => setField('hypeTierUser1', e.target.value)}
                disabled={saving}
              >
                {Object.entries(HYPE_TIERS).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="game-edit-section">
            <h3 className="game-edit-section-title">RU alert</h3>
            <label className="game-edit-checkbox-label game-edit-checkbox-label--block">
              <input
                type="checkbox"
                checked={form.ruDeveloperAlert}
                onChange={(e) => setField('ruDeveloperAlert', e.target.checked)}
                disabled={saving}
              />
              Russian developer alert (manual verification)
            </label>
            <label className="game-edit-label" htmlFor="edit-ru-explanation">
              Explanation
            </label>
            <textarea
              id="edit-ru-explanation"
              className="game-edit-textarea"
              placeholder="Why this flag is set…"
              value={form.ruDeveloperExplanation}
              onChange={(e) => setField('ruDeveloperExplanation', e.target.value)}
              disabled={saving}
              rows={2}
            />
          </section>

          <section className="game-edit-section">
            <h3 className="game-edit-section-title">Per-user notes</h3>
            <label className="game-edit-label" htmlFor="edit-user-note-0">
              {getNickname(0)}
            </label>
            <textarea
              id="edit-user-note-0"
              className="game-edit-textarea"
              value={form.userNote0}
              onChange={(e) => setField('userNote0', e.target.value)}
              disabled={saving}
              rows={2}
            />
            <label className="game-edit-label" htmlFor="edit-user-note-1">
              {getNickname(1)}
            </label>
            <textarea
              id="edit-user-note-1"
              className="game-edit-textarea"
              value={form.userNote1}
              onChange={(e) => setField('userNote1', e.target.value)}
              disabled={saving}
              rows={2}
            />
          </section>

          <section className="game-edit-section">
            <h3 className="game-edit-section-title">Prices (optional override)</h3>
            <label className="game-edit-label" htmlFor="edit-price">
              Price
            </label>
            <input
              id="edit-price"
              type="text"
              className="game-edit-input"
              value={form.price}
              onChange={(e) => setField('price', e.target.value)}
              disabled={saving}
            />
            <label className="game-edit-label" htmlFor="edit-original-price">
              Original price
            </label>
            <input
              id="edit-original-price"
              type="text"
              className="game-edit-input"
              value={form.originalPrice}
              onChange={(e) => setField('originalPrice', e.target.value)}
              disabled={saving}
            />
            <div className="game-edit-check-row">
              <label className="game-edit-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isOnSale}
                  onChange={(e) => setField('isOnSale', e.target.checked)}
                  disabled={saving}
                />
                On sale
              </label>
            </div>
            <label className="game-edit-label" htmlFor="edit-discount">
              Discount %
            </label>
            <input
              id="edit-discount"
              type="number"
              min="0"
              max="100"
              className="game-edit-input game-edit-input--narrow"
              value={form.discountPercent}
              onChange={(e) => setField('discountPercent', e.target.value)}
              disabled={saving}
            />
          </section>

          <section className="game-edit-section">
            <h3 className="game-edit-section-title">Co-op specs</h3>
            <div className="game-edit-check-row">
              <label className="game-edit-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.onlineCoop}
                  onChange={(e) => setField('onlineCoop', e.target.checked)}
                  disabled={saving}
                />
                Online co-op
              </label>
              <label className="game-edit-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.splitScreen}
                  onChange={(e) => setField('splitScreen', e.target.checked)}
                  disabled={saving}
                />
                Split screen
              </label>
              <label className="game-edit-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.crossPlay}
                  onChange={(e) => setField('crossPlay', e.target.checked)}
                  disabled={saving}
                />
                Cross-play
              </label>
            </div>
          </section>
        </div>

        <div className="game-edit-modal-actions">
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
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

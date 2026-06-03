import React, { useEffect, useState, useRef } from 'react';
import { updateGame } from '../services/db';
import { runDevCheck, refreshGameFromSteam } from '../services/cloudFunctions';
import { reportError } from '../utils/errorReport';
import { getNickname } from '../utils/userConfig';
import { HYPE_TIERS, getTier } from '../utils/hypeScore';
import {
  LIBRARY_STATES,
  STATE_DESCRIPTIONS,
  resolveLibraryState,
  getLibraryStateLabel,
  buildStateMetaUpdates,
  normalizeFinishedRating,
} from '../utils/libraryState';
import FinishedRatingPicker from './FinishedRatingPicker';
import {
  getGameName,
  getSteamOverview,
  getDevelopmentStatus,
  getPrice,
  getOriginalPrice,
  getIsOnSale,
  getDiscountPercent,
  getCoopSpecs,
  getCurrentVersion,
} from '../utils/gameAccessors';

const APP_ID = 'default_app';

const DEVELOPMENT_STATUSES = [
  { value: 'released', label: 'Released' },
  { value: 'early_access', label: 'Early Access' },
  { value: 'tba', label: 'TBA' },
];

function ToggleSwitch({ id, checked, onChange, disabled, label, className = '' }) {
  return (
    <label
      className={`toggle-switch${className ? ` ${className}` : ''}`}
      htmlFor={id}
    >
      <input
        id={id}
        type="checkbox"
        className="toggle-switch__input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-switch__track" aria-hidden="true">
        <span className="toggle-switch__thumb" />
      </span>
      <span className="toggle-switch__label">{label}</span>
    </label>
  );
}

function initForm(game) {
  const coopSpecs = getCoopSpecs(game);
  return {
    name: getGameName(game),
    steamOverview: getSteamOverview(game),
    developmentStatus: getDevelopmentStatus(game) || 'released',
    libraryState: resolveLibraryState(game),
    lifecycleNote: game.stateMeta?.note || '',
    finishedRating: normalizeFinishedRating(game.finishedRating),
    ownedUser0: game.owned?.user0 === true,
    ownedUser1: game.owned?.user1 === true,
    hypeTierUser0: getTier(game, 'user0'),
    hypeTierUser1: getTier(game, 'user1'),
    ruDeveloperAlert: game.ruDeveloperAlert === true,
    ruDeveloperExplanation: game.ruDeveloperExplanation || '',
    userNote0: game.userNotes?.user0 || '',
    userNote1: game.userNotes?.user1 || '',
    price: getPrice(game) || '',
    originalPrice: getOriginalPrice(game) || '',
    isOnSale: getIsOnSale(game),
    discountPercent: getDiscountPercent(game) ?? 0,
    onlineCoop: coopSpecs?.onlineCoop === true,
    splitScreen: coopSpecs?.splitScreen === true,
    crossPlay: coopSpecs?.crossPlay === true,
  };
}

export default function GameEditModal({
  game,
  isOpen,
  onClose,
  focusNotes = false,
  focusRating = false,
}) {
  const [form, setForm] = useState(() => initForm(game));
  const [saving, setSaving] = useState(false);
  const [devChecking, setDevChecking] = useState(false);
  const [devCheckMessage, setDevCheckMessage] = useState('');
  const [steamRefreshing, setSteamRefreshing] = useState(false);
  const [steamRefreshMessage, setSteamRefreshMessage] = useState('');
  const [error, setError] = useState('');
  const notesSectionRef = useRef(null);
  const ratingSectionRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !game) return;
    setForm(initForm(game));
    setError('');
    setDevCheckMessage('');
    setSteamRefreshMessage('');
  }, [isOpen, game]);

  useEffect(() => {
    if (!isOpen || !focusNotes) return;
    notesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstNote = document.getElementById('edit-user-note-0');
    firstNote?.focus();
  }, [isOpen, focusNotes]);

  useEffect(() => {
    if (!isOpen || !focusRating) return;
    ratingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstStar = document.getElementById('edit-finished-rating-star-1');
    firstStar?.focus();
  }, [isOpen, focusRating]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !game) return null;

  const isBanned = resolveLibraryState(game) === 'banned';
  const isBusy = saving || devChecking || steamRefreshing;

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRefreshFromSteam = async () => {
    setSteamRefreshing(true);
    setError('');
    setSteamRefreshMessage('');

    try {
      const result = await refreshGameFromSteam(game.id, APP_ID);

      if (result.skipped && result.reason === 'banned') {
        setSteamRefreshMessage(result.message || 'Banned games are not synced from Steam.');
        return;
      }

      const parts = [];
      if (result.staticSyncs) parts.push('store page');
      if (result.dynamicSyncs) parts.push('reviews & pricing');
      if (result.playerSamples) parts.push('player stats');
      if (result.hltbSyncs) parts.push('HLTB');
      if (result.itadSyncs) parts.push('ITAD');

      setSteamRefreshMessage(
        result.updated
          ? `Steam metadata refreshed${parts.length ? ` (${parts.join(', ')})` : ''}.`
          : 'Refresh complete — no changes from Steam.'
      );
    } catch (err) {
      reportError('Refresh from Steam', err, setError);
    } finally {
      setSteamRefreshing(false);
    }
  };

  const handleRunDevCheck = async () => {
    setDevChecking(true);
    setError('');
    setDevCheckMessage('');

    try {
      const result = await runDevCheck(game.id, APP_ID);
      setForm((prev) => ({
        ...prev,
        ruDeveloperAlert: result.ruDeveloperAlert === true,
        ruDeveloperExplanation: result.ruDeveloperExplanation || '',
      }));
      setDevCheckMessage(
        result.ruDeveloperAlert
          ? 'Developer check flagged this game (NE GRAI / curator lists). Review below and save if needed.'
          : 'Source check complete — no RU-related list matches.'
      );
    } catch (err) {
      reportError('Run dev check', err, setError);
    } finally {
      setDevChecking(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    const previousState = resolveLibraryState(game);
    const stateChanged = form.libraryState !== previousState;

    const updates = {
      'steamStatic.name': form.name.trim(),
      'steamStatic.steamOverview': form.steamOverview.trim(),
      'steamStatic.developmentStatus': form.developmentStatus,
      'owned.user0': form.ownedUser0,
      'owned.user1': form.ownedUser1,
      'hypeTier.user0': form.hypeTierUser0,
      'hypeTier.user1': form.hypeTierUser1,
      ruDeveloperAlert: form.ruDeveloperAlert,
      ruDeveloperExplanation: form.ruDeveloperExplanation.trim(),
      'userNotes.user0': form.userNote0.trim(),
      'userNotes.user1': form.userNote1.trim(),
      'steamDynamic.price': form.price.trim(),
      'steamDynamic.originalPrice': form.originalPrice.trim(),
      'steamDynamic.isOnSale': form.isOnSale,
      'steamDynamic.discountPercent': Number(form.discountPercent) || 0,
      'steamStatic.coopSpecs.onlineCoop': form.onlineCoop,
      'steamStatic.coopSpecs.splitScreen': form.splitScreen,
      'steamStatic.coopSpecs.crossPlay': form.crossPlay,
    };

    if (stateChanged) {
      Object.assign(
        updates,
        buildStateMetaUpdates(
          form.libraryState,
          form.lifecycleNote,
          getCurrentVersion(game),
          form.libraryState === 'finished' ? form.finishedRating : null,
          getDevelopmentStatus(game)
        )
      );
    } else {
      updates.libraryState = form.libraryState;
      const trimmedNote = form.lifecycleNote.trim();
      if (trimmedNote !== (game.stateMeta?.note || '')) {
        updates['stateMeta.note'] = trimmedNote;
      }
      const prevRating = normalizeFinishedRating(game.finishedRating);
      const nextRating =
        form.libraryState === 'finished'
          ? normalizeFinishedRating(form.finishedRating)
          : null;
      if (nextRating !== prevRating) {
        updates.finishedRating = nextRating;
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
        aria-label={`Edit ${getGameName(game)}`}
      >
        <div className="game-edit-modal-header">
          <h2 className="game-edit-modal-title">{getGameName(game)}</h2>
          <p className="game-edit-modal-desc">
            Edit game metadata. Both users can change all fields.
          </p>

          {error && (
            <div className="login-error game-edit-modal-error">{error}</div>
          )}
        </div>

        <div className="game-edit-modal-body">
          <div className="game-edit-sections">
          <section className="game-edit-section">
            <div className="game-edit-section-header">
              <h3 className="game-edit-section-title">Basic</h3>
              <button
                type="button"
                className="btn-secondary game-edit-dev-check-btn"
                onClick={handleRefreshFromSteam}
                disabled={isBusy || isBanned}
                title={
                  isBanned
                    ? 'Banned games are not synced from Steam'
                    : 'Re-scrape Steam metadata for this game'
                }
              >
                {steamRefreshing ? 'Refreshing…' : 'Refresh from Steam'}
              </button>
            </div>
            {steamRefreshMessage && (
              <p className="game-edit-dev-check-message">{steamRefreshMessage}</p>
            )}
            <label className="game-edit-label" htmlFor="edit-name">
              Name
            </label>
            <input
              id="edit-name"
              type="text"
              className="game-edit-input"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              disabled={isBusy}
            />
            <label className="game-edit-label" htmlFor="edit-overview">
              Steam overview
            </label>
            <textarea
              id="edit-overview"
              className="game-edit-textarea"
              value={form.steamOverview}
              onChange={(e) => setField('steamOverview', e.target.value)}
              disabled={isBusy}
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
              disabled={isBusy}
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
                  onClick={() => {
                    setField('libraryState', state);
                    if (state !== 'finished') {
                      setField('finishedRating', null);
                    }
                  }}
                  disabled={isBusy}
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
            <div ref={ratingSectionRef}>
              <FinishedRatingPicker
                idPrefix="edit-finished-rating"
                value={form.finishedRating}
                onChange={(value) => setField('finishedRating', value)}
                disabled={isBusy}
                className={
                  form.libraryState === 'finished'
                    ? 'finished-rating-picker--prominent'
                    : 'finished-rating-picker--muted'
                }
              />
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
              disabled={isBusy}
              rows={2}
            />
          </section>

          <section className="game-edit-section">
            <h3 className="game-edit-section-title">Ownership</h3>
            <div className="game-edit-toggle-row">
              <ToggleSwitch
                id="edit-owned-user0"
                checked={form.ownedUser0}
                onChange={(value) => setField('ownedUser0', value)}
                disabled={isBusy}
                label={`${getNickname(0)} owns`}
              />
              <ToggleSwitch
                id="edit-owned-user1"
                checked={form.ownedUser1}
                onChange={(value) => setField('ownedUser1', value)}
                disabled={isBusy}
                label={`${getNickname(1)} owns`}
              />
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
                disabled={isBusy}
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
                disabled={isBusy}
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
            <div className="game-edit-section-header">
              <h3 className="game-edit-section-title">RU alert</h3>
              <button
                type="button"
                className="btn-secondary game-edit-dev-check-btn"
                onClick={handleRunDevCheck}
                disabled={isBusy}
              >
                {devChecking ? 'Checking…' : 'Run dev check'}
              </button>
            </div>
            {devCheckMessage && (
              <p className="game-edit-dev-check-message">{devCheckMessage}</p>
            )}
            <ToggleSwitch
              id="edit-ru-alert"
              className="toggle-switch--block"
              checked={form.ruDeveloperAlert}
              onChange={(value) => setField('ruDeveloperAlert', value)}
              disabled={isBusy}
              label="Russian developer alert (manual verification)"
            />
            <label className="game-edit-label" htmlFor="edit-ru-explanation">
              Explanation
            </label>
            <textarea
              id="edit-ru-explanation"
              className="game-edit-textarea"
              placeholder="Why this flag is set…"
              value={form.ruDeveloperExplanation}
              onChange={(e) => setField('ruDeveloperExplanation', e.target.value)}
              disabled={isBusy}
              rows={2}
            />
          </section>

          <section className="game-edit-section" ref={notesSectionRef}>
            <h3 className="game-edit-section-title">Per-user notes</h3>
            <label className="game-edit-label" htmlFor="edit-user-note-0">
              {getNickname(0)}
            </label>
            <textarea
              id="edit-user-note-0"
              className="game-edit-textarea"
              value={form.userNote0}
              onChange={(e) => setField('userNote0', e.target.value)}
              disabled={isBusy}
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
              disabled={isBusy}
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
              disabled={isBusy}
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
              disabled={isBusy}
            />
            <ToggleSwitch
              id="edit-on-sale"
              className="toggle-switch--block"
              checked={form.isOnSale}
              onChange={(value) => setField('isOnSale', value)}
              disabled={isBusy}
              label="On sale"
            />
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
              disabled={isBusy}
            />
          </section>

          <section className="game-edit-section">
            <h3 className="game-edit-section-title">Co-op specs</h3>
            <div className="game-edit-toggle-row">
              <ToggleSwitch
                id="edit-online-coop"
                checked={form.onlineCoop}
                onChange={(value) => setField('onlineCoop', value)}
                disabled={isBusy}
                label="Online co-op"
              />
              <ToggleSwitch
                id="edit-split-screen"
                checked={form.splitScreen}
                onChange={(value) => setField('splitScreen', value)}
                disabled={isBusy}
                label="Split screen"
              />
              <ToggleSwitch
                id="edit-cross-play"
                checked={form.crossPlay}
                onChange={(value) => setField('crossPlay', value)}
                disabled={isBusy}
                label="Cross-play"
              />
            </div>
          </section>
          </div>
        </div>

        <div className="game-edit-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={isBusy || !form.name.trim()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

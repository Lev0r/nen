import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserLabel, getNickname } from '../utils/userConfig';
import { isRuDeveloperAlert } from '../utils/gameHelpers';
import {
  calculateTotalHype,
  getScoreColor,
  getOwnershipStage,
  getStatusColor,
  formatStatusLabel,
  getTier,
  getSteamReviewColor,
} from '../utils/hypeScore';
import { updateGame } from '../services/db';
import HypePicker from './HypePicker';
import ScreenshotsModal from './ScreenshotsModal';
import GameEditModal from './GameEditModal';
import LifecycleModal from './LifecycleModal';
import FloatingTooltip from './FloatingTooltip';
import { FinishedRatingDisplay } from './FinishedRatingPicker';
import {
  resolveLibraryState,
  getLibraryStateLabel,
  getLibraryStateColor,
} from '../utils/libraryState';

const APP_ID = 'default_app';

const ownedIconStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function OwnedIcon({ stage }) {
  if (stage === 0) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="owned-icon owned-icon--none"
        aria-hidden="true"
      >
        <g {...ownedIconStroke}>
          <path d="M6 12.5c0-2.2 1-3.8 2.2-3.8 1 0 1.8 1.2 1.8 2.6" />
          <path d="M6 12.5V18" />
          <path d="M18 12.5c0-2.2-1-3.8-2.2-3.8-1 0-1.8 1.2-1.8 2.6" />
          <path d="M18 12.5V18" />
          <path d="M8.5 18h7" />
        </g>
      </svg>
    );
  }

  if (stage === 1) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="owned-icon owned-icon--half"
        aria-hidden="true"
      >
        <g {...ownedIconStroke}>
          <path d="M12 2.5v14.5" />
          <path d="M9 17h6" />
          <path d="M10.5 20h3" />
          <path d="M10 5.5 12 3l2 2.5" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="owned-icon owned-icon--full"
      aria-hidden="true"
    >
      <g {...ownedIconStroke}>
        <path d="M5.5 19.5l8.5-8.5" />
        <path d="M12.5 5.5l1.75-2.75 2.25 1.25-1.75 2.75" />
        <path d="M18.5 19.5l-8.5-8.5" />
        <path d="M11.5 5.5L9.75 2.75 7.5 4l1.75 2.75" />
      </g>
    </svg>
  );
}

function HypeBreakdownTooltip({ breakdown }) {
  if (breakdown.override) {
    return <p className="card-tooltip-text">{breakdown.message}</p>;
  }

  const { users, tierBase, ownership, status, steam, final } = breakdown;

  return (
    <div className="card-tooltip-breakdown">
      <p className="card-tooltip-heading">Total Hype breakdown</p>
      {users.map((u) => (
        <p key={u.userIndex} className="card-tooltip-line">
          <strong>{u.nickname}:</strong> {u.tierLabel} → {u.effective} pts
        </p>
      ))}
      <p className="card-tooltip-line">
        Tier base: <strong>{tierBase}</strong>
      </p>
      <p
        className="card-tooltip-line card-tooltip-line--ownership"
        style={{ color: ownership.color }}
      >
        Ownership ×{ownership.factor} — {ownership.label}
      </p>
      <p
        className="card-tooltip-line card-tooltip-line--status"
        style={{ color: status.color }}
      >
        Status ×{status.factor} — {status.label}
      </p>
      <p
        className="card-tooltip-line card-tooltip-line--steam"
        style={{ color: steam.color }}
      >
        Steam ×{steam.factor.toFixed(2)} — {steam.label}
      </p>
      <p className="card-tooltip-final">Total Hype: {final}</p>
    </div>
  );
}

function OwnedTooltip({ owned, userIndex }) {
  const rows = [
    { index: 0, owned: owned.user0 },
    { index: 1, owned: owned.user1 },
  ];
  return (
    <div className="card-tooltip-breakdown">
      <p className="card-tooltip-heading">Ownership</p>
      {rows.map(({ index, owned: isOwned }) => (
        <p
          key={index}
          className={`card-tooltip-line ${isOwned ? 'card-tooltip-line--owned-yes' : 'card-tooltip-line--owned-no'}`}
        >
          {getUserLabel(index, userIndex)}: {isOwned ? 'Owned' : 'Not owned'}
        </p>
      ))}
    </div>
  );
}

export default function GameCard({ game, gfnSteamAppIds = new Set() }) {
  const { userIndex } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const hypeRingRef = useRef(null);

  const { total, breakdown } = calculateTotalHype(game);
  const scoreColor = getScoreColor(total);
  const steamUrl = game.url || `https://store.steampowered.com/app/${game.id}/`;
  const steamDbUrl = `https://steamdb.info/app/${game.id}/`;
  const ownedStage = getOwnershipStage(game.owned);
  const bothOwn = game.owned?.user0 && game.owned?.user1;
  const statusColor = getStatusColor(game.developmentStatus);
  const currentTier = getTier(game, `user${userIndex}`);
  const hasScreenshots = game.screenshots?.length > 0;
  const reviewColor = getSteamReviewColor(game.steamReviewPercent);
  const hasReviews = game.steamReviewPercent != null && game.steamReviewPercent !== '';
  const ruAlert = isRuDeveloperAlert(game);
  const showGfnBadge = gfnSteamAppIds.has(String(game.id));
  const salePercent = game.discountPercent ?? (game.isOnSale ? null : 0);
  const libraryState = resolveLibraryState(game);
  const lifecycleColor = getLibraryStateColor(libraryState);
  const lifecycleLabel = getLibraryStateLabel(libraryState);
  const hasUpdateSinceState = game.hasUpdateSinceState === true;

  const toggleOwned = async () => {
    const key = `owned.user${userIndex}`;
    const next = !game.owned[`user${userIndex}`];
    await updateGame(APP_ID, game.id, { [key]: next });
  };

  const selectTier = async (tier) => {
    await updateGame(APP_ID, game.id, { [`hypeTier.user${userIndex}`]: tier });
  };

  const openPicker = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (breakdown.override) return;
    const rect = hypeRingRef.current?.getBoundingClientRect();
    setAnchorRect(rect || null);
    setPickerOpen(true);
  };

  return (
    <>
      <div
        className={`glass-panel animate-fade-in game-card ${ruAlert ? 'game-card--ru-alert' : ''}`}
      >
        <div className="game-card-thumb">
          <a
            href={steamUrl}
            target="_blank"
            rel="noreferrer"
            className="game-card-thumb-link"
          >
            <img src={game.thumbnail} alt={game.name} className="game-card-img" />
          </a>

          <FloatingTooltip
            anchorClassName="card-indicator card-indicator--owned"
            content={<OwnedTooltip owned={game.owned} userIndex={userIndex} />}
          >
            <button
              type="button"
              className="card-indicator-btn"
              onClick={toggleOwned}
              aria-label="Toggle ownership"
            >
              <OwnedIcon stage={ownedStage} />
            </button>
          </FloatingTooltip>

          <FloatingTooltip
            wide
            anchorClassName="card-indicator card-indicator--hype"
            content={<HypeBreakdownTooltip breakdown={breakdown} />}
          >
            <button
              type="button"
              ref={hypeRingRef}
              className="card-indicator-btn card-indicator-btn--hype"
              onClick={openPicker}
              aria-label={`Total Hype ${total}. Click to change your tier.`}
            >
              <div
                className="hype-ring-outer"
                style={{
                  background: `conic-gradient(${scoreColor} ${total}%, #1e293b 0)`,
                  boxShadow: `0 0 10px ${scoreColor}`,
                }}
              >
                <div className="hype-ring-inner">{total}</div>
              </div>
            </button>
          </FloatingTooltip>

          {showGfnBadge && (
            <span
              className="gfn-badge gfn-badge--thumb"
              title="Available on GeForce NOW"
            >
              GFN
            </span>
          )}

          {hasScreenshots && (
            <button
              type="button"
              className="card-thumb-overlay-btn game-card-screenshots-btn"
              onClick={() => setScreenshotsOpen(true)}
              aria-label="View screenshots"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="14"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
                <circle cx="8.5" cy="10.5" r="1.75" fill="currentColor" stroke="none" />
                <path
                  d="M3 16l4.5-4.5 3 3L15 10l6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="game-card-body">
          <div className="game-card-title-row">
            <a href={steamUrl} target="_blank" rel="noreferrer" className="game-card-title-link">
              <h3 className="game-card-title">{game.name}</h3>
            </a>
            {ruAlert && (
              <span
                className="ru-alert-badge"
                title={game.ruDeveloperExplanation || 'Russian developer alert'}
              >
                RU
              </span>
            )}
          </div>

          {!bothOwn && (
            <p className="game-card-price">
              {game.isOnSale ? (
                <span className="sale-price">
                  <span className="sale-original">{game.originalPrice}</span>
                  {game.price}
                  {salePercent > 0 && (
                    <span className="sale-discount">-{salePercent}%</span>
                  )}
                </span>
              ) : (
                game.price
              )}
            </p>
          )}

          {game.steamOverview && (
            <p className="game-card-overview">{game.steamOverview}</p>
          )}

          {(game.userNotes?.user0 || game.userNotes?.user1) && (
            <div className="game-card-user-notes">
              {game.userNotes?.user0 && (
                <p className="game-card-user-note">
                  {getNickname(0)}: <em>&ldquo;{game.userNotes.user0}&rdquo;</em>
                </p>
              )}
              {game.userNotes?.user1 && (
                <p className="game-card-user-note">
                  {getNickname(1)}: <em>&ldquo;{game.userNotes.user1}&rdquo;</em>
                </p>
              )}
            </div>
          )}

          <div className="game-card-meta">
            <button
              type="button"
              className={`lifecycle-badge lifecycle-badge--${libraryState}`}
              style={{
                color: lifecycleColor,
                borderColor: lifecycleColor,
                background: `${lifecycleColor}22`,
              }}
              onClick={() => setLifecycleOpen(true)}
              title="Change library lifecycle state"
            >
              {lifecycleLabel}
            </button>
            {libraryState === 'finished' && game.finishedRating && (
              <FinishedRatingDisplay rating={game.finishedRating} />
            )}
            {hasUpdateSinceState && (
              <span
                className="update-available-badge"
                title="Version changed since this state was set. Re-assign the lifecycle state to mute."
              >
                Update
              </span>
            )}
            <span
              className="status-badge"
              style={{
                color: statusColor,
                borderColor: statusColor,
                background: `${statusColor}22`,
              }}
            >
              {formatStatusLabel(game.developmentStatus)}
            </span>
            {hasReviews ? (
              <span
                className="steam-reviews-badge"
                style={{ color: reviewColor, borderColor: reviewColor }}
              >
                {game.steamReviewPercent}% Steam reviews
              </span>
            ) : (
              <span className="game-card-version" style={{ color: 'var(--text-muted)' }}>
                No Steam reviews
              </span>
            )}
            {game.currentVersion && (
              <span className="game-card-version">{game.currentVersion}</span>
            )}
          </div>

          {ruAlert && (
            <p className="ru-alert-text">
              {game.ruDeveloperExplanation || 'Russian developer ties flagged.'}
            </p>
          )}
        </div>

        <div className="game-card-footer">
          <div className="game-card-footer-group">
            <a
              href={steamDbUrl}
              target="_blank"
              rel="noreferrer"
              className="game-card-footer-btn"
              aria-label="Open on SteamDB"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <ellipse
                  cx="12"
                  cy="5.5"
                  rx="7"
                  ry="2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                />
                <path
                  d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
            <button
              type="button"
              className="game-card-footer-btn"
              onClick={() => setEditOpen(true)}
              aria-label="Edit game"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.5 6.5l3 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <HypePicker
          currentTier={currentTier}
          onSelect={selectTier}
          onClose={() => setPickerOpen(false)}
          anchorRect={anchorRect}
        />
      )}

      {screenshotsOpen && (
        <ScreenshotsModal
          images={game.screenshots}
          gameName={game.name}
          onClose={() => setScreenshotsOpen(false)}
        />
      )}

      {editOpen && (
        <GameEditModal
          game={game}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}

      {lifecycleOpen && (
        <LifecycleModal
          game={game}
          isOpen={lifecycleOpen}
          onClose={() => setLifecycleOpen(false)}
        />
      )}
    </>
  );
}

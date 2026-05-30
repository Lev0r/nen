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
import {
  resolveLibraryState,
  getLibraryStateLabel,
  getLibraryStateColor,
} from '../utils/libraryState';

const APP_ID = 'default_app';

function OwnedIcon({ stage }) {
  if (stage === 0) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="owned-icon owned-icon--none"
        aria-hidden="true"
      >
        <path
          d="M8 10h8l1.5 4v7H6.5v-7L8 10z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M9 10V8a3 3 0 016 0v2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M8 14.5h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
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
        <path d="M12 2.5L18.5 9 15.5 21.5h-7L5.5 9 12 2.5z" fill="currentColor" />
        <path
          d="M12 2.5v19M5.5 9h13M8.5 15.5h7"
          fill="none"
          stroke="rgba(0,0,0,0.25)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="owned-icon owned-icon--full"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4.5 19.5l9.5-9.5" />
        <path d="M12.5 8.5l2-3.5 2.5 1.5-2 3.5" />
        <path d="M19.5 19.5l-9.5-9.5" />
        <path d="M11.5 8.5l-2-3.5-2.5 1.5 2 3.5" />
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

          {ruAlert && (
            <span
              className="ru-alert-badge"
              title={game.ruDeveloperExplanation || 'Russian developer alert'}
            >
              RU
            </span>
          )}
        </div>

        <div className="game-card-body">
          <a href={steamUrl} target="_blank" rel="noreferrer" className="game-card-title-link">
            <h3 className="game-card-title">{game.name}</h3>
          </a>

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
            {showGfnBadge && (
              <span className="gfn-badge" title="Available on GeForce NOW">
                GFN
              </span>
            )}
          </div>

          {ruAlert && (
            <p className="ru-alert-text">
              {game.ruDeveloperExplanation || 'Russian developer ties flagged.'}
            </p>
          )}

          <div className="game-card-tags">
            {game.coopSpecs?.splitScreen && <span className="tag">Split Screen</span>}
            {game.coopSpecs?.crossPlay && <span className="tag">Cross-play</span>}
          </div>
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
                <path
                  d="M14 5h5v5M10 14L19 5M19 5h-5M19 5v5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 9v10h10"
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

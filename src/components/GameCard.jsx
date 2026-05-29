import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserLabel } from '../utils/userConfig';
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
import FloatingTooltip from './FloatingTooltip';

const APP_ID = 'default_app';

function OwnedIcon({ stage }) {
  const fill = stage === 0 ? 'none' : stage === 1 ? 'half' : 'full';
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className={`owned-icon owned-icon--${fill}`}>
      <circle cx="14" cy="14" r="12" className="owned-icon-ring" />
      {fill === 'half' && <path d="M14 2 A12 12 0 0 1 14 26 Z" className="owned-icon-fill" />}
      {fill === 'full' && <circle cx="14" cy="14" r="10" className="owned-icon-fill" />}
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

export default function GameCard({ game }) {
  const { userIndex } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const hypeRingRef = useRef(null);

  const { total, breakdown } = calculateTotalHype(game);
  const scoreColor = getScoreColor(total);
  const steamUrl = game.url || `https://store.steampowered.com/app/${game.id}/`;
  const ownedStage = getOwnershipStage(game.owned);
  const statusColor = getStatusColor(game.developmentStatus);
  const currentTier = getTier(game, `user${userIndex}`);
  const hasScreenshots = game.screenshots?.length > 0;
  const reviewColor = getSteamReviewColor(game.steamReviewPercent);
  const hasReviews = game.steamReviewPercent != null && game.steamReviewPercent !== '';
  const ruAlert = isRuDeveloperAlert(game);
  const salePercent = game.discountPercent ?? (game.isOnSale ? null : 0);

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
        style={{
          boxShadow: ruAlert
            ? 'var(--shadow-neon-red)'
            : '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        }}
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

          {game.steamOverview && (
            <p className="game-card-overview">{game.steamOverview}</p>
          )}

          <div className="game-card-meta">
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

          <div className="game-card-actions">
            {hasScreenshots && (
              <button
                type="button"
                className="btn-secondary game-card-screenshots-btn"
                onClick={() => setScreenshotsOpen(true)}
              >
                Screenshots
              </button>
            )}
          </div>

          <div className="game-card-tags">
            {game.coopSpecs?.splitScreen && <span className="tag">Split Screen</span>}
            {game.coopSpecs?.crossPlay && <span className="tag">Cross-play</span>}
            {game.tags?.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
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
    </>
  );
}

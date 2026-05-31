import React, { useState, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserLabel, getNickname } from '../utils/userConfig';
import { isRuDeveloperAlert } from '../utils/gameHelpers';
import {
  getGameName,
  getDevelopmentStatus,
  getReviewPercent,
  getCurrentVersion,
  getThumbnail,
  getScreenshots,
  getPrice,
  getOriginalPrice,
  getIsOnSale,
  getDiscountPercent,
  getSteamOverview,
  getMetacriticScore,
  getCriticsSource,
  getHltbData,
  getHltbPrimaryHours,
  getHltbWebUrl,
  getIsHistoricalLow,
  getHistoricalLowPrice,
  getAvgPlayers7d,
  getCurrentPlayers,
  getReleaseDate,
  getEarlyAccessDate,
  getReviewCount,
  getRecentReviewPercent,
  getRecentReviewCount,
  getReviewScoreDesc,
  getLastUpdateAt,
  getGameOperationErrors,
} from '../utils/gameAccessors';
import {
  calculateTotalHype,
  getScoreColor,
  getOwnershipStage,
  getStatusColor,
  formatStatusLabel,
  getTier,
  getSteamReviewColor,
  getMetacriticColor,
} from '../utils/hypeScore';
import { formatDurationSince, formatDurationBetween, getUpdateRecencyColor } from '../utils/formatDuration';
import { TextWithLinks, stripMarkdownLinks } from '../utils/textWithLinks';
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
  STATE_DESCRIPTIONS,
} from '../utils/libraryState';

const APP_ID = 'default_app';

function CardTooltipText({ children }) {
  return <p className="card-tooltip-text">{children}</p>;
}

function formatPlayerCount(value) {
  if (value == null || Number.isNaN(value)) return null;
  const n = Math.round(Number(value));
  if (n >= 1_000_000) {
    const compact = (n / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${compact}M`;
  }
  if (n >= 10_000) {
    const compact = (n / 1000).toFixed(1).replace(/\.0$/, '');
    return `${compact}K`;
  }
  return n.toLocaleString();
}

function formatReleaseDateLabel(isoDate) {
  const date = isoDate ? new Date(isoDate) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function buildStatusTooltip(developmentStatus, game) {
  if (developmentStatus === 'released') {
    const since = formatDurationSince(getReleaseDate(game));
    return since ? `Released ${since}` : 'Released';
  }
  if (developmentStatus === 'early_access') {
    const duration = formatDurationBetween(getEarlyAccessDate(game));
    return duration ? `In Early Access ${duration}` : 'In Early Access';
  }
  if (developmentStatus === 'tba') {
    const dateLabel = formatReleaseDateLabel(getReleaseDate(game));
    return dateLabel ? `Coming soon · ${dateLabel}` : 'Coming soon';
  }
  return formatStatusLabel(developmentStatus);
}

function buildReviewsTooltip(game) {
  const reviewPercent = getReviewPercent(game);
  const reviewCount = getReviewCount(game);
  const recentPercent = getRecentReviewPercent(game);
  const recentCount = getRecentReviewCount(game);
  const scoreDesc = getReviewScoreDesc(game);

  if (reviewPercent == null && recentPercent == null) {
    return 'No Steam review data';
  }

  const lines = [];
  if (reviewPercent != null) {
    lines.push({
      key: 'all-time',
      label: 'All-time',
      percent: reviewPercent,
      count: reviewCount,
      countLabel: 'reviews',
    });
  }
  if (recentPercent != null) {
    lines.push({
      key: 'recent',
      label: 'Recent (30d)',
      percent: recentPercent,
      count: recentCount,
      countLabel: null,
    });
  }

  return (
    <div className="card-tooltip-breakdown">
      {lines.map(({ key, label, percent, count, countLabel }) => (
        <p key={key} className="card-tooltip-line">
          {label}:{' '}
          <span
            className="card-tooltip-percent"
            style={{ color: getSteamReviewColor(percent) }}
          >
            {percent}%
          </span>
          {count != null && (
            <span>
              {' '}
              ({count.toLocaleString()}
              {countLabel ? ` ${countLabel}` : ''})
            </span>
          )}
        </p>
      ))}
      {scoreDesc && <p className="card-tooltip-line">{scoreDesc}</p>}
    </div>
  );
}

function buildCriticsTooltip(game, criticsSource) {
  const lines = [];
  if (criticsSource) {
    lines.push(`Source: ${criticsSource}`);
  }
  const count = game?.steamDynamic?.criticsCount;
  if (count != null) {
    lines.push(`${count.toLocaleString()} critic reviews`);
  }
  if (lines.length === 0) {
    return <CardTooltipText>Professional critic score</CardTooltipText>;
  }
  return (
    <div className="card-tooltip-breakdown">
      <p className="card-tooltip-heading">Critics</p>
      {lines.map((line) => (
        <p key={line} className="card-tooltip-line">
          {line}
        </p>
      ))}
    </div>
  );
}

function buildHltbTooltip(game) {
  const hltb = getHltbData(game);
  if (!hltb) return null;

  const lines = [];
  if (hltb.mainStoryHours != null) {
    lines.push(`Main story: ${hltb.mainStoryHours}h`);
  }
  if (hltb.mainExtraHours != null) {
    lines.push(`Main + extras: ${hltb.mainExtraHours}h`);
  }
  if (hltb.completionistHours != null) {
    lines.push(`Completionist: ${hltb.completionistHours}h`);
  }
  if (hltb.allStylesHours != null) {
    lines.push(`All playstyles: ${hltb.allStylesHours}h`);
  }
  if (hltb.releaseYear != null) {
    lines.push(`Release year: ${hltb.releaseYear}`);
  }
  if (hltb.platforms) {
    lines.push(`Platforms: ${hltb.platforms}`);
  }
  if (hltb.reviewScore != null) {
    lines.push(`HLTB score: ${hltb.reviewScore}`);
  }
  if (hltb.matchedName && hltb.matchedName !== hltb.steamName) {
    lines.push(`Matched as: ${hltb.matchedName}`);
  }

  if (lines.length === 0) {
    return <CardTooltipText>HowLongToBeat data</CardTooltipText>;
  }

  return (
    <div className="card-tooltip-breakdown">
      <p className="card-tooltip-heading">HowLongToBeat</p>
      {lines.map((line) => (
        <p key={line} className="card-tooltip-line">
          {line}
        </p>
      ))}
    </div>
  );
}

function buildHistoricalLowTooltip(game) {
  const historicalLow = getHistoricalLowPrice(game);
  if (!historicalLow) {
    return <CardTooltipText>At or below all-time Steam low (ITAD)</CardTooltipText>;
  }

  const amount =
    historicalLow.amount != null
      ? `${historicalLow.amount}${historicalLow.currency ? ` ${historicalLow.currency}` : ''}`
      : 'Unknown';
  const when = historicalLow.at
    ? new Date(historicalLow.at).toLocaleDateString()
    : null;

  return (
    <div className="card-tooltip-breakdown">
      <p className="card-tooltip-heading">Historical low</p>
      <p className="card-tooltip-line">All-time Steam low: {amount}</p>
      {when && <p className="card-tooltip-line">Recorded: {when}</p>}
      <p className="card-tooltip-line">Current price is at or below this low.</p>
    </div>
  );
}

function HistoricalLowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="game-card-historical-low-icon" aria-hidden="true">
      <path
        d="M4 16l6-6 4 4 6-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function buildPlayersTooltip(game) {
  const currentPlayers = getCurrentPlayers(game);
  const avgPlayers7d = getAvgPlayers7d(game);
  const lines = [];

  if (currentPlayers != null) {
    lines.push(`Now: ${currentPlayers.toLocaleString()}`);
  }
  if (avgPlayers7d != null) {
    lines.push(`7-day avg: ${Math.round(avgPlayers7d).toLocaleString()}`);
  }

  if (lines.length === 0) return null;

  return (
    <div className="card-tooltip-breakdown">
      <p className="card-tooltip-heading">Players</p>
      {lines.map((line) => (
        <p key={line} className="card-tooltip-line">
          {line}
        </p>
      ))}
    </div>
  );
}

function withAgo(duration) {
  if (!duration || duration === 'just now' || duration.includes('ago')) {
    return duration;
  }
  return `${duration} ago`;
}

function LastUpdateLine({ game }) {
  const lastUpdateAt = getLastUpdateAt(game);
  const lastUpdate = withAgo(formatDurationSince(lastUpdateAt));
  if (!lastUpdate) return null;

  return (
    <span>
      Last update:{' '}
      <span
        className="card-tooltip-update-age"
        style={{ color: getUpdateRecencyColor(lastUpdateAt) }}
      >
        {lastUpdate}
      </span>
    </span>
  );
}

function buildVersionTooltip(game) {
  const currentVersion = getCurrentVersion(game);
  const lastUpdateAt = getLastUpdateAt(game);
  const hasLastUpdate = Boolean(withAgo(formatDurationSince(lastUpdateAt)));

  if (!currentVersion && !hasLastUpdate) {
    return null;
  }

  return (
    <>
      {currentVersion && <span>{currentVersion}</span>}
      {currentVersion && hasLastUpdate && <span> · </span>}
      {hasLastUpdate && <LastUpdateLine game={game} />}
    </>
  );
}

function buildUpdateTooltip(game) {
  const versionAtEntry = game.stateMeta?.versionAtEntry;
  const currentVersion = getCurrentVersion(game);
  const lastUpdateAt = getLastUpdateAt(game);
  const lastUpdate = withAgo(formatDurationSince(lastUpdateAt));
  const lines = [
    {
      key: 'intro',
      content:
        'Version changed since this state was set. Re-assign the lifecycle state to mute.',
    },
  ];

  if (versionAtEntry || currentVersion) {
    lines.push({
      key: 'versions',
      content: `State version: ${versionAtEntry ?? 'unknown'} → Current: ${currentVersion ?? 'unknown'}`,
    });
  }
  if (lastUpdate) {
    lines.push({
      key: 'last-update',
      content: <LastUpdateLine game={game} />,
    });
  }

  return (
    <div className="card-tooltip-breakdown">
      {lines.map(({ key, content }) => (
        <p key={key} className="card-tooltip-line">
          {content}
        </p>
      ))}
    </div>
  );
}

function buildLifecycleTooltip(libraryState, game) {
  const description = STATE_DESCRIPTIONS[libraryState];
  const note = game.stateMeta?.note?.trim();

  return (
    <div className="card-tooltip-breakdown">
      {description && <p className="card-tooltip-line">{description}</p>}
      {note && (
        <p className="card-tooltip-line">
          <strong>Note:</strong> {note}
        </p>
      )}
      {!description && !note && (
        <p className="card-tooltip-line">Change library lifecycle state</p>
      )}
    </div>
  );
}

function buildNotesTooltip(game, hasUserNotes) {
  if (!hasUserNotes) {
    return <CardTooltipText>No notes yet — click to add</CardTooltipText>;
  }

  return (
    <div className="card-tooltip-breakdown">
      <p className="card-tooltip-heading">Notes</p>
      {game.userNotes?.user0 && (
        <p className="card-tooltip-line">
          <strong>{getNickname(0)}:</strong> {game.userNotes.user0}
        </p>
      )}
      {game.userNotes?.user1 && (
        <p className="card-tooltip-line">
          <strong>{getNickname(1)}:</strong> {game.userNotes.user1}
        </p>
      )}
    </div>
  );
}

function NotesChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="game-card-notes-icon" aria-hidden="true">
      <path
        d="M7 10h10M7 14h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M5 5.5h14a2 2 0 012 2v7.5a2 2 0 01-2 2H10l-3.5 3v-3H5a2 2 0 01-2-2V7.5a2 2 0 012-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

  const { users, tierBase, ownership, status, steamReview, metacritic, final } =
    breakdown;

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
        style={{ color: steamReview.color }}
      >
        Steam ×{steamReview.factor.toFixed(2)} — {steamReview.label}
      </p>
      <p
        className="card-tooltip-line card-tooltip-line--metacritic"
        style={{ color: metacritic.color }}
      >
        Critics ×{metacritic.factor.toFixed(2)} — {metacritic.label}
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
  const [editFocusNotes, setEditFocusNotes] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const hypeRingRef = useRef(null);

  const { total, breakdown } = calculateTotalHype(game);
  const scoreColor = getScoreColor(total);
  const steamUrl = game.url || `https://store.steampowered.com/app/${game.id}/`;
  const steamDbUrl = `https://steamdb.info/app/${game.id}/`;
  const ownedStage = getOwnershipStage(game.owned);
  const bothOwn = game.owned?.user0 && game.owned?.user1;
  const developmentStatus = getDevelopmentStatus(game);
  const statusColor = getStatusColor(developmentStatus);
  const currentTier = getTier(game, `user${userIndex}`);
  const screenshots = getScreenshots(game);
  const hasScreenshots = screenshots.length > 0;
  const reviewPercent = getReviewPercent(game);
  const reviewColor = getSteamReviewColor(reviewPercent);
  const hasReviews = reviewPercent != null;
  const ruAlert = isRuDeveloperAlert(game);
  const showGfnBadge = gfnSteamAppIds.has(String(game.id));
  const isOnSale = getIsOnSale(game);
  const salePercent = getDiscountPercent(game) ?? (isOnSale ? null : 0);
  const gameName = getGameName(game);
  const thumbnail = getThumbnail(game);
  const price = getPrice(game);
  const originalPrice = getOriginalPrice(game);
  const steamOverview = getSteamOverview(game);
  const currentVersion = getCurrentVersion(game);
  const libraryState = resolveLibraryState(game);
  const lifecycleColor = getLibraryStateColor(libraryState);
  const lifecycleLabel = getLibraryStateLabel(libraryState);
  const hasUpdateSinceState = game.hasUpdateSinceState === true;
  const metacriticScore = getMetacriticScore(game);
  const metacriticColor = getMetacriticColor(metacriticScore);
  const criticsSource = getCriticsSource(game);
  const hltbPrimaryHours = getHltbPrimaryHours(game);
  const hltbWebUrl = getHltbWebUrl(game);
  const isHistoricalLow = getIsHistoricalLow(game);
  const avgPlayers7d = getAvgPlayers7d(game);
  const currentPlayers = getCurrentPlayers(game);
  const showPlayersBadge =
    developmentStatus !== 'tba' && (avgPlayers7d != null || currentPlayers != null);
  const playersBadgeLabel =
    formatPlayerCount(avgPlayers7d ?? currentPlayers) ?? currentPlayers?.toLocaleString();
  const statusTooltip = buildStatusTooltip(developmentStatus, game);
  const versionTooltip = buildVersionTooltip(game);
  const hasUserNotes = Boolean(game.userNotes?.user0 || game.userNotes?.user1);
  const operationErrors = useMemo(() => getGameOperationErrors(game), [game]);
  const hasOperationErrors = operationErrors.length > 0;
  const textSlotContent = ruAlert
    ? game.ruDeveloperExplanation || 'Russian developer ties flagged.'
    : steamOverview;

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
          <FloatingTooltip
            anchorClassName="lifecycle-badge-anchor lifecycle-badge-anchor--thumb"
            content={buildLifecycleTooltip(libraryState, game)}
          >
            <button
              type="button"
              className={`lifecycle-badge lifecycle-badge--on-thumb lifecycle-badge--${libraryState}`}
              style={{
                color: lifecycleColor,
                borderColor: lifecycleColor,
              }}
              onClick={() => setLifecycleOpen(true)}
            >
              {lifecycleLabel}
            </button>
          </FloatingTooltip>

          <a
            href={steamUrl}
            target="_blank"
            rel="noreferrer"
            className="game-card-thumb-link"
          >
            <img src={thumbnail} alt={gameName} className="game-card-img" />
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
            <FloatingTooltip
              anchorClassName="floating-tooltip-anchor--thumb-gfn"
              content={<CardTooltipText>Available on GeForce NOW</CardTooltipText>}
            >
              <span className="gfn-badge gfn-badge--thumb">GFN</span>
            </FloatingTooltip>
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
          <div className="game-card-header">
            <div className="game-card-title-row">
              <a href={steamUrl} target="_blank" rel="noreferrer" className="game-card-title-link">
                <h3 className="game-card-title">{gameName}</h3>
              </a>
              {ruAlert && (
                <span
                  className="ru-alert-badge"
                  title={stripMarkdownLinks(game.ruDeveloperExplanation) || 'Russian developer alert'}
                >
                  RU
                </span>
              )}
            </div>

            <div className="game-card-price-row">
              <div className="game-card-price-slot">
                {!bothOwn && (
                  <p className="game-card-price">
                    {isOnSale ? (
                      <span className="sale-price">
                        <span className="sale-original">{originalPrice}</span>
                        {price}
                        {salePercent > 0 && (
                          <span className="sale-discount">-{salePercent}%</span>
                        )}
                        {isHistoricalLow && (
                          <FloatingTooltip
                            anchorClassName="floating-tooltip-anchor--meta-inline"
                            content={buildHistoricalLowTooltip(game)}
                          >
                            <span className="game-card-historical-low-badge" aria-label="Historical low price">
                              <HistoricalLowIcon />
                            </span>
                          </FloatingTooltip>
                        )}
                      </span>
                    ) : (
                      <>
                        {price}
                        {isHistoricalLow && (
                          <FloatingTooltip
                            anchorClassName="floating-tooltip-anchor--meta-inline"
                            content={buildHistoricalLowTooltip(game)}
                          >
                            <span className="game-card-historical-low-badge" aria-label="Historical low price">
                              <HistoricalLowIcon />
                            </span>
                          </FloatingTooltip>
                        )}
                      </>
                    )}
                  </p>
                )}
              </div>
              <FloatingTooltip
                anchorClassName="game-card-notes-tooltip-anchor"
                content={buildNotesTooltip(game, hasUserNotes)}
              >
                <button
                  type="button"
                  className={`game-card-notes-btn ${hasUserNotes ? 'game-card-notes-btn--active' : ''}`}
                  onClick={() => {
                    setEditFocusNotes(true);
                    setEditOpen(true);
                  }}
                  aria-label={hasUserNotes ? 'View or edit notes' : 'Add a note'}
                >
                  <NotesChatIcon />
                </button>
              </FloatingTooltip>
            </div>
          </div>

          <div
            className={`game-card-text-slot ${ruAlert ? 'game-card-text-slot--ru' : ''}`}
          >
            {textSlotContent ? (
              <div
                className={`game-card-overview ${ruAlert ? 'game-card-overview--ru-links' : ''}`}
              >
                {ruAlert ? (
                  <TextWithLinks text={textSlotContent} />
                ) : (
                  textSlotContent
                )}
              </div>
            ) : (
              <div className="game-card-overview game-card-overview--empty" aria-hidden="true">
                &nbsp;
              </div>
            )}
          </div>

          <div className="game-card-tags">
            {libraryState === 'finished' && game.finishedRating && (
              <FinishedRatingDisplay rating={game.finishedRating} />
            )}
            {hasUpdateSinceState && (
              <FloatingTooltip
                anchorClassName="floating-tooltip-anchor--meta"
                content={buildUpdateTooltip(game)}
              >
                <span className="update-available-badge">Update</span>
              </FloatingTooltip>
            )}
            <FloatingTooltip
              anchorClassName="floating-tooltip-anchor--meta"
              content={<CardTooltipText>{statusTooltip}</CardTooltipText>}
            >
              <span
                className="status-badge"
                style={{
                  color: statusColor,
                  borderColor: statusColor,
                  background: `${statusColor}22`,
                }}
              >
                {formatStatusLabel(developmentStatus)}
              </span>
            </FloatingTooltip>
            {hasReviews ? (
              <FloatingTooltip
                anchorClassName="floating-tooltip-anchor--meta"
                content={buildReviewsTooltip(game)}
              >
                <span
                  className="steam-reviews-badge"
                  style={{ color: reviewColor, borderColor: reviewColor }}
                >
                  {reviewPercent}% Steam reviews
                </span>
              </FloatingTooltip>
            ) : (
              <FloatingTooltip
                anchorClassName="floating-tooltip-anchor--meta"
                content={<CardTooltipText>No Steam review data</CardTooltipText>}
              >
                <span className="game-card-tag-muted">No Steam reviews</span>
              </FloatingTooltip>
            )}
          </div>

          <div className="game-card-meta-line">
            {currentVersion && (
              <div className="game-card-meta-item">
                <FloatingTooltip
                  anchorClassName="floating-tooltip-anchor--meta-inline"
                  content={
                    <div className="card-tooltip-breakdown">
                      <p className="card-tooltip-heading">Version</p>
                      <div className="card-tooltip-line">
                        {versionTooltip || currentVersion}
                      </div>
                    </div>
                  }
                >
                  <span className="game-card-version" title="Version">
                    {currentVersion}
                  </span>
                </FloatingTooltip>
              </div>
            )}
            {metacriticScore != null && (
              <div className="game-card-meta-item">
                <FloatingTooltip
                  anchorClassName="floating-tooltip-anchor--meta-inline"
                  content={buildCriticsTooltip(game, criticsSource)}
                >
                  <span
                    className="game-card-critics-line"
                    style={{ color: metacriticColor }}
                    title="Critics"
                  >
                    {metacriticScore}
                  </span>
                </FloatingTooltip>
              </div>
            )}
            {showPlayersBadge && (
              <div className="game-card-meta-item">
                <FloatingTooltip
                  anchorClassName="floating-tooltip-anchor--meta-inline"
                  content={buildPlayersTooltip(game)}
                >
                  <span className="game-card-players-line" title="Players">
                    {playersBadgeLabel} avg
                  </span>
                </FloatingTooltip>
              </div>
            )}
            {hltbPrimaryHours != null && hltbWebUrl && (
              <div className="game-card-meta-item">
                <FloatingTooltip
                  anchorClassName="floating-tooltip-anchor--meta-inline"
                  content={buildHltbTooltip(game)}
                >
                  <a
                    href={hltbWebUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="game-card-hltb-line"
                    title="HowLongToBeat"
                  >
                    ~{hltbPrimaryHours}h
                  </a>
                </FloatingTooltip>
              </div>
            )}
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
              className={`game-card-footer-btn${
                hasOperationErrors ? ' game-card-footer-btn--sync-warning' : ''
              }`}
              onClick={() => setEditOpen(true)}
              aria-label={
                hasOperationErrors
                  ? `Edit game (${operationErrors.length} sync error${operationErrors.length === 1 ? '' : 's'})`
                  : 'Edit game'
              }
              title={
                hasOperationErrors
                  ? `${operationErrors.length} sync error${operationErrors.length === 1 ? '' : 's'} — open edit for details`
                  : 'Edit game'
              }
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
          images={screenshots}
          gameName={gameName}
          onClose={() => setScreenshotsOpen(false)}
        />
      )}

      {editOpen && (
        <GameEditModal
          game={game}
          isOpen={editOpen}
          focusNotes={editFocusNotes}
          onClose={() => {
            setEditOpen(false);
            setEditFocusNotes(false);
          }}
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

import React, { useState, useRef, useMemo, useCallback } from 'react';
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
  getSteamPlaytimeHours,
  hasSteamPlaytimeForBoth,
} from '../utils/gameAccessors';
import {
  calculateTotalHype,
  getScoreColor,
  getScoreGlowShadow,
  getOwnershipStage,
  getStatusColor,
  formatStatusLabel,
  getTier,
  getSteamReviewColor,
  getMetacriticColor,
} from '../utils/hypeScore';
import { getEffectiveOwnership } from '../utils/gameFilters';
import { formatDurationSince, formatDurationBetween, getUpdateRecencyColor } from '../utils/formatDuration';
import { TextWithLinks, stripMarkdownLinks } from '../utils/textWithLinks';
import { setGameLifecycle, updateGame } from '../services/db';
import HypePicker from './HypePicker';
import ScreenshotsModal from './ScreenshotsModal';
import GameEditModal from './GameEditModal';
import LifecycleModal from './LifecycleModal';
import VersionAcknowledgePopover from './VersionAcknowledgePopover';
import FloatingTooltip from './FloatingTooltip';
import { FinishedRatingMetaDigit } from './FinishedRatingPicker';
import {
  resolveLibraryState,
  getLibraryStateLabel,
  getLibraryStateColor,
  normalizeFinishedRating,
} from '../utils/libraryState';
import {
  formatPlayerCount,
  CardTooltipText,
  buildStatusTooltip,
  buildReviewsTooltip,
  buildCriticsTooltip,
  buildHltbTooltip,
  buildHistoricalLowTooltip,
  HistoricalLowIcon,
  buildPlayersTooltip,
  buildVersionTooltip,
  buildPendingUpdateTooltip,
  buildLifecycleTooltip,
  buildNotesTooltip,
  NotesChatIcon,
  OwnedIcon,
  HypeBreakdownTooltip,
  OwnedTooltip,
  isHypePickerDisabled,
} from './GameCardTooltips';

const APP_ID = 'default_app';


function GameCard({ game, gfnSteamAppIds = new Set(), showLifecycleBadge = false }) {
  const { userIndex } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editFocusNotes, setEditFocusNotes] = useState(false);
  const [editFocusRating, setEditFocusRating] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [acknowledgeOpen, setAcknowledgeOpen] = useState(false);
  const [acknowledgeSaving, setAcknowledgeSaving] = useState(false);
  const [versionAnchorRect, setVersionAnchorRect] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [hypeTooltipActive, setHypeTooltipActive] = useState(false);
  const hypeRingRef = useRef(null);

  const total = game.totalHype ?? 0;
  const hypeBreakdown = useMemo(() => {
    if (!hypeTooltipActive) return null;
    return calculateTotalHype(game).breakdown;
  }, [hypeTooltipActive, game]);
  const scoreColor = getScoreColor(total);
  const steamUrl = game.url || `https://store.steampowered.com/app/${game.id}/`;
  const steamDbUrl = `https://steamdb.info/app/${game.id}/`;
  const ownedStage = getOwnershipStage(game.owned, game);
  const bothOwn = getEffectiveOwnership(game) === 'both';
  const showBothPlaytimeHeader = bothOwn && hasSteamPlaytimeForBoth(game);
  const steamPlaytimeHours0 = getSteamPlaytimeHours(game, 0);
  const steamPlaytimeHours1 = getSteamPlaytimeHours(game, 1);
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
  const ruExplanation = ruAlert
    ? game.ruDeveloperExplanation || 'Russian developer ties flagged.'
    : null;

  const openEditModal = useCallback(({ focusNotes = false, focusRating = false } = {}) => {
    setEditFocusNotes(focusNotes);
    setEditFocusRating(focusRating);
    setEditOpen(true);
  }, []);

  const renderHeaderPrice = () => (
    <p className="game-card-price">
      {isOnSale ? (
        <span className="sale-price">
          <span className="sale-original">{originalPrice}</span>
          <span className="sale-current">{price}</span>
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
        price
      )}
    </p>
  );

  const showFinishedRating =
    libraryState === 'finished' && game.finishedRating != null;

  const toggleOwned = useCallback(async () => {
    const key = `owned.user${userIndex}`;
    const next = !game.owned?.[`user${userIndex}`];
    await updateGame(APP_ID, game.id, { [key]: next });
  }, [game.id, game.owned, userIndex]);

  const selectTier = useCallback(
    async (tier) => {
      await updateGame(APP_ID, game.id, { [`hypeTier.user${userIndex}`]: tier });
    },
    [game.id, userIndex]
  );

  const openPicker = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isHypePickerDisabled(game)) return;
      const rect = hypeRingRef.current?.getBoundingClientRect();
      setAnchorRect(rect || null);
      setPickerOpen(true);
    },
    [game]
  );

  const activateHypeTooltip = useCallback(() => {
    setHypeTooltipActive(true);
  }, []);

  const openAcknowledgePopover = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setVersionAnchorRect(rect);
    setAcknowledgeOpen(true);
  }, []);

  const handleAcknowledgeUpdate = useCallback(async () => {
    setAcknowledgeSaving(true);
    try {
      await setGameLifecycle(
        APP_ID,
        game.id,
        libraryState,
        game.stateMeta?.note || '',
        currentVersion,
        libraryState === 'finished'
          ? normalizeFinishedRating(game.finishedRating)
          : null,
        developmentStatus
      );
      setAcknowledgeOpen(false);
    } finally {
      setAcknowledgeSaving(false);
    }
  }, [
    game.id,
    game.stateMeta?.note,
    game.finishedRating,
    libraryState,
    currentVersion,
    developmentStatus,
  ]);

  const showVersionMeta = Boolean(currentVersion) || hasUpdateSinceState;
  const pendingUpdateTooltip = buildPendingUpdateTooltip(game, developmentStatus);

  return (
    <>
      <div
        className={`glass-panel animate-fade-in game-card ${ruAlert ? 'game-card--ru-alert' : ''}`}
      >
        <div className="game-card-thumb">
          {showLifecycleBadge && (
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
          )}

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
              className={`card-indicator-btn card-indicator-btn--owned-${ownedStage === 0 ? 'none' : ownedStage === 1 ? 'half' : 'full'}`}
              onClick={toggleOwned}
              aria-label="Toggle ownership"
            >
              <OwnedIcon stage={ownedStage} />
            </button>
          </FloatingTooltip>

          {!isHypePickerDisabled(game) && (
            <FloatingTooltip
              wide
              anchorClassName="card-indicator card-indicator--hype"
              content={
                hypeBreakdown ? (
                  <HypeBreakdownTooltip breakdown={hypeBreakdown} />
                ) : (
                  <CardTooltipText>Total Hype: {total}</CardTooltipText>
                )
              }
            >
              <button
                type="button"
                ref={hypeRingRef}
                className="card-indicator-btn card-indicator-btn--hype"
                onMouseEnter={activateHypeTooltip}
                onFocus={activateHypeTooltip}
                onClick={openPicker}
                aria-label={`Total Hype ${total}. Click to change your tier.`}
              >
                <div
                  className="hype-ring-outer"
                  style={{
                    background: `conic-gradient(${scoreColor} ${total}%, var(--bg-dark) 0)`,
                    boxShadow: getScoreGlowShadow(total),
                  }}
                >
                  <div className="hype-ring-inner">{total}</div>
                </div>
              </button>
            </FloatingTooltip>
          )}

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

          {ruAlert && (
            <FloatingTooltip
              wide
              anchorClassName="ru-alert-badge-anchor ru-alert-badge-anchor--thumb"
              content={
                <CardTooltipText>
                  {stripMarkdownLinks(game.ruDeveloperExplanation) || 'Russian developer alert'}
                </CardTooltipText>
              }
            >
              <span className="ru-alert-badge ru-alert-badge--thumb">RU</span>
            </FloatingTooltip>
          )}
        </div>

        <div className="game-card-body">
          <div className="game-card-header">
            <div className="game-card-title-row">
              <FloatingTooltip
                anchorClassName="floating-tooltip-anchor--title"
                content={<CardTooltipText>{gameName}</CardTooltipText>}
              >
                <a href={steamUrl} target="_blank" rel="noreferrer" className="game-card-title-link">
                  <h3 className="game-card-title">{gameName}</h3>
                </a>
              </FloatingTooltip>
            </div>
            <div className="game-card-price-row">
              {bothOwn ? (
                <p className="game-card-owned-both">
                  {showBothPlaytimeHeader
                    ? `${getNickname(0)}: ${steamPlaytimeHours0}h · ${getNickname(1)}: ${steamPlaytimeHours1}h`
                    : 'Owned by both players'}
                </p>
              ) : (
                price && renderHeaderPrice()
              )}
            </div>
          </div>

          {ruAlert && (
            <div className="game-card-text-slot game-card-text-slot--ru">
              <div className="game-card-overview game-card-overview--ru-links">
                <TextWithLinks text={ruExplanation} />
              </div>
            </div>
          )}

          <div className="game-card-tags">
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
            {showVersionMeta && (
              <div className="game-card-meta-item">
                <FloatingTooltip
                  anchorClassName="floating-tooltip-anchor--meta-inline"
                  content={
                    hasUpdateSinceState ? (
                      pendingUpdateTooltip
                    ) : (
                      <div className="card-tooltip-breakdown">
                        <p className="card-tooltip-heading">Version</p>
                        <div className="card-tooltip-line">
                          {versionTooltip || currentVersion}
                        </div>
                      </div>
                    )
                  }
                >
                  {hasUpdateSinceState ? (
                    <button
                      type="button"
                      className="game-card-version game-card-version--pending"
                      title="Version — click to acknowledge update"
                      onClick={openAcknowledgePopover}
                    >
                      {currentVersion || '—'}
                      <span className="version-new-indicator">new</span>
                    </button>
                  ) : (
                    <span className="game-card-version" title="Version">
                      {currentVersion}
                    </span>
                  )}
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
            {showFinishedRating && (
              <div className="game-card-meta-item">
                <FloatingTooltip
                  anchorClassName="floating-tooltip-anchor--meta-inline"
                  content={
                    <CardTooltipText>
                      Shared finished rating ({game.finishedRating}/5) — {getNickname(0)} &amp;{' '}
                      {getNickname(1)}
                    </CardTooltipText>
                  }
                >
                  <FinishedRatingMetaDigit
                    rating={game.finishedRating}
                    onClick={() => openEditModal({ focusRating: true })}
                  />
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
            <FloatingTooltip
              anchorClassName="game-card-notes-tooltip-anchor"
              content={buildNotesTooltip(game, hasUserNotes)}
            >
              <button
                type="button"
                className={`game-card-footer-btn game-card-notes-btn ${hasUserNotes ? 'game-card-notes-btn--active' : ''}`}
                onClick={() => openEditModal({ focusNotes: true })}
                aria-label={hasUserNotes ? 'View or edit notes' : 'Add a note'}
              >
                <NotesChatIcon />
              </button>
            </FloatingTooltip>
            <button
              type="button"
              className="game-card-footer-btn"
              onClick={() => openEditModal()}
              aria-label="Edit game"
              title="Edit game"
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
          focusRating={editFocusRating}
          onClose={() => {
            setEditOpen(false);
            setEditFocusNotes(false);
            setEditFocusRating(false);
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

      {acknowledgeOpen && (
        <VersionAcknowledgePopover
          anchorRect={versionAnchorRect}
          onConfirm={handleAcknowledgeUpdate}
          onClose={() => setAcknowledgeOpen(false)}
          saving={acknowledgeSaving}
        />
      )}
    </>
  );
}

export default React.memo(GameCard);

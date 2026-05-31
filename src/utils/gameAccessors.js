export function getGameName(game) {
  return game?.steamStatic?.name ?? '';
}

export function getDevelopmentStatus(game) {
  return game?.steamStatic?.developmentStatus ?? null;
}

export function getReviewPercent(game) {
  const pct = game?.steamDynamic?.reviewPercent;
  if (pct == null || pct === '') return null;
  return Number(pct);
}

export function getCurrentVersion(game) {
  return game?.steamDynamic?.currentVersion ?? null;
}

export function getThumbnail(game) {
  return game?.steamStatic?.thumbnail ?? '';
}

export function getScreenshots(game) {
  return game?.steamStatic?.screenshots ?? [];
}

export function getPrice(game) {
  return game?.steamDynamic?.price ?? null;
}

export function getOriginalPrice(game) {
  return game?.steamDynamic?.originalPrice ?? null;
}

export function getIsOnSale(game) {
  return game?.steamDynamic?.isOnSale === true;
}

export function getDiscountPercent(game) {
  const pct = game?.steamDynamic?.discountPercent;
  if (pct == null) return null;
  return Number(pct);
}

export function getMetacriticScore(game) {
  const steamScore = game?.steamStatic?.metacriticScore;
  if (steamScore != null && steamScore !== '') {
    return Number(steamScore);
  }

  const itadScore = game?.steamDynamic?.criticsScore;
  if (itadScore != null && itadScore !== '') {
    return Number(itadScore);
  }

  return null;
}

export function getCriticsSource(game) {
  if (game?.steamStatic?.metacriticScore != null && game.steamStatic.metacriticScore !== '') {
    return 'Metacritic';
  }
  return game?.steamDynamic?.criticsSource ?? null;
}

export function getSteamOverview(game) {
  return game?.steamStatic?.steamOverview ?? '';
}

export function getDevelopers(game) {
  return game?.steamStatic?.developers ?? [];
}

export function getPublishers(game) {
  return game?.steamStatic?.publishers ?? [];
}

export function getReleaseDate(game) {
  return game?.steamStatic?.releaseDate ?? null;
}

export function getEarlyAccessDate(game) {
  return game?.steamStatic?.earlyAccessDate ?? null;
}

export function getSteamTags(game) {
  return game?.steamStatic?.steamTags ?? [];
}

export function getCoopSpecs(game) {
  return game?.steamStatic?.coopSpecs ?? null;
}

export function getReviewCount(game) {
  const count = game?.steamDynamic?.reviewCount;
  if (count == null) return null;
  return Number(count);
}

export function getRecentReviewPercent(game) {
  const pct = game?.steamDynamic?.recentReviewPercent;
  if (pct == null || pct === '') return null;
  return Number(pct);
}

export function getRecentReviewCount(game) {
  const count = game?.steamDynamic?.recentReviewCount;
  if (count == null) return null;
  return Number(count);
}

export function getReviewScoreDesc(game) {
  return game?.steamDynamic?.reviewScoreDesc ?? null;
}

export function getLastUpdateAt(game) {
  return game?.steamDynamic?.lastUpdateAt ?? null;
}

export function getEstimatedPlaytimeHours(game) {
  const hours = game?.steamStatic?.estimatedPlaytimeHours;
  if (hours == null) return null;
  return Number(hours);
}

export function getHltbData(game) {
  return game?.steamStatic?.hltb ?? null;
}

export function getHltbPrimaryHours(game) {
  const hltb = getHltbData(game);
  if (!hltb) return null;
  const hours =
    hltb.mainStoryHours ??
    hltb.allStylesHours ??
    hltb.mainExtraHours ??
    hltb.completionistHours;
  return hours == null ? null : Number(hours);
}

export function getHltbWebUrl(game) {
  const hltb = getHltbData(game);
  if (hltb?.webUrl) return hltb.webUrl;
  if (hltb?.hltbId) return `https://howlongtobeat.com/game/${hltb.hltbId}`;
  return null;
}

export function getIsHistoricalLow(game) {
  return game?.steamDynamic?.isHistoricalLow === true;
}

export function getHistoricalLowPrice(game) {
  return game?.steamDynamic?.historicalLowPrice ?? null;
}

export function getCurrentPlayers(game) {
  const players = game?.steamStats?.currentPlayers;
  if (players == null) return null;
  return Number(players);
}

export function getAvgPlayers7d(game) {
  const avg = game?.steamStats?.avgPlayers7d;
  if (avg == null) return null;
  return Number(avg);
}

const ITAD_CONFIG_ERROR = 'ITAD_API_KEY not configured';

function pushOperationError(errors, seen, { source, label, message, at = null }) {
  const text = String(message || '').trim();
  if (!text || text === ITAD_CONFIG_ERROR || seen.has(source)) return;
  seen.add(source);
  errors.push({ source, label, message: text, at });
}

/**
 * Collect per-game sync / enrichment failures stored on the game document.
 */
export function getGameOperationErrors(game) {
  const errors = [];
  const seen = new Set();

  pushOperationError(errors, seen, {
    source: 'hltb',
    label: 'HowLongToBeat',
    message: game?.steamStatic?.hltb?.lastError,
    at: game?.steamStatic?.hltb?.syncedAt ?? null,
  });

  pushOperationError(errors, seen, {
    source: 'itad',
    label: 'IsThereAnyDeal',
    message: game?.steamDynamic?.itadLastError,
    at: game?.steamDynamic?.itadSyncedAt ?? null,
  });

  const thirdParty = game?.thirdPartyErrors;
  if (thirdParty?.hltb) {
    pushOperationError(errors, seen, {
      source: 'hltb',
      label: 'HowLongToBeat',
      message: thirdParty.hltb,
      at: game?.steamStatic?.hltb?.syncedAt ?? null,
    });
  }
  if (thirdParty?.itad) {
    pushOperationError(errors, seen, {
      source: 'itad',
      label: 'IsThereAnyDeal',
      message: thirdParty.itad,
      at: game?.steamDynamic?.itadSyncedAt ?? null,
    });
  }

  pushOperationError(errors, seen, {
    source: 'vetting',
    label: 'Developer vetting (Gemini)',
    message: game?.vettingError,
    at: game?.vettingErrorAt ?? null,
  });

  pushOperationError(errors, seen, {
    source: 'steam-sync',
    label: 'Steam library sync',
    message: game?.lastSyncError,
    at: game?.lastSyncErrorAt ?? null,
  });

  return errors;
}

export function hasGameOperationErrors(game) {
  return getGameOperationErrors(game).length > 0;
}

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

const SOURCE_LABELS = {
  hltb: 'HowLongToBeat',
  itad: 'IsThereAnyDeal',
  vetting: 'Developer vetting',
  'steam-sync': 'Steam library sync',
  firestore: 'Firestore',
  'game-data': 'Game data',
  action: 'Action',
  library: 'Library',
};

export function getSourceLabel(source) {
  return SOURCE_LABELS[source] || source;
}

function resolveHltbOperationEntry(hltb) {
  if (!hltb) return null;

  const status = hltb.status;
  if (status === 'info' && hltb.infoMessage) {
    return {
      source: 'hltb',
      severity: 'info',
      message: hltb.infoMessage,
      errorKey: hltb.errorKey || null,
      count: hltb.occurrenceCount || 1,
      at: hltb.lastOccurrenceAt ?? hltb.syncedAt ?? null,
      detail: hltb.detail ?? null,
    };
  }

  if ((status === 'warning' || status === 'error') && hltb.lastError) {
    return {
      source: 'hltb',
      severity: status,
      message: hltb.lastError,
      errorKey: hltb.errorKey || null,
      count: hltb.occurrenceCount || 1,
      at: hltb.lastOccurrenceAt ?? hltb.syncedAt ?? null,
      detail: hltb.detail ?? null,
    };
  }

  if (hltb.lastError) {
    return {
      source: 'hltb',
      severity: 'warning',
      message: hltb.lastError,
      errorKey: hltb.errorKey || null,
      count: hltb.occurrenceCount || 1,
      at: hltb.lastOccurrenceAt ?? hltb.syncedAt ?? null,
      detail: hltb.detail ?? null,
    };
  }

  return null;
}

function resolveItadOperationEntry(steamDynamic) {
  if (!steamDynamic) return null;

  const status = steamDynamic.itadStatus;
  if (status === 'info' && steamDynamic.itadInfoMessage) {
    return {
      source: 'itad',
      severity: 'info',
      message: steamDynamic.itadInfoMessage,
      errorKey: steamDynamic.itadErrorKey || null,
      count: steamDynamic.itadOccurrenceCount || 1,
      at: steamDynamic.itadLastOccurrenceAt ?? steamDynamic.itadSyncedAt ?? null,
      detail: steamDynamic.itadDetail ?? null,
    };
  }

  if ((status === 'warning' || status === 'error') && steamDynamic.itadLastError) {
    if (steamDynamic.itadLastError === ITAD_CONFIG_ERROR) return null;
    return {
      source: 'itad',
      severity: status,
      message: steamDynamic.itadLastError,
      errorKey: steamDynamic.itadErrorKey || null,
      count: steamDynamic.itadOccurrenceCount || 1,
      at: steamDynamic.itadLastOccurrenceAt ?? steamDynamic.itadSyncedAt ?? null,
      detail: steamDynamic.itadDetail ?? null,
    };
  }

  if (steamDynamic.itadLastError && steamDynamic.itadLastError !== ITAD_CONFIG_ERROR) {
    return {
      source: 'itad',
      severity: 'warning',
      message: steamDynamic.itadLastError,
      errorKey: steamDynamic.itadErrorKey || null,
      count: steamDynamic.itadOccurrenceCount || 1,
      at: steamDynamic.itadLastOccurrenceAt ?? steamDynamic.itadSyncedAt ?? null,
      detail: steamDynamic.itadDetail ?? null,
    };
  }

  return null;
}

function pushOperationEntry(errors, seen, entry) {
  const text = String(entry.message || '').trim();
  if (!text || seen.has(entry.source)) return;
  seen.add(entry.source);
  errors.push(entry);
}

/**
 * Collect per-game sync / enrichment failures stored on the game document.
 */
export function getGameOperationErrors(game) {
  const errors = [];
  const seen = new Set();

  const hltbEntry = resolveHltbOperationEntry(game?.steamStatic?.hltb);
  if (hltbEntry) {
    pushOperationEntry(errors, seen, hltbEntry);
  }

  const itadEntry = resolveItadOperationEntry(game?.steamDynamic);
  if (itadEntry) {
    pushOperationEntry(errors, seen, itadEntry);
  }

  const thirdParty = game?.thirdPartyErrors;
  if (thirdParty?.hltb && !seen.has('hltb')) {
    pushOperationEntry(errors, seen, {
      source: 'hltb',
      severity: 'warning',
      message: thirdParty.hltb,
      errorKey: null,
      count: 1,
      at: game?.steamStatic?.hltb?.syncedAt ?? null,
      detail: null,
    });
  }
  if (thirdParty?.itad && !seen.has('itad')) {
    pushOperationEntry(errors, seen, {
      source: 'itad',
      severity: 'warning',
      message: thirdParty.itad,
      errorKey: null,
      count: 1,
      at: game?.steamDynamic?.itadSyncedAt ?? null,
      detail: null,
    });
  }

  if (game?.vettingError) {
    pushOperationEntry(errors, seen, {
      source: 'vetting',
      severity: 'warning',
      message: game.vettingError,
      errorKey: null,
      count: 1,
      at: game.vettingErrorAt ?? null,
      detail: null,
    });
  }

  if (game?.lastSyncError) {
    pushOperationEntry(errors, seen, {
      source: 'steam-sync',
      severity: 'warning',
      message: game.lastSyncError,
      errorKey: null,
      count: 1,
      at: game.lastSyncErrorAt ?? null,
      detail: null,
    });
  }

  return errors;
}

export function hasGameOperationErrors(game) {
  return getGameOperationErrors(game).length > 0;
}

export function gameHasInfoStatus(game) {
  const hltb = game?.steamStatic?.hltb;
  if (hltb?.status === 'info' && hltb?.infoMessage) return true;
  const dynamic = game?.steamDynamic;
  return dynamic?.itadStatus === 'info' && Boolean(dynamic?.itadInfoMessage);
}

export function buildClearInfoUpdates(game) {
  const updates = {};
  const hltb = game?.steamStatic?.hltb;
  if (hltb?.status === 'info') {
    updates['steamStatic.hltb.status'] = null;
    updates['steamStatic.hltb.infoMessage'] = null;
    updates['steamStatic.hltb.errorKey'] = null;
    updates['steamStatic.hltb.occurrenceCount'] = null;
    updates['steamStatic.hltb.lastOccurrenceAt'] = null;
    updates['steamStatic.hltb.detail'] = null;
  }

  const dynamic = game?.steamDynamic;
  if (dynamic?.itadStatus === 'info') {
    updates['steamDynamic.itadStatus'] = null;
    updates['steamDynamic.itadInfoMessage'] = null;
    updates['steamDynamic.itadErrorKey'] = null;
    updates['steamDynamic.itadOccurrenceCount'] = null;
    updates['steamDynamic.itadLastOccurrenceAt'] = null;
    updates['steamDynamic.itadDetail'] = null;
  }

  return updates;
}

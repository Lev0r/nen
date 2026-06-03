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

export function isFreeToPlay(game) {
  return getPrice(game) === 'Free to Play';
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

export function getSteamPlaytimeHours(game, userIndex) {
  const key = userIndex === 0 ? 'user0Minutes' : 'user1Minutes';
  const minutes = game?.steamPlaytime?.[key];
  if (minutes == null || minutes === '') return null;
  const n = Number(minutes);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round((n / 60) * 10) / 10;
}

export function hasSteamPlaytimeForBoth(game) {
  if (game?.steamPlaytime?.syncedAt == null) return false;
  return (
    getSteamPlaytimeHours(game, 0) != null && getSteamPlaytimeHours(game, 1) != null
  );
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

const SOURCE_LABELS = {
  hltb: 'HowLongToBeat',
  itad: 'IsThereAnyDeal',
  vetting: 'Developer vetting',
  'steam-sync': 'Steam library sync',
  'steam-ownership': 'Steam ownership sync',
  'steam-wishlist': 'Steam wishlist sync',
  firestore: 'Firestore',
  'game-data': 'Game data',
  action: 'Action',
  library: 'Library',
};

export function getSourceLabel(source) {
  return SOURCE_LABELS[source] || source;
}

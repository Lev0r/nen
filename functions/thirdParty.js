const { FieldValue } = require('firebase-admin/firestore');
const { fetchHltbForGame } = require('./hltb');
const { fetchItadPriceMeta, getItadApiKey } = require('./itad');

async function applyHltbToStatic(steamStatic, { force = false } = {}) {
  const gameName = steamStatic?.name;
  if (!gameName) {
    return { steamStatic, changed: false, error: 'Missing game name' };
  }

  const { data, error } = await fetchHltbForGame(gameName, steamStatic?.hltb?.hltbId);
  if (data) {
    return {
      steamStatic: { ...steamStatic, hltb: data },
      changed: true,
      error: null,
      clearThirdPartyError: 'hltb',
    };
  }

  const nextHltb = {
    ...(steamStatic.hltb || {}),
    lastError: error || 'HLTB fetch failed',
    syncedAt: FieldValue.serverTimestamp(),
  };

  return {
    steamStatic: { ...steamStatic, hltb: nextHltb },
    changed: Boolean(error),
    error: error || null,
  };
}

async function applyItadToDynamic(steamAppId, steamDynamic, { gameTitle = null } = {}) {
  if (!getItadApiKey()) {
    return { steamDynamic, changed: false, error: 'ITAD_API_KEY not configured' };
  }

  const { data, error } = await fetchItadPriceMeta(steamAppId, { gameTitle });
  if (data) {
    return {
      steamDynamic: {
        ...steamDynamic,
        isHistoricalLow: data.isHistoricalLow === true,
        historicalLowPrice: data.historicalLow,
        itadId: data.itadId,
        criticsScore: data.criticsScore ?? null,
        criticsSource: data.criticsSource ?? null,
        criticsCount: data.criticsCount ?? null,
        itadSyncedAt: FieldValue.serverTimestamp(),
        itadLastError: null,
      },
      changed: true,
      error: null,
      clearThirdPartyError: 'itad',
    };
  }

  return {
    steamDynamic: {
      ...steamDynamic,
      itadSyncedAt: FieldValue.serverTimestamp(),
      itadLastError: error || 'ITAD fetch failed',
    },
    changed: Boolean(error),
    error: error || null,
  };
}

async function enrichNewGameThirdParty(game) {
  if (game.steamStatic?.developmentStatus === 'tba') {
    return game;
  }

  let steamStatic = game.steamStatic ? { ...game.steamStatic } : {};
  let steamDynamic = game.steamDynamic ? { ...game.steamDynamic } : {};

  const hltbResult = await applyHltbToStatic(steamStatic, { force: true });
  steamStatic = hltbResult.steamStatic;

  const itadResult = await applyItadToDynamic(game.id, steamDynamic, {
    gameTitle: steamStatic?.name || null,
  });
  steamDynamic = itadResult.steamDynamic;

  const thirdPartyErrors = {};
  if (hltbResult.error) thirdPartyErrors.hltb = hltbResult.error;
  if (itadResult.error) thirdPartyErrors.itad = itadResult.error;

  return {
    ...game,
    steamStatic,
    steamDynamic,
    ...(Object.keys(thirdPartyErrors).length > 0 && { thirdPartyErrors }),
  };
}

module.exports = {
  applyHltbToStatic,
  applyItadToDynamic,
  enrichNewGameThirdParty,
};

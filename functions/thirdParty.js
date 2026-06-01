const { FieldValue } = require('firebase-admin/firestore');
const { fetchHltbForGame } = require('./hltb');
const { fetchItadPriceMeta, getItadApiKey } = require('./itad');
const {
  classifyHltbOutcome,
  classifyItadOutcome,
  buildHltbSuccessOnlyFields,
  buildItadSuccessOnlyFields,
} = require('./errorStatus');

function isActionableSeverity(severity) {
  return severity === 'warning' || severity === 'error';
}

function buildHltbOutcome(steamStatic, { error, severity, errorKey, detail, gameName }) {
  return {
    steamStatic,
    changed: false,
    error: error || null,
    severity: severity || null,
    errorKey: errorKey || null,
    detail: detail || null,
    source: 'hltb',
    gameName: gameName || steamStatic?.name || null,
  };
}

async function applyHltbToStatic(steamStatic, { force = false } = {}) {
  const gameName = steamStatic?.name;
  if (!gameName) {
    const classification = classifyHltbOutcome('Missing game name');
    return buildHltbOutcome(steamStatic, {
      error: 'Missing game name',
      severity: classification.severity,
      errorKey: classification.errorKey,
      detail: null,
      gameName,
    });
  }

  const { data, error, detail } = await fetchHltbForGame(gameName, steamStatic?.hltb?.hltbId);
  if (data) {
    return {
      steamStatic: {
        ...steamStatic,
        hltb: buildHltbSuccessOnlyFields(steamStatic?.hltb, data, FieldValue),
      },
      changed: true,
      error: null,
      severity: null,
      errorKey: null,
      detail: null,
      source: 'hltb',
      gameName,
    };
  }

  const classification = classifyHltbOutcome(error);
  const severity = classification?.severity || 'warning';
  const errorKey = classification?.errorKey;

  return buildHltbOutcome(steamStatic, {
    error: error || 'HLTB fetch failed',
    severity,
    errorKey,
    detail: detail || null,
    gameName,
  });
}

async function applyItadToDynamic(steamAppId, steamDynamic, { gameTitle = null } = {}) {
  const gameName = gameTitle || null;

  if (!getItadApiKey()) {
    const classification = classifyItadOutcome('ITAD_API_KEY not configured');
    return {
      steamDynamic,
      changed: false,
      error: 'ITAD_API_KEY not configured',
      severity: classification.severity,
      errorKey: classification.errorKey,
      detail: null,
      source: 'itad',
      gameName,
    };
  }

  const { data, error, detail } = await fetchItadPriceMeta(steamAppId, { gameTitle });
  if (data) {
    const nextDynamic = { ...steamDynamic, ...data, ...buildItadSuccessOnlyFields(FieldValue) };
    for (const field of [
      'itadStatus',
      'itadInfoMessage',
      'itadLastError',
      'itadErrorKey',
      'itadOccurrenceCount',
      'itadLastOccurrenceAt',
      'itadDetail',
    ]) {
      delete nextDynamic[field];
    }

    return {
      steamDynamic: nextDynamic,
      changed: true,
      error: null,
      severity: null,
      errorKey: null,
      detail: null,
      source: 'itad',
      gameName,
    };
  }

  const classification = classifyItadOutcome(error);
  const severity = classification?.severity || 'warning';
  const errorKey = classification?.errorKey;

  return {
    steamDynamic,
    changed: false,
    error: error || 'ITAD fetch failed',
    severity,
    errorKey,
    detail: detail || null,
    source: 'itad',
    gameName,
  };
}

async function enrichNewGameThirdParty(game) {
  if (game.steamStatic?.developmentStatus === 'tba') {
    return { game, outcomes: [] };
  }

  let steamStatic = game.steamStatic ? { ...game.steamStatic } : {};
  let steamDynamic = game.steamDynamic ? { ...game.steamDynamic } : {};
  const outcomes = [];

  const hltbResult = await applyHltbToStatic(steamStatic, { force: true });
  if (hltbResult.changed) {
    steamStatic = hltbResult.steamStatic;
  }
  outcomes.push(hltbResult);

  const itadResult = await applyItadToDynamic(game.id, steamDynamic, {
    gameTitle: steamStatic?.name || null,
  });
  if (itadResult.changed) {
    steamDynamic = itadResult.steamDynamic;
  }
  outcomes.push(itadResult);

  return {
    game: {
      ...game,
      steamStatic,
      steamDynamic,
    },
    outcomes,
  };
}

module.exports = {
  applyHltbToStatic,
  applyItadToDynamic,
  enrichNewGameThirdParty,
  isActionableSeverity,
};

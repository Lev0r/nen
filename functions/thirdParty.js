const { FieldValue } = require('firebase-admin/firestore');
const { fetchHltbForGame } = require('./hltb');
const { fetchItadPriceMeta, getItadApiKey } = require('./itad');
const {
  classifyHltbOutcome,
  classifyItadOutcome,
  buildHltbInfoFields,
  buildHltbErrorFields,
  buildHltbSuccessFields,
  buildItadInfoFields,
  buildItadErrorFields,
  buildItadSuccessClears,
} = require('./errorStatus');

function isActionableSeverity(severity) {
  return severity === 'warning' || severity === 'error';
}

async function applyHltbToStatic(steamStatic, { force = false } = {}) {
  const gameName = steamStatic?.name;
  if (!gameName) {
    const classification = classifyHltbOutcome('Missing game name');
    const hltb = buildHltbErrorFields(steamStatic?.hltb, {
      message: 'Missing game name',
      severity: classification.severity,
      errorKey: classification.errorKey,
      detail: null,
      FieldValue,
    });
    return {
      steamStatic: { ...steamStatic, hltb },
      changed: true,
      error: 'Missing game name',
      severity: classification.severity,
      detail: null,
    };
  }

  const { data, error, detail } = await fetchHltbForGame(gameName, steamStatic?.hltb?.hltbId);
  if (data) {
    return {
      steamStatic: {
        ...steamStatic,
        hltb: buildHltbSuccessFields(steamStatic?.hltb, data, FieldValue),
      },
      changed: true,
      error: null,
      severity: null,
      clearThirdPartyError: 'hltb',
    };
  }

  const classification = classifyHltbOutcome(error);
  const severity = classification?.severity || 'warning';
  const errorKey = classification?.errorKey;

  const hltb =
    severity === 'info'
      ? buildHltbInfoFields(steamStatic?.hltb, {
          message: error,
          errorKey,
          detail,
          FieldValue,
        })
      : buildHltbErrorFields(steamStatic?.hltb, {
          message: error || 'HLTB fetch failed',
          severity,
          errorKey,
          detail,
          FieldValue,
        });

  return {
    steamStatic: { ...steamStatic, hltb },
    changed: true,
    error: error || null,
    severity,
    detail: detail || null,
  };
}

async function applyItadToDynamic(steamAppId, steamDynamic, { gameTitle = null } = {}) {
  if (!getItadApiKey()) {
    const classification = classifyItadOutcome('ITAD_API_KEY not configured');
    return {
      steamDynamic: {
        ...steamDynamic,
        ...buildItadErrorFields(steamDynamic, {
          message: 'ITAD_API_KEY not configured',
          severity: classification.severity,
          errorKey: classification.errorKey,
          detail: null,
          FieldValue,
        }),
      },
      changed: true,
      error: 'ITAD_API_KEY not configured',
      severity: classification.severity,
      detail: null,
    };
  }

  const { data, error, detail } = await fetchItadPriceMeta(steamAppId, { gameTitle });
  if (data) {
    return {
      steamDynamic: {
        ...steamDynamic,
        ...data,
        ...buildItadSuccessClears(FieldValue),
      },
      changed: true,
      error: null,
      severity: null,
      clearThirdPartyError: 'itad',
    };
  }

  const classification = classifyItadOutcome(error);
  const severity = classification?.severity || 'warning';
  const errorKey = classification?.errorKey;

  const statusFields =
    severity === 'info'
      ? buildItadInfoFields(steamDynamic, {
          message: error,
          errorKey,
          detail,
          FieldValue,
        })
      : buildItadErrorFields(steamDynamic, {
          message: error || 'ITAD fetch failed',
          severity,
          errorKey,
          detail,
          FieldValue,
        });

  return {
    steamDynamic: { ...steamDynamic, ...statusFields },
    changed: true,
    error: error || null,
    severity,
    detail: detail || null,
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
  if (hltbResult.error && isActionableSeverity(hltbResult.severity)) {
    thirdPartyErrors.hltb = hltbResult.error;
  }
  if (itadResult.error && isActionableSeverity(itadResult.severity)) {
    thirdPartyErrors.itad = itadResult.error;
  }

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
  isActionableSeverity,
};

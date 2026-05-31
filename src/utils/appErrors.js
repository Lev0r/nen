import { getGameName, getGameOperationErrors } from './gameAccessors';

const ACK_STORAGE_KEY = 'nen.maintenance.ackFingerprint';

function toIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toTimestamp(value) {
  const iso = toIso(value);
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Collect library-wide, per-game, and in-session action errors for Maintenance.
 */
export function collectAppErrors({ config, games = [], runtimeErrors = [] }) {
  const items = [...runtimeErrors];
  const sync = config?.steamLibrarySync;
  const health = config?.thirdPartyHealth;

  if (sync?.hltbErrors > 0) {
    items.push({
      id: 'library-hltb-summary',
      scope: 'library',
      label: 'HowLongToBeat',
      message: `${sync.hltbErrors} game(s) failed on last meta load`,
      at: toIso(sync?.syncedAt),
    });
  }

  if (health?.itad?.configured === false) {
    items.push({
      id: 'library-itad-config',
      scope: 'library',
      label: 'IsThereAnyDeal',
      message: 'ITAD API key not configured',
      at: toIso(sync?.syncedAt),
    });
  } else if (sync?.itadErrors > 0) {
    items.push({
      id: 'library-itad-summary',
      scope: 'library',
      label: 'IsThereAnyDeal',
      message: `${sync.itadErrors} game(s) failed on last meta load`,
      at: toIso(sync?.syncedAt),
    });
  }

  for (const game of games) {
    const gameName = getGameName(game) || `App ${game.id}`;
    for (const entry of getGameOperationErrors(game)) {
      items.push({
        id: `${game.id}:${entry.source}`,
        scope: 'game',
        gameId: game.id,
        gameName,
        label: entry.label,
        message: entry.message,
        at: toIso(entry.at),
      });
    }
  }

  return items.sort((a, b) => toTimestamp(b.at) - toTimestamp(a.at));
}

export function fingerprintAppErrors(errors) {
  if (!errors?.length) return '';
  return errors
    .map((entry) => `${entry.id}|${entry.message}|${entry.at ?? ''}`)
    .sort()
    .join('\n');
}

export function readAcknowledgedFingerprint() {
  try {
    return localStorage.getItem(ACK_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function writeAcknowledgedFingerprint(fingerprint) {
  try {
    if (fingerprint) {
      localStorage.setItem(ACK_STORAGE_KEY, fingerprint);
    } else {
      localStorage.removeItem(ACK_STORAGE_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function hasUnacknowledgedErrors(errors, acknowledgedFingerprint) {
  if (!errors?.length) return false;
  return fingerprintAppErrors(errors) !== acknowledgedFingerprint;
}

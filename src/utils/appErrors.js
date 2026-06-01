import { getGameName, getGameOperationErrors, getSourceLabel } from './gameAccessors';

const ACK_STORAGE_KEY = 'nen.maintenance.ackFingerprint';

const SEVERITY_ORDER = ['error', 'warning', 'info'];
const SEVERITY_LABELS = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Info',
};

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

function normalizeEntry({
  severity,
  source,
  gameName = null,
  gameId = null,
  message,
  count = 1,
  at = null,
  detail = null,
  errorKey = null,
}) {
  return {
    severity,
    source,
    gameName,
    gameId,
    message: String(message || '').trim(),
    count: Math.max(1, Number(count) || 1),
    at: toIso(at),
    detail: detail ? String(detail) : null,
    errorKey: errorKey || null,
  };
}

function groupKey(entry) {
  return `${entry.severity}|${entry.source}|${entry.errorKey || ''}|${entry.message}`;
}

function mergeGroupedEntries(entries) {
  const groups = new Map();

  for (const entry of entries) {
    const key = groupKey(entry);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        ...entry,
        gameNames: entry.gameName ? [entry.gameName] : [],
        gameIds: entry.gameId ? [entry.gameId] : [],
        count: entry.count,
        at: entry.at,
      });
      continue;
    }

    if (entry.gameName && !existing.gameNames.includes(entry.gameName)) {
      existing.gameNames.push(entry.gameName);
    }
    if (entry.gameId && !existing.gameIds.includes(entry.gameId)) {
      existing.gameIds.push(entry.gameId);
    }
    existing.count += entry.count;
    if (toTimestamp(entry.at) > toTimestamp(existing.at)) {
      existing.at = entry.at;
    }
  }

  return [...groups.values()].map((group) => ({
    severity: group.severity,
    source: group.source,
    gameName: group.gameNames.join(', '),
    gameId: group.gameIds.join(','),
    message: group.message,
    count: group.count,
    at: group.at,
    detail: group.detail,
    errorKey: group.errorKey,
  }));
}

/**
 * Collect library-wide, per-game, and in-session action errors for Maintenance.
 */
export function collectAppErrors({ config, games = [], runtimeErrors = [] }) {
  const raw = runtimeErrors.map((entry) =>
    normalizeEntry({
      severity: entry.severity || 'warning',
      source: entry.source || 'action',
      gameName: entry.gameName || null,
      gameId: entry.gameId || null,
      message: entry.message,
      count: entry.count || 1,
      at: entry.at,
      detail: entry.detail || null,
      errorKey: entry.errorKey || null,
    })
  );

  const sync = config?.steamLibrarySync;
  const health = config?.thirdPartyHealth;

  if (sync?.hltbErrors > 0) {
    raw.push(
      normalizeEntry({
        severity: 'warning',
        source: 'hltb',
        message: `${sync.hltbErrors} game(s) failed on last meta load`,
        at: sync?.syncedAt,
      })
    );
  }

  if (health?.itad?.configured === false) {
    raw.push(
      normalizeEntry({
        severity: 'warning',
        source: 'itad',
        message: 'ITAD API key not configured',
        at: sync?.syncedAt,
      })
    );
  } else if (sync?.itadErrors > 0) {
    raw.push(
      normalizeEntry({
        severity: 'warning',
        source: 'itad',
        message: `${sync.itadErrors} game(s) failed on last meta load`,
        at: sync?.syncedAt,
      })
    );
  }

  for (const game of games) {
    const gameName = getGameName(game) || `App ${game.id}`;
    for (const entry of getGameOperationErrors(game)) {
      raw.push(
        normalizeEntry({
          severity: entry.severity,
          source: entry.source,
          gameName,
          gameId: game.id,
          message: entry.message,
          count: entry.count,
          at: entry.at,
          detail: entry.detail,
          errorKey: entry.errorKey,
        })
      );
    }
  }

  const merged = mergeGroupedEntries(raw.filter((entry) => entry.message));
  return merged.sort((a, b) => toTimestamp(b.at) - toTimestamp(a.at));
}

export function groupAppErrors(errors) {
  const bySeverity = new Map();

  for (const entry of errors) {
    if (!bySeverity.has(entry.severity)) {
      bySeverity.set(entry.severity, new Map());
    }
    const bySource = bySeverity.get(entry.severity);
    if (!bySource.has(entry.source)) {
      bySource.set(entry.source, []);
    }
    bySource.get(entry.source).push(entry);
  }

  return SEVERITY_ORDER.filter((severity) => bySeverity.has(severity)).map((severity) => ({
    severity,
    label: SEVERITY_LABELS[severity] || severity,
    sources: [...bySeverity.get(severity).entries()]
      .sort(([a], [b]) => getSourceLabel(a).localeCompare(getSourceLabel(b)))
      .map(([source, items]) => ({
        source,
        label: getSourceLabel(source),
        items: items.sort((a, b) => toTimestamp(b.at) - toTimestamp(a.at)),
      })),
  }));
}

export function countErrorsBySeverity(errors) {
  return errors.reduce(
    (counts, entry) => {
      counts[entry.severity] = (counts[entry.severity] || 0) + 1;
      return counts;
    },
    { error: 0, warning: 0, info: 0 }
  );
}

export function fingerprintAppErrors(errors, { severities = ['error', 'warning'] } = {}) {
  const filtered = errors.filter((entry) => severities.includes(entry.severity));
  if (!filtered.length) return '';
  return filtered
    .map(
      (entry) =>
        `${entry.severity}|${entry.source}|${entry.errorKey || ''}|${entry.message}|${entry.gameId || ''}|${entry.at ?? ''}|${entry.count}`
    )
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
  const fingerprint = fingerprintAppErrors(errors);
  if (!fingerprint) return false;
  return fingerprint !== acknowledgedFingerprint;
}

export function formatErrorLine(entry, formatErrorDateTime) {
  const when = formatErrorDateTime(entry.at);
  const prefix = when ? `${when}  ` : '';
  const context = entry.gameName ? `${entry.gameName}: ` : '';
  const countSuffix = entry.count > 1 ? ` (${entry.count} times)` : '';
  return `${prefix}${context}${entry.message}${countSuffix}`;
}

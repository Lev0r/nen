const crypto = require('crypto');

const HLTB_INFO_ERRORS = new Set(['No confident HLTB match', 'HLTB match has no playtime data']);
const ITAD_INFO_ERRORS = new Set([
  'Game not found on ITAD',
  'No ITAD price data',
]);

function hashErrorKey(message) {
  return crypto
    .createHash('sha256')
    .update(String(message || '').trim().toLowerCase())
    .digest('hex')
    .slice(0, 16);
}

function slugifyErrorKey(message) {
  const slug = String(message || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || hashErrorKey(message);
}

const KNOWN_ERROR_KEYS = {
  'No confident HLTB match': 'no_confident_match',
  'HLTB match has no playtime data': 'no_playtime_data',
  'Missing game name': 'missing_game_name',
  'Game not found on ITAD': 'not_found',
  'No ITAD price data': 'no_price_data',
  'ITAD_API_KEY not configured': 'api_key_not_configured',
};

function normalizeErrorKey(message) {
  const text = String(message || '').trim();
  if (!text) return 'unknown';
  return KNOWN_ERROR_KEYS[text] || slugifyErrorKey(text);
}

function classifyHltbOutcome(error) {
  if (!error) return null;
  if (HLTB_INFO_ERRORS.has(error)) {
    return { severity: 'info', errorKey: normalizeErrorKey(error) };
  }
  if (error === 'Missing game name') {
    return { severity: 'warning', errorKey: normalizeErrorKey(error) };
  }
  if (/failed \(\d{3}\)/i.test(error) || /auth init failed/i.test(error)) {
    return { severity: 'error', errorKey: normalizeErrorKey(error) };
  }
  return { severity: 'warning', errorKey: normalizeErrorKey(error) };
}

function classifyItadOutcome(error) {
  if (!error) return null;
  if (ITAD_INFO_ERRORS.has(error)) {
    return { severity: 'info', errorKey: normalizeErrorKey(error) };
  }
  if (error === 'ITAD_API_KEY not configured') {
    return { severity: 'warning', errorKey: normalizeErrorKey(error) };
  }
  if (/^ITAD \d{3}/.test(error)) {
    return { severity: 'error', errorKey: normalizeErrorKey(error) };
  }
  return { severity: 'warning', errorKey: normalizeErrorKey(error) };
}

function incrementOccurrence(prev, errorKey, severity) {
  const prevSeverity = prev?.status;
  const prevKey = prev?.errorKey;
  const sameOutcome =
    prevKey === errorKey &&
    ((severity === 'info' && prevSeverity === 'info') ||
      (severity !== 'info' && (prevSeverity === 'warning' || prevSeverity === 'error')));
  return sameOutcome ? (prev?.occurrenceCount || 1) + 1 : 1;
}

function buildHltbInfoFields(existingHltb, { message, errorKey, detail, FieldValue }) {
  const prev = existingHltb || {};
  const occurrenceCount = incrementOccurrence(prev, errorKey, 'info');
  const fields = {
    ...(existingHltb || {}),
    status: 'info',
    infoMessage: message,
    errorKey,
    occurrenceCount,
    lastOccurrenceAt: FieldValue.serverTimestamp(),
    syncedAt: FieldValue.serverTimestamp(),
    lastError: FieldValue.delete(),
  };
  if (detail) {
    fields.detail = detail;
  } else if (prev.detail) {
    fields.detail = FieldValue.delete();
  }
  return fields;
}

function buildHltbErrorFields(existingHltb, { message, severity, errorKey, detail, FieldValue }) {
  const prev = existingHltb || {};
  const occurrenceCount = incrementOccurrence(prev, errorKey, severity);
  const fields = {
    ...(existingHltb || {}),
    status: severity,
    lastError: message,
    errorKey,
    occurrenceCount,
    lastOccurrenceAt: FieldValue.serverTimestamp(),
    syncedAt: FieldValue.serverTimestamp(),
    infoMessage: FieldValue.delete(),
  };
  if (detail) {
    fields.detail = detail;
  } else if (prev.detail) {
    fields.detail = FieldValue.delete();
  }
  return fields;
}

function buildHltbSuccessFields(existingHltb, data, FieldValue) {
  return {
    ...(existingHltb || {}),
    ...data,
    status: 'ok',
    lastError: null,
    infoMessage: FieldValue.delete(),
    errorKey: FieldValue.delete(),
    occurrenceCount: FieldValue.delete(),
    lastOccurrenceAt: FieldValue.delete(),
    detail: FieldValue.delete(),
    syncedAt: FieldValue.serverTimestamp(),
  };
}

function buildItadInfoFields(existingDynamic, { message, errorKey, detail, FieldValue }) {
  const prev = existingDynamic || {};
  const occurrenceCount = incrementOccurrence(
    { status: prev.itadStatus, errorKey: prev.itadErrorKey, occurrenceCount: prev.itadOccurrenceCount },
    errorKey,
    'info'
  );
  const fields = {
    itadStatus: 'info',
    itadInfoMessage: message,
    itadErrorKey: errorKey,
    itadOccurrenceCount: occurrenceCount,
    itadLastOccurrenceAt: FieldValue.serverTimestamp(),
    itadSyncedAt: FieldValue.serverTimestamp(),
    itadLastError: FieldValue.delete(),
  };
  if (detail) {
    fields.itadDetail = detail;
  } else if (prev.itadDetail) {
    fields.itadDetail = FieldValue.delete();
  }
  return fields;
}

function buildItadErrorFields(existingDynamic, { message, severity, errorKey, detail, FieldValue }) {
  const prev = existingDynamic || {};
  const occurrenceCount = incrementOccurrence(
    { status: prev.itadStatus, errorKey: prev.itadErrorKey, occurrenceCount: prev.itadOccurrenceCount },
    errorKey,
    severity
  );
  const fields = {
    itadStatus: severity,
    itadLastError: message,
    itadErrorKey: errorKey,
    itadOccurrenceCount: occurrenceCount,
    itadLastOccurrenceAt: FieldValue.serverTimestamp(),
    itadSyncedAt: FieldValue.serverTimestamp(),
    itadInfoMessage: FieldValue.delete(),
  };
  if (detail) {
    fields.itadDetail = detail;
  } else if (prev.itadDetail) {
    fields.itadDetail = FieldValue.delete();
  }
  return fields;
}

function buildItadSuccessClears(FieldValue) {
  return {
    itadStatus: 'ok',
    itadLastError: null,
    itadInfoMessage: FieldValue.delete(),
    itadErrorKey: FieldValue.delete(),
    itadOccurrenceCount: FieldValue.delete(),
    itadLastOccurrenceAt: FieldValue.delete(),
    itadDetail: FieldValue.delete(),
    itadSyncedAt: FieldValue.serverTimestamp(),
  };
}

const HLTB_INFO_FIELD_DELETES = [
  'status',
  'infoMessage',
  'errorKey',
  'occurrenceCount',
  'lastOccurrenceAt',
  'detail',
];

const ITAD_INFO_FIELD_DELETES = [
  'itadStatus',
  'itadInfoMessage',
  'itadErrorKey',
  'itadOccurrenceCount',
  'itadLastOccurrenceAt',
  'itadDetail',
];

function isStaleInfo(lastAtMs, cutoffMs) {
  return lastAtMs != null && lastAtMs < cutoffMs;
}

module.exports = {
  classifyHltbOutcome,
  classifyItadOutcome,
  normalizeErrorKey,
  buildHltbInfoFields,
  buildHltbErrorFields,
  buildHltbSuccessFields,
  buildItadInfoFields,
  buildItadErrorFields,
  buildItadSuccessClears,
  HLTB_INFO_FIELD_DELETES,
  ITAD_INFO_FIELD_DELETES,
  isStaleInfo,
};

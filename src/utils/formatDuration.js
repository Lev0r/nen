function parseDate(input) {
  if (input == null || input === '') return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'object') {
    if (typeof input.toDate === 'function') {
      const date = input.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    }
    if (input.seconds != null) {
      const date = new Date(input.seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  if (typeof input === 'number') {
    const date = new Date(input < 1e12 ? input * 1000 : input);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof input === 'string') {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function diffCalendar(start, end) {
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

function plural(value, unit) {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

function formatCompound({ years, months, days }, { includeDays = true } = {}) {
  const parts = [];

  if (years > 0) parts.push(plural(years, 'year'));
  if (months > 0) parts.push(plural(months, 'month'));
  if (includeDays && days > 0 && parts.length < 2) {
    parts.push(plural(days, 'day'));
  }

  return parts.join(' ');
}

/**
 * Human-readable duration since a date (e.g. "5 months ago", "3 years 2 months", "12 days", "just now").
 */
export function formatDurationSince(isoDateOrTimestamp) {
  const start = parseDate(isoDateOrTimestamp);
  if (!start) return '';

  const end = new Date();
  if (end <= start) return 'just now';

  const elapsedMs = end.getTime() - start.getTime();
  if (elapsedMs < 60_000) return 'just now';

  const parts = diffCalendar(start, end);

  if (parts.years >= 1) {
    const compound = formatCompound(parts, { includeDays: false });
    if (parts.months > 0) return compound;
    return `${plural(parts.years, 'year')} ago`;
  }

  if (parts.months >= 1) {
    return `${plural(parts.months, 'month')} ago`;
  }

  if (parts.days >= 1) {
    return plural(parts.days, 'day');
  }

  return 'just now';
}

/**
 * Human-readable span between two dates (e.g. "for 3 years 2 months").
 */
export function formatDurationBetween(startDate, endDate) {
  const start = parseDate(startDate);
  if (!start) return '';

  const end = parseDate(endDate) ?? new Date();
  if (end <= start) return '';

  const parts = diffCalendar(start, end);
  const compound = formatCompound(parts);
  if (!compound) return '';

  return `for ${compound}`;
}

/**
 * Compact relative time (e.g. "3m ago", "5h ago", "1d ago").
 */
export function formatRelativeTimeShort(input) {
  const start = parseDate(input);
  if (!start) return null;

  const ms = Date.now() - start.getTime();
  if (ms < 0) return 'just now';

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Locale date + time for error logs (e.g. "May 31, 2026, 3:45 PM").
 */
export function formatDateTime(input) {
  const start = parseDate(input);
  if (!start) return null;

  return start.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const ERROR_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Compact datetime for Maintenance errors (e.g. "31-May 18:11").
 */
export function formatErrorDateTime(input) {
  const start = parseDate(input);
  if (!start) return null;

  const day = String(start.getDate()).padStart(2, '0');
  const month = ERROR_MONTHS[start.getMonth()];
  const hours = String(start.getHours()).padStart(2, '0');
  const minutes = String(start.getMinutes()).padStart(2, '0');
  return `${day}-${month} ${hours}:${minutes}`;
}

/**
 * Whole days elapsed since a date (0 = today).
 */
export function getDaysSince(input) {
  const start = parseDate(input);
  if (!start) return null;

  const ms = Date.now() - start.getTime();
  if (ms < 0) return 0;

  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/**
 * Color for "time since last update" based on SteamDB + Steam norms:
 * - Green: ≤30 days (actively maintained)
 * - Yellow: 31–365 days (stale; SteamDB only flags red after 365d)
 * - Red: >365 days (SteamDB `steamdb_last_update_old`, Steam EA abandonment warning)
 */
export function getUpdateRecencyColor(input) {
  const days = getDaysSince(input);
  if (days == null) return 'var(--text-muted)';
  if (days <= 30) return 'var(--accent-mint)';
  if (days <= 365) return 'var(--accent-yellow)';
  return 'var(--accent-red)';
}

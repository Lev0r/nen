function parseDateMs(isoDate) {
  if (!isoDate) return null;
  const ms = Date.parse(`${isoDate}T12:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

function isEventCurrent(event, now = Date.now()) {
  const startMs = parseDateMs(event?.startDate);
  const endMs = parseDateMs(event?.endDate);
  if (startMs != null && endMs != null) {
    return now >= startMs && now <= endMs + 24 * 60 * 60 * 1000;
  }
  return event?.status === 'active';
}

function isEventUpcoming(event, now = Date.now()) {
  const startMs = parseDateMs(event?.startDate);
  if (startMs == null) return false;
  return startMs > now;
}

function formatShortDate(isoDate) {
  const ms = parseDateMs(isoDate);
  if (ms == null) return null;
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatEventDateRange(event) {
  const start = formatShortDate(event?.startDate);
  const end = formatShortDate(event?.endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return `Starts ${start}`;
  if (end) return `Ends ${end}`;
  if (event?.status === 'active') return 'Live now';
  return null;
}

export function formatEventStatus(event, now = Date.now()) {
  if (isEventCurrent(event, now)) return 'Live';
  if (isEventUpcoming(event, now)) return 'Upcoming';
  const endMs = parseDateMs(event?.endDate);
  if (endMs != null && endMs < now) return 'Ended';
  return null;
}

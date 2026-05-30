export function parseSteamAppId(input) {
  const trimmed = String(input || '').trim();
  const match = trimmed.match(/\/app\/(\d+)/);
  if (match) return match[1];
  const digits = trimmed.replace(/\D/g, '');
  return digits || null;
}

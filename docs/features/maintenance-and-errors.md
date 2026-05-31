# Maintenance & Error Handling

**Related:** [Steam sync](./steam-sync-and-data.md) · [RU vetting](./ru-developer-vetting.md) · [OPS](../OPS.md)

## Maintenance modal

`MaintenanceModal.jsx` + entry in `DashboardShell.jsx`.

| Action | Callable | Timeout |
| :--- | :--- | :--- |
| Load meta info | `syncSteamLibrary` | 540s client |
| Sync GeForce NOW | `syncGfnCatalog` | 540s client |

**Errors section** — aggregated via `collectAppErrors()` (`appErrors.js`):

- Library-level: HLTB/ITAD health from config, subscription errors
- Game-level: `vettingError`, `lastSyncError`, third-party errors
- Action-level: runtime errors from sync buttons

### Planned (user request)

- **Group errors** by source (e.g. HLTB, ITAD, vetting, sync, subscription) and severity
- **Richer detail** per entry — timestamps, game name/app ID, raw message, suggested action

**Acknowledge dot** — yellow on Maintenance button; fingerprint in `localStorage`.

## Error reporting pattern

- `reportError(context, err, setError)` — logs + user message (`errorReport.js`)
- `functions/deadline-exceeded` → timeout hint for long syncs
- Vetting failures on add: game **saved**, `vettingError` on doc, modal stays open

## Gaps (see [CODE_IMPROVEMENTS](../CODE_IMPROVEMENTS.md))

- **Dev BG source maintenance UI** (user request) — sync button, source freshness (`devBgCheck.sources.syncedAt`), list counts, bulk re-vet; callable `syncDevSources` exists, no client wrapper yet
- No bulk RU re-vet button (standalone; may fold into dev BG controls)

## Related callables (partial / no UI)

| Callable | Purpose | UI status |
| :--- | :--- | :--- |
| `syncDevSources` | Refresh vetting source lists in Firestore | ❌ no UI |
| `vetGameDevelopers` | Per-game re-vet | ✅ edit modal only |

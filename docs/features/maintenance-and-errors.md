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

**Acknowledge dot** — yellow on Maintenance button; fingerprint in `localStorage`.

## Error reporting pattern

- `reportError(context, err, setError)` — logs + user message (`errorReport.js`)
- `functions/deadline-exceeded` → timeout hint for long syncs
- Vetting failures on add: game **saved**, `vettingError` on doc, modal stays open

## Gaps (see [CODE_IMPROVEMENTS](../CODE_IMPROVEMENTS.md))

- No UI for `syncDevSources` (weekly NE GRAI + curator refresh)
- No bulk RU re-vet button
- No dev source freshness display (`devBgCheck.sources.syncedAt`)

## Related callables (no UI yet)

| Callable | Purpose |
| :--- | :--- |
| `syncDevSources` | Refresh vetting source lists in Firestore |
| `vetGameDevelopers` | Per-game — exposed in edit modal only |

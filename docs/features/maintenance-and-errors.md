# Maintenance & Error Handling

**Related:** [Steam sync](./steam-sync-and-data.md) · [RU vetting](./ru-developer-vetting.md) · [OPS](../OPS.md)

## Maintenance modal

`MaintenanceModal.jsx` + entry in `DashboardShell.jsx`.

| Action | Callable | Timeout |
| :--- | :--- | :--- |
| Load meta info | `syncSteamLibrary` | 540s client |
| Sync GeForce NOW | `syncGfnCatalog` | 540s client |
| Sync dev sources | `syncDevSources` | 540s client |
| Re-vet all games | `revetAllGames` | 540s client |

Dev source section shows `devBgCheck.sources.syncedAt`, per-source counts (`devSourceSummary`).

**Errors section** — aggregated via `collectAppErrors()` (`appErrors.js`):

- Library-level: HLTB/ITAD health from config, subscription errors
- Game-level: `vettingError`, `lastSyncError`, third-party errors
- Action-level: runtime errors from sync buttons

### Error presentation

- **Severity taxonomy:** `error` / `warning` / `info`
- **Grouped** by severity, then source — duplicate messages collapsed with counts
- **Detail** per entry — timestamps, game name/app ID, message, optional detail
- **Clear info** button — dismiss info-level entries
- **Weekly purge** — stale info fields cleared on scheduled sync (`purgeStaleInfoFields`)

**Acknowledge dot** — yellow on Maintenance button; fingerprint in `localStorage`.

## Error reporting pattern

- `reportError(context, err, setError)` — logs + user message (`errorReport.js`)
- `functions/deadline-exceeded` → timeout hint for long syncs
- Vetting failures on add: game **saved**, `vettingError` on doc, modal stays open

## Related callables

| Callable | Purpose | UI status |
| :--- | :--- | :--- |
| `syncDevSources` | Refresh vetting source lists in Firestore | ✅ Maintenance |
| `revetAllGames` | Bulk re-vet all games | ✅ Maintenance |
| `vetGameDevelopers` | Per-game re-vet | ✅ edit modal |

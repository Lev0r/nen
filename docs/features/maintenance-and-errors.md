# Maintenance & Error Handling

**Related:** [Steam sync](./steam-sync-and-data.md) · [RU vetting](./ru-developer-vetting.md) · [OPS](../OPS.md)

## Maintenance modal

`MaintenanceModal.jsx` + entry in `DashboardShell.jsx`.

| Action | Callable | Timeout |
| :--- | :--- | :--- |
| Load meta info | `syncSteamLibrary` | 540s client |
| Sync GeForce NOW | `syncGfnCatalog` | 540s client |
| Sync Steam ownership | `syncSteamOwnership` | 120s client |
| Sync Steam wishlists | `syncSteamWishlists` | 540s client (co-op store scrape filter) |
| Sync dev sources | `syncDevSources` | 540s client |
| Re-vet all games | `revetAllGames` | 540s client |
| Clear info errors | `clearMaintenanceInfoErrors` | 60s client |

Sync labels (meta load, GFN, Steam ownership, Steam wishlists, dev sources) read from **`config/maintenance-audit`** via `useMaintenanceAudit`. GFN app IDs read from **`config/gfn-catalog`** via `useGfnCatalog`. Wishlist candidates read from **`config/steam-wishlist-candidates`** via `useSteamWishlistCandidates`.

**Errors section** — aggregated via `collectAppErrors()` (`appErrors.js`):

- **`config/maintenance-errors`** entries (HLTB, ITAD, vetting, steam-sync, etc.)
- Subscription / game load failures (runtime)
- Action-level: runtime errors from sync buttons

### Error presentation

- **Severity taxonomy:** `error` / `warning` / `info`
- **Grouped** by severity, then source — duplicate messages collapsed with counts
- **Detail** per entry — timestamps, game name/app ID, message, optional detail
- **Clear info** button — calls `clearMaintenanceInfoErrors` (removes info entries from `maintenance-errors`)
- **Weekly purge** — stale info entries (>7d) removed from `maintenance-errors` on scheduled sync (`purgeStaleInfoFields`)

**Acknowledge dot** — yellow on Maintenance button; fingerprint in `localStorage`.

## Config docs (schema v3)

| Doc ID | Purpose |
| :--- | :--- |
| `maintenance-errors` | `{ entries: { [entryId]: ErrorEntry } }` |
| `maintenance-audit` | UI snapshot: metaLoad, gfn, devSources, errorsSummary, lastRevet |
| `steam-library-sync` | Last library sync counters |
| `steam-ownership-sync` | Last Steam ownership reconcile stats |
| `steam-wishlist-candidates` | Wishlist titles not yet in Firestore |
| `third-party-health` | HLTB/ITAD health summary |

## Error reporting pattern

- `reportError(context, err, setError)` — logs + user message (`errorReport.js`)
- `functions/deadline-exceeded` → timeout hint for long syncs
- Vetting failures on add: game **saved**, error recorded in `maintenance-errors`, modal stays open

## Related callables

| Callable | Purpose | UI status |
| :--- | :--- | :--- |
| `syncDevSources` | Refresh vetting source lists in Firestore | ✅ Maintenance |
| `revetAllGames` | Bulk re-vet all games | ✅ Maintenance |
| `vetGameDevelopers` | Per-game re-vet | ✅ edit modal |
| `clearMaintenanceInfoErrors` | Clear info-level maintenance errors | ✅ Maintenance |

## Migration

Production databases on legacy `config/default` must run `npm run migrate-config-v3` before deploying functions that read v3 paths only.

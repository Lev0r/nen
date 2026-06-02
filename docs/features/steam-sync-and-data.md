# Steam Sync & Third-Party Data

**Spec:** [`manifest_of_understanding.md`](../manifest_of_understanding.md) § F5, F6  
**Related:** [Maintenance](./maintenance-and-errors.md) · [Bulk import](./bulk-import.md) · [OPS](../OPS.md)

## Schema v2 (nested)

| Object | Cadence (non-banned) |
| :--- | :--- |
| `steamStatic` | Daily (TBA/EA); weekly (released) |
| `steamDynamic` | Daily (7d if `finished`) |
| `steamStats` | Player sample each 6h run; **omitted for TBA** |

Store region: **`cc=ua`** (UAH, English). All Steam HTTP in Cloud Functions (`functions/steam.js`, `steamCache.js`).

## Callables & schedules

| Export | Type | Purpose |
| :--- | :--- | :--- |
| `previewSteamGame` | Callable | Scrape-only preview for add flow (no write) |
| `addGameFromSteam` | Callable | Scrape + write + HLTB/ITAD enrich + RU vet |
| `syncSteamLibrary` | Callable | Manual full sync ("Load meta info") |
| `syncLibrarySteam` | Scheduled | Every **6 hours** — gated per-game sync |
| `syncGfnCatalog` | Callable | GFN GraphQL → `config/gfn-catalog` |
| `syncSteamOwnership` | Callable | Reconcile `owned.user0/user1` from Steam Web API |
| `syncGfnCatalogScheduled` | Scheduled | Weekly |

Client: `src/services/cloudFunctions.js` — metadata/GFN/dev sync callables use **540s** timeout; `syncSteamOwnership` uses **120s**.

## Third-party

| Service | Writes to | Requires |
| :--- | :--- | :--- |
| HLTB | `steamStatic.hltb` (playtime data only) | Unofficial API (fragile) |
| ITAD | `steamDynamic` critics, historical low | `ITAD_API_KEY` |
| GFN | `config/gfn-catalog.steamAppIds` | `GFN_VPC_ID` (default Warsaw) |

HLTB/ITAD failures are recorded in `config/maintenance-errors`, not on game documents.

## GFN badge

UI checks **global catalog** at render time — not per-game `geforceNowReady` field alone.

## Cost / scale

~700 writes/day @ 147 games. Timeout risk grows ~400–500 games — may need batching.

## Steam Web API foundation (implemented)

Low-level client in `functions/steamWebApi.js` — used by upcoming ownership/wishlist sync callables (Chunks 3–4).

| Function | Steam endpoint | Returns |
| :--- | :--- | :--- |
| `getOwnedGames(steamId)` | `IPlayerService/GetOwnedGames/v1` | `{ appIds: number[], error }` |
| `getWishlist(steamId)` | `IPlayerService/GetWishlist/v1` | `{ appIds: number[], error }` |
| `getConfiguredSteamIds()` | — | `{ user0, user1 }` from env |

**Env (functions only — see [`OPS.md`](../OPS.md)):**

| Variable | Purpose |
| :--- | :--- |
| `STEAM_WEB_API_KEY` | [Steam Web API key](https://steamcommunity.com/dev/apikey) |
| `STEAM_ID_0`, `STEAM_ID_1` | 64-bit Steam IDs for User 0 / User 1 |

**Requirements:** Each Steam profile must be **public** and **game details** must be visible — private profiles return structured errors, not app ID lists.

Calls use a **300ms** delay between requests (same as `steamSync.js`) to stay rate-limit friendly.

Errors use structured `{ appIds: null, error: '...' }` — missing key, invalid Steam ID, HTTP failure, or private profile.

## Steam library sync (ownership) — implemented

Callable **`syncSteamOwnership`** reconciles `owned.user0` / `owned.user1` on every game doc against each user's Steam **owned games** list (`getOwnedGames`). Distinct from the 6h **metadata** sync (`syncLibrarySteam` / `syncSteamLibrary`).

| Write target | Fields |
| :--- | :--- |
| Game docs | `owned.user0`, `owned.user1` |
| `config/steam-ownership-sync` | `syncedAt`, `user0OwnedCount`, `user1OwnedCount`, `gamesUpdated`, `gamesChecked`, `errors` |
| `config/maintenance-audit` | `steamOwnership` snapshot for Maintenance UI |
| `config/maintenance-errors` | API / per-game update failures (`source: steam-ownership`) |

Games in Firestore but not in a user's Steam library get that user's owned flag set to **false** (full reconcile when both libraries fetch successfully). Partial reconcile when only one user's library is available.

Maintenance UI: **Sync Steam ownership** button (`MaintenanceModal.jsx`).

## Planned (user request)

### Steam wishlist sync

- Pull each user's public Steam wishlist via Web API (`getWishlist`)
- Surface **new** wishlist titles not yet in Firestore — candidate games to add (lifecycle `active` or dedicated flow)
- Callable `syncSteamWishlists` — not yet implemented

## See also

- [RU vetting](./ru-developer-vetting.md) — runs on add after scrape
- [Lifecycle](./lifecycle-and-ownership.md) — banned skip, finished throttle
- [UI shell](./ui-shell-and-modals.md) — two-phase add via `previewSteamGame`

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
| `refreshGameFromSteam` | Callable | Manual single-game re-scrape (GameEditModal) |
| `syncLibrarySteam` | Scheduled | Every **6 hours** — gated per-game sync |
| `syncGfnCatalog` | Callable | GFN GraphQL → `config/gfn-catalog` |
| `syncSteamOwnership` | Callable | Reconcile `owned.user0/user1` from Steam Web API |
| `syncSteamWishlists` | Callable | Pull wishlists → candidate games not in Firestore |
| `syncGfnCatalogScheduled` | Scheduled | Weekly |

Client: `src/services/cloudFunctions.js` — metadata/GFN/dev sync callables use **540s** timeout; `syncSteamOwnership` and `refreshGameFromSteam` use **120s**; `syncSteamWishlists` uses **540s** (co-op filter scrapes store pages).

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

Low-level client in `functions/steamWebApi.js` — used by ownership and wishlist sync callables.

| Function | Steam endpoint | Returns |
| :--- | :--- | :--- |
| `getOwnedGames(steamId)` | `IPlayerService/GetOwnedGames/v1` | `{ appIds: number[], error }` |
| `getWishlist(steamId)` | `IWishlistService/GetWishlist/v1` | `{ appIds: number[], error }` |
| `getConfiguredSteamIds()` | — | `{ user0, user1 }` from env |

**Env (functions only — see [`OPS.md`](../OPS.md)):**

| Variable | Purpose |
| :--- | :--- |
| `STEAM_WEB_API_KEY` | Plain 32-char hex key from [Steam Web API key registration](https://steamcommunity.com/dev/apikey) — e.g. `C1F410E37C14EC0A…` (not a URL) |
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

## Steam wishlist sync — implemented

Callable **`syncSteamWishlists`** pulls each user's public Steam wishlist via `getWishlist`, compares against Firestore game doc IDs, and stores **co-op-only candidates** (Steam category IDs 9/38/39/48) not yet in the library. Each candidate is enriched with the store page name via `fetchStoreCoopAndName`.

| Write target | Fields |
| :--- | :--- |
| `config/steam-wishlist-candidates` | `syncedAt`, `candidates[]`, `user0WishlistCount`, `user1WishlistCount`, `preFilterCandidateCount`, `nonCoopSkipped`, `scrapeFailed`, `candidateCount`, `errors` |
| `config/maintenance-audit` | `steamWishlist` snapshot for Maintenance UI |
| `config/maintenance-errors` | API failures (`source: steam-wishlist`) |

Each candidate: `{ appId, name, onWishlistUser0, onWishlistUser1 }`. Partial sync when only one user's wishlist is available.

Maintenance UI: **Sync Steam wishlists** button + co-op candidate list (game name links to Steam store) with per-row **Add** (reuses `previewSteamGame` → `addGameFromSteam`). Duplicate guard if a game was added since the last sync.

## See also

- [RU vetting](./ru-developer-vetting.md) — runs on add after scrape
- [Lifecycle](./lifecycle-and-ownership.md) — banned skip, finished throttle
- [UI shell](./ui-shell-and-modals.md) — two-phase add via `previewSteamGame`

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
| `addGameFromSteam` | Callable | Scrape + write + HLTB/ITAD enrich + RU vet |
| `syncSteamLibrary` | Callable | Manual full sync ("Load meta info") |
| `syncLibrarySteam` | Scheduled | Every **6 hours** — gated per-game sync |
| `syncGfnCatalog` | Callable | GFN GraphQL → `config/default.gfnCatalog` |
| `syncGfnCatalogScheduled` | Scheduled | Weekly |

Client: `src/services/cloudFunctions.js` — sync callables use **540s** timeout.

## Third-party

| Service | Writes to | Requires |
| :--- | :--- | :--- |
| HLTB | `steamStatic.hltb` | Unofficial API (fragile) |
| ITAD | `steamDynamic` critics, historical low | `ITAD_API_KEY` |
| GFN | `config/default.gfnCatalog.steamAppIds` | `GFN_VPC_ID` (default Warsaw) |

## GFN badge

UI checks **global catalog** at render time — not per-game `geforceNowReady` field alone.

## Cost / scale

~700 writes/day @ 147 games. Timeout risk grows ~400–500 games — may need batching.

## See also

- [RU vetting](./ru-developer-vetting.md) — runs on add after scrape
- [Lifecycle](./lifecycle-and-ownership.md) — banned skip, finished throttle

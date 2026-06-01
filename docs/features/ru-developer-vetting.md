# RU Developer Vetting

**Spec:** [`manifest_of_understanding.md`](../manifest_of_understanding.md) § F4  
**Related:** [Maintenance](./maintenance-and-errors.md) · [Bulk import](./bulk-import.md) · [OPS](../OPS.md)

## Philosophy

**Deterministic, curated sources only** — no Gemini, no OpenCorporates. Citations in `ruDeveloperExplanation` (markdown links for curators; NE GRAI plain text).

## Sources (current)

| Source | ID | Flags when |
| :--- | :--- | :--- |
| NE GRAI extension list | `ne_grai` | Developer/publisher name match (~3800 names) |
| Curator PlayUA | `42985013` | App on **not_recommended** or **informational** list |
| Curator Avoid RU | `45452241` | App on **not_recommended** or **informational** |
| Curator Sich 1–5 | `37941500`, `44677918`, `45525669`, `45830587`, `45985173` | Same flagged rec types |
| Avoid RU **recommended** | — | **Does not flag** (curator clearance); does **not** override NE GRAI |

GameDev DOU — documented context only, no lookup.

Runtime reads **Firestore `devBgCheck.sources` only** (`ensureLiveDevSources` in `devSources.js`). Bundled JSON in `functions/data/` is dev export — not used in production.

## Pipeline

```
syncDevSources → devBgCheck.sources (Firestore)
       ↓
vetAllDevelopers → devBgCheck.developers cache (per studio)
       ↓
aggregateGameVetting(game) → ruDeveloperAlert + ruDeveloperExplanation
```

1. Game app ID vs curator **flagged** sets
2. Each `steamStatic.developers[]` — cache or `lookupDeterministicSources`
3. Dedupe explanations → join with ` | `

**Incremental sync** — weekly job resumes partial curator fetches; marks curators complete when done.

## Entry points

| Trigger | forceRefresh |
| :--- | :--- |
| `addGameFromSteam` | No |
| `vetGameDevelopers` (UI "Run dev check") | **Yes** |
| `revetAllGames` (Maintenance) | **Yes** |
| `scripts/import-games.mjs` | No (batch pre-vet) |
| `scripts/revet-ru-games.mjs` | **Yes** |

Manual RU toggle in edit modal updates **game doc only** — does not clear global dev cache.

## Key files

- `functions/devSources.js` — lookups (Firestore-only)
- `functions/curatorRegistry.js` — curator IDs incl. Sich 1–5
- `functions/devVetting.js` — orchestration
- `functions/devBgCheck.js` — cache + `aggregateGameVetting`
- `functions/devSourceSync.js` — weekly + incremental sync
- `functions/data/*.json` — optional local export (not runtime fallback)

## UI

- Red border + RU badge on card (`textWithLinks.jsx` for citations)
- Filter: **RU alert** (`ruOnly` in `gameFilters.js`)
- Edit modal: toggle + **Run dev check**
- Maintenance: **Sync dev sources**, freshness/counts, **Re-vet all games**

## Ops after source change

1. Deploy functions (or `--to-firestore` / Maintenance → Sync dev sources)
2. Re-vet — Maintenance → Re-vet all games, or `node scripts/revet-ru-games.mjs`

See [OPS](../OPS.md) — no DB wipe required for source updates.

## Gaps

- `lookupCuratorClearanceByAppId` exists but unused in aggregation
- Weekly scheduled sync does not build optional dev-name index by default (`--build-dev-index`)

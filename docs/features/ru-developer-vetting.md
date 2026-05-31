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
| Avoid RU **recommended** | — | **Does not flag** (curator clearance); does **not** override NE GRAI |

GameDev DOU — documented context only, no lookup.

### Planned (not implemented)

**Sich — Ukrainian Spirit** network:

- Group: https://steamcommunity.com/groups/sich-ukrainian-spirit
- Related groups: `sich_ua2`, `sich_ua3`, `sich_ua4`, `sich_ua5`
- Curators (2000-review limit split): `37941500`, `44677918`, `45525669`, `45830587`, `45985173`

Prefer syncing these **Steam curators** (same API as PlayUA/Avoid RU), not scraping group discussion pages.

## Pipeline

```
syncDevSources → devBgCheck.sources (Firestore) + bundled JSON
       ↓
vetAllDevelopers → devBgCheck.developers cache (per studio)
       ↓
aggregateGameVetting(game) → ruDeveloperAlert + ruDeveloperExplanation
```

1. Game app ID vs curator **flagged** sets
2. Each `steamStatic.developers[]` — cache or `lookupDeterministicSources`
3. Dedupe explanations → join with ` | `

## Entry points

| Trigger | forceRefresh |
| :--- | :--- |
| `addGameFromSteam` | No |
| `vetGameDevelopers` (UI "Run dev check") | **Yes** |
| `scripts/import-games.mjs` | No (batch pre-vet) |
| `scripts/revet-ru-games.mjs` | **Yes** |

Manual RU toggle in edit modal updates **game doc only** — does not clear global dev cache.

## Key files

- `functions/devSources.js` — lookups
- `functions/devVetting.js` — orchestration
- `functions/devBgCheck.js` — cache + `aggregateGameVetting`
- `functions/devSourceSync.js` — weekly sync
- `functions/data/*.json` — bundled fallback

## UI

- Red border + RU badge on card (`textWithLinks.jsx` for citations)
- Filter: **RU alert** (`ruOnly` in `gameFilters.js`)
- Edit modal: toggle + **Run dev check**

## Ops after source change

1. Deploy functions (or call `syncDevSources`)
2. `node scripts/revet-ru-games.mjs`

See [OPS](../OPS.md) — no DB wipe required for source updates.

## Gaps

- No Maintenance UI for `syncDevSources` or bulk re-vet
- `lookupCuratorClearanceByAppId` exists but unused in aggregation
- Sich curators not in codebase yet
- Weekly scheduled sync does not build optional dev-name index by default

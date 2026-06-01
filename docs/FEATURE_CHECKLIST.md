# Feature Checklist

**Last updated:** 2026-06-01  
Track implemented, pending, deferred, and dropped features. Update when shipping.

**Legend:** ✅ Done · 🔄 In progress / partial · ⏳ Pending ops · 📋 Planned · 🚫 Dropped · ⏸ Deferred

---

## Core platform

| Feature | Status | Notes |
| :--- | :---: | :--- |
| React + Vite SPA | ✅ | |
| Firebase Auth (Google, 2 users) | ✅ | [auth-and-access.md](./features/auth-and-access.md) |
| Auth loading spinner | ✅ | `LoginGate` — no blank flash |
| Firestore real-time games subscription | ✅ | `useGames` in `db.js` |
| Firestore security rules | ✅ | Config write server-only |
| Cloud Functions europe-west1 | ✅ | [OPS.md](./OPS.md) |
| Firebase Hosting | ✅ | `dist/` after `npm run build` |

---

## Game library & schema

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Schema v2 nested Steam objects | ✅ | No v1 compat |
| Add game from Steam URL/App ID | ✅ | Duplicate guard |
| Two-phase add (`previewSteamGame` + co-op confirm) | ✅ | Preview scrape → co-op warning → persist |
| AddGameModal Escape + backdrop dismiss | ✅ | Parity with other modals |
| Game edit modal (full metadata) | ✅ | |
| Steam tags on scrape | ✅ | Genres + co-op categories |
| Co-op specs (online/split/cross) | ✅ | From Steam category IDs |
| Screenshots modal | ✅ | |
| Per-user notes + lifecycle notes | ✅ | |
| Bulk import script | ✅ | Real prod import ⏳ |
| Library JSON export | ⏸ | P1 deferred |

---

## Lifecycle & ownership

| Feature | Status | Notes |
| :--- | :---: | :--- |
| 5 lifecycle states + sidebar tabs | ✅ | |
| **TBA games — separate sub-tab under Active** | ✅ | Default Active excludes TBA |
| Lifecycle modal + update badge | ✅ | |
| `hasUpdateSinceState` from sync | ✅ | |
| Finished rating 1–5 stars | ✅ | |
| Ownership quick toggle on card | ✅ | |
| Banned tab passcode | ⏸ | Deferred |

---

## Total Hype

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Formula (tier × ownership × status × reviews × critics) | ✅ | |
| Overrides: RU / finished / banned → 0 | ✅ | |
| Hype ring + hover breakdown | ✅ | |
| Per-user tier picker (DRG theme) | ✅ | |
| MetacriticFactor + ITAD fallback | ✅ | |
| Sort library by Total Hype | ✅ | Client-side compute |
| Dynamic BG from top 5 hype | ✅ | Screenshots, env gate |
| **Card visibility vs dynamic BG** | ✅ | Reduced BG noise; dimmed unhovered thumbnails |
| Clash Display + General Sans fonts | ✅ | Card redesign, reduced visual noise |

---

## Steam sync & enrichment

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Steam scrape (UA region, UAH) | ✅ | |
| Scheduled 6h library sync | ✅ | Gated per game/lifecycle |
| Manual "Load meta info" | ✅ | Maintenance modal |
| HLTB playtime | ✅ | Fragile unofficial API |
| ITAD critics + historical low | ✅ | Needs `ITAD_API_KEY` |
| GFN catalog sync + badge | ✅ | Weekly + manual |
| Player stats (official API, 28 samples) | ✅ | Skip TBA/banned |
| Refresh single game from Steam | 📋 | P1 — not built |
| **Steam wishlist sync** (new games) | 📋 | **User request** — Web API key + public profiles |
| **Steam library sync** (ownership) | 📋 | **User request** — reconcile `owned.user0/user1` from Steam libraries |
| "Ready to Play" filter preset | ⏸ | Use chips instead |

---

## RU developer vetting

| Feature | Status | Notes |
| :--- | :---: | :--- |
| NE GRAI publisher list | ✅ | ~3800 names |
| Curator PlayUA (42985013) | ✅ | Flagged rec types only |
| Curator Avoid RU (45452241) | ✅ | Recommended = clearance |
| **Sich Ukrainian Spirit curators (×5)** | ✅ | 37941500, 44677918, 45525669, 45830587, 45985173 |
| Firestore-only runtime sources | ✅ | No bundled JSON fallback in production |
| Incremental curator sync | ✅ | Resumable weekly sync |
| `--to-firestore` seed script | ✅ | `sync-dev-sources.mjs --to-firestore` |
| Developer cache (`devBgCheck.developers`) | ✅ | |
| Weekly source sync to Firestore | ✅ | Scheduled + Maintenance UI |
| Game-level `aggregateGameVetting` | ✅ | App ID + dev names |
| RU filter toggle | ✅ | |
| Manual "Run dev check" | ✅ | |
| Manual RU toggle per game | ✅ | Does not clear cache |
| Bulk `revet-ru-games.mjs` | ✅ | CLI only |
| Bulk re-vet via Maintenance UI | ✅ | `revetAllGames` callable |
| Curator rec type parsing | ✅ | Commit 9e3f1fd |
| **Maintenance: dev BG source controls** | ✅ | Sync button, freshness, counts, re-vet |
| Gemini vetting | 🚫 | Removed 2026-05-31 |
| OpenCorporates | 🚫 | Removed |

---

## Filters & search

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Text search (game name) | ✅ | |
| Lifecycle / tag / status / ownership filters | ✅ | |
| Sale / GFN / update / RU toggles | ✅ | |
| Global scope when any filter active | ✅ | |
| Tab click resets filters | ✅ | |
| Clear filters in header | ✅ | |
| **Remove co-op tags from filter UI** | ✅ | Co-op tag chips hidden |
| **Co-op warning on add game** | ✅ | Two-phase confirm if no co-op categories 9/38/39/48 |

---

## UI & maintenance

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Mint glassmorphism design system | ✅ | |
| Sidebar layout | ✅ | |
| Maintenance modal + error log | ✅ | |
| Error acknowledge dot | ✅ | |
| **Errors panel — group by source/severity** | ✅ | Counters, clear info, weekly purge |
| Mobile UX pass | 📋 | P1 |
| News feed UI | 🚫 | Dropped |

---

## Ops & deployment

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Deploy runbook | ✅ | [OPS.md](./OPS.md) |
| Env var documentation | ✅ | |
| Production smoke test checklist | ⏳ | User-driven |
| **Local Cloud Functions testing** | 📋 | **User request** — emulator workflow documented + validated |
| Real import of 147 games | ⏳ | `docs/all games.json` ready — **M7 pending** |
| Post-deploy RU source refresh | ✅ | Maintenance UI or `--to-firestore` + re-vet |
| CI/CD pipeline | ⏸ | Deferred |

---

## Session log — 2026-06-01 (shipped)

- Auth spinner; AddGame dismiss; co-op filter tag removal
- Card redesign; Clash Display + General Sans; reduced visual noise
- TBA sub-tab under Active (default Active excludes TBA)
- `previewSteamGame` + co-op confirm two-phase add
- Firestore-only dev sources; Sich 5 curators; incremental sync; `--to-firestore` script
- Maintenance dev BG UI (sync, freshness, re-vet)
- Error severity taxonomy; grouping; counters; clear info; weekly purge

## Session log — 2026-05-31 (shipped)

- Lists-only RU vetting (Gemini removed)
- Maintenance modal (Load meta, GFN, errors)
- RU filter + manual Run dev check
- Import fixes + revet script
- Curator recommended vs flagged parsing
- Client sync timeout 540s; useGames id fix

---

## Smoke test checklist (before/after import)

- [ ] Sign in as both allowed users — auth spinner, no blank flash
- [ ] Add Game → preview → co-op confirm (try with/without co-op tags)
- [ ] Add Game → Escape / backdrop dismiss
- [ ] Maintenance → Load meta info
- [ ] Maintenance → Sync dev sources → verify freshness + counts
- [ ] Maintenance → Re-vet all games (after source sync)
- [ ] Maintenance → errors grouped by severity/source; clear info
- [ ] RU filter + Run dev check in edit modal
- [ ] Active tab vs TBA sub-tab counts
- [ ] Lifecycle tabs + filter reset on tab change
- [ ] Global filters (e.g. Banned from Active tab)
- [ ] Co-op tags absent from filter chip list
- [ ] Sync GFN
- [ ] Dynamic background + card readability (dimmed thumbnails)
- [ ] Edit modal scrollable; hype picker readable
- [ ] Wishlist / library ownership sync (when implemented)

---

## Agent maintenance

When completing work:

1. Update status in this file
2. Add decision to [DECISIONS.md](./DECISIONS.md) if non-obvious
3. Update relevant [features/](./features/) doc
4. Add debt to [CODE_IMPROVEMENTS.md](./CODE_IMPROVEMENTS.md) if found

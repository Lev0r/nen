# Agent Handoff & TODO — Nen?

**Last updated:** 2026-05-31  
**Repo:** https://github.com/Lev0r/nen  
**Firebase project:** `nen-tracker` (CLI alias: `staging` in `.firebaserc`)

This file is the **single progress tracker and onboarding doc** for the next AI agent or developer session. Read this first, then `manifest_of_understanding.md` (spec) and `ai_rules.md` (constraints).

---

## 0. Session log — 2026-05-31

### Shipped today

| Area | Change |
| :--- | :--- |
| **RU vetting** | **Lists-only** — NE GRAI JSON + Steam curator app-ID lists (`functions/devSources.js`, `devVetting.js`). **Gemini removed entirely.** OpenCorporates removed earlier. |
| **Game-level vetting** | `aggregateGameVetting()` checks curator lists by **game app ID** + per-developer list lookup. All library states vetted on import / manual check. |
| **Maintenance UI** | Sidebar **Maintenance** modal: Load meta info, Sync GeForce NOW, error log with timestamps, acknowledge dot. Renamed from “Sync Steam”. |
| **RU filter** | Filters bar toggle **RU alert** — searches full library when any filter active. |
| **Manual dev check** | Game edit → **Run dev check** (`vetGameDevelopers` callable) — any lifecycle state including banned; bypasses dev cache (`forceRefresh`). |
| **Import** | Legacy `"Title on Steam"` links resolved via `scripts/fix-steam-links.mjs`. Bulk import vets **all** games. `scripts/revet-ru-games.mjs` backfills RU flags. |
| **Client fixes** | Callable sync timeout 540s; `useGames` uses doc ID; clearer empty states. |

### Decisions (2026-05-31)

| Decision | Reason |
| :--- | :--- |
| **Drop Gemini vetting** | Redundant with deterministic lists; open-research Gemini adds hallucination risk and contradicts “curated sources only”. |
| **No DB wipe required** after Gemini removal | Game docs and cache remain valid; run `node scripts/revet-ru-games.mjs` to refresh `ruDeveloperAlert` from lists if import skipped vetting. |
| **Keep `vettingError` fields** | Harmless legacy; may surface old Gemini failures until cleared by successful dev check. |

---

## 1. Read order

| Priority | File | Purpose |
| :--- | :--- | :--- |
| 1 | **`docs/AGENT_TODO.md`** (this file) | Status, decisions, remaining work, ops |
| 2 | **`docs/manifest_of_understanding.md`** | Schema, Total Hype formula, feature specs |
| 3 | **`docs/ai_rules.md`** | Anti-hardcoding, simplicity, workflow rules |
| 4 | **Past chat transcript** (if continuing a session) | Search by feature name before re-implementing |

---

## 2. Product summary

**Nen?** is a two-user co-op game library tracker (React + Vite SPA, Firebase). Users import games from Steam, assign lifecycle states, personal hype tiers, ownership, and filters. Total Hype drives sort order and dynamic background imagery.

**Users:** exactly two — abstract **User 0** / **User 1** (never hardcode names in UI).

---

## 3. Architecture & code map

```
nen/
├── docs/
│   ├── AGENT_TODO.md          ← progress + handoff (this file)
│   ├── manifest_of_understanding.md
│   └── ai_rules.md
├── functions/                 # Node 20, region europe-west1
│   ├── index.js               # addGameFromSteam, vetGameDevelopers (callable)
│   ├── devVetting.js          # RU developer vetting (NE GRAI + curator lists)
│   ├── devSources.js          # Bundled source data + lookups
│   ├── devBgCheck.js          # Developer vet cache on config/default
│   ├── devSourceSync.js       # Weekly sync of NE GRAI + curator JSON → Firestore
│   ├── steam.js               # Steam scrape (cc=ua, UAH), schema v2 nested writes
│   ├── gfnSync.js             # Full GFN catalog → Firestore config
│   ├── steamSync.js           # syncLibrarySteam — unified 6h gated Steam sync
│   ├── steamCache.js          # In-memory JSON cache for Steam HTTP
│   └── .env                   # ALLOWED_EMAIL_0/1, GFN_VPC_ID, ITAD_API_KEY (NOT in git)
├── scripts/
│   ├── import-games.mjs       # One-time bulk import (no UI)
│   ├── revet-ru-games.mjs     # Re-apply list-based RU flags to existing library
│   ├── fix-steam-links.mjs    # Resolve legacy "Title on Steam" → store URLs
│   ├── sync-dev-sources.mjs   # Local sync of NE GRAI + curator JSON
│   └── test-dev-sources.mjs   # Smoke test for devSources lookups
├── src/
│   ├── components/
│   │   ├── DashboardShell.jsx     # Sidebar tabs, filters, grid, Maintenance entry
│   │   ├── MaintenanceModal.jsx   # Load meta / GFN, error log, acknowledge
│   │   ├── GameFiltersBar.jsx     # Search + filters incl. RU alert toggle
│   │   ├── GameCard.jsx           # Card UX, lifecycle badge, hype ring, footer actions
│   │   ├── GameEditModal.jsx      # Full metadata edit
│   │   ├── LifecycleModal.jsx     # 5-state picker + optional note + finished stars
│   │   ├── HypePicker.jsx         # Personal tier picker (portal)
│   │   ├── DynamicBackground.jsx  # Top-5 hype screenshot slideshow
│   │   ├── FinishedRatingPicker.jsx
│   │   ├── ScreenshotsModal.jsx   # Fullscreen zone navigation
│   │   ├── AddGameModal.jsx
│   │   └── ErrorBanner.jsx
│   ├── services/
│   │   ├── db.js                  # useGames, useAppConfig, updateGame, CONFIG_DOC_ID='default'
│   │   └── cloudFunctions.js
│   ├── utils/
│   │   ├── hypeScore.js           # Total Hype formula + overrides
│   │   ├── libraryState.js        # resolveLibraryState, labels, stateMeta helpers
│   │   ├── gameFilters.js         # filterGames, hasActiveFilters, DEFAULT_GAME_FILTERS
│   │   ├── gameAccessors.js       # Nested schema v2 field accessors (steamStatic/Dynamic/Stats)
│   │   ├── formatDuration.js      # Human-readable release/EA duration strings for tooltips
│   │   └── errorReport.js
│   ├── contexts/AuthContext.jsx
│   └── index.css                  # Mint glassmorphism design system
├── firestore.rules
├── firebase.json                  # hosting → dist/, functions, firestore rules
├── .env.local                     # VITE_* (NOT in git; see .env.example)
└── .env.example
```

### Critical Firestore paths

| Path | Notes |
| :--- | :--- |
| `artifacts/{appId}/public/data/games/{steamAppId}` | Game documents (`appId` usually `default_app`) |
| `artifacts/{appId}/public/data/config/default` | **Must use doc id `default`** — path must have **even segment count** (5-segment `.../config` was a past bug) |

Console: `artifacts` → `default_app` → `public` → `data` → `games` / `config` → `default`.

---

## 4. Key decisions (with reasons)

| Topic | Decision | Reason |
| :--- | :--- | :--- |
| **GFN badge** | Full catalog synced to `config/default.gfnCatalog.steamAppIds` (~2k IDs via GraphQL); badge checks catalog at render time | New library games get GFN badge without re-sync per game |
| **GFN region** | `GFN_VPC_ID=NP-WAW-01` (Warsaw) default | Eastern Europe catalog |
| **GFN re-sync on version refresh** | **Dropped** | Catalog is global; badge reads Firestore config |
| **Search & filters scope** | When **any filter is active** (`hasActiveFilters`), pool = **full library**; else pool = **current sidebar tab** | User can e.g. pick "Banned" lifecycle chip while on Active tab |
| **Sidebar navigation** | Clicking a lifecycle tab **resets all filters** to defaults | Avoid confusing tab + filter combinations |
| **Filter panel UX** | Expand via search focus or active filters; **button toggles** (not checkbox `:focus-within`) | Toggles were collapsing panel before applying |
| **Clear filters** | Button in filter **header** (next to count), visible when any filter active | Accessible even when panel collapsed |
| **Steam tags in filter UI** | Tag list built from **entire library**, not current tab | All tags visible for global filtering |
| **Dynamic background** | Top **5** non-banned games by Total Hype; uses **screenshots** (fallback thumbnail); 60s slide / 4s crossfade | Thumbnails looked blurry at full viewport |
| **Dynamic BG toggle** | `VITE_ENABLE_DYNAMIC_BG` — default **on** unless explicitly `'false'` at build time | No in-app toggle; redeploy to disable |
| **RU developer vetting** | **List-based only** — NE GRAI + Steam curator app lists; no Gemini | Deterministic, citable flags; `aggregateGameVetting` includes game app ID |
| **Developer vet cache** | `config/default.devBgCheck.developers` — keyed by normalized studio name | Cache hit skips re-lookup; manual **Run dev check** uses `forceRefresh` |
| **Bulk import RU vetting** | All imported games get `ruDeveloperAlert` via `aggregateGameVetting` | Not limited to `active` lifecycle |
| **Bulk import** | Script only (`scripts/import-games.mjs`), no UI button | One-time ~147 game migration; writes schema v2 (implemented — pending ops run) |
| **Game schema** | **v2 nested** — `steamStatic` / `steamDynamic` / `steamStats` | Locked pre-import; no v1 flat-field backward compat |
| **Steam sync** | Single job every **6h** with gates | Banned = skip all; TBA = no stats + daily static; EA/TBA daily static, released weekly static; player sample 4×/day |
| **Player counts** | Official Steam Web API only | `GetNumberOfCurrentPlayers` + rolling avg from max 28 samples |
| **Metacritic in hype** | `MetacriticFactor = 0.96 + (score/100)×0.08` | Range 0.96–1.04; missing = 1.0; after SteamReviewFactor |
| **Sync cost** | ~700 writes/day @ 147 games | Free tier OK; timeout risk ~400–500 games |
| **`steamInput` in JSON** | Same as Add Game: Steam URL or raw App ID | Consistent parsing via `parseAppId` |
| **Finished rating** | `finishedRating` 1–5; cleared when leaving `finished` | Stars on card + edit/lifecycle modals |
| **News feed UI** | **Dropped** | Replaced by `hasUpdateSinceState` pulse badge |
| **"Ready to Play" filter preset** | **Deferred** | Use ownership + lifecycle chips instead |
| **Page title** | Browser tab: **`Nen?`** only | User preference |
| **UI palette** | Mint accent (`#14e8a0`), dark glass; **no blue** in primary UI | Phase 9 redesign |
| **Layout** | Controls in **sidebar** (no top header bar) | Phase 9 |
| **Functions secrets** | `functions/.env` loaded on deploy — **not** Secret Manager | Documented project convention |
| **Functions region** | `europe-west1` | Latency + project standard |
| **Steam store region** | `cc=ua` (UAH prices, English text) | User locale |
| **Git workflow** | Commit/push only when user asks; verify `npm run build` after chunks | User preference |
| **Agent workflow** | User prefers **orchestrator splits chunks → subagents implement** | Past session pattern |

---

## 5. Environment variables

### Frontend (`.env.local` — copy from `.env.example`)

| Variable | Purpose |
| :--- | :--- |
| `VITE_FIREBASE_*` | Web app config from Firebase Console |
| `VITE_ALLOWED_EMAIL_0/1` | Must match Firestore rules + functions `.env` |
| `VITE_USER0_NICKNAME`, `VITE_USER1_NICKNAME` | Display names (never "Me"/"Friend") |
| `VITE_FIREBASE_FUNCTIONS_REGION` | `europe-west1` |
| `VITE_ENABLE_DYNAMIC_BG` | `true` default; set `false` + rebuild to disable BG |
| `VITE_USE_FUNCTIONS_EMULATOR` | `true` only with local emulators |

### Functions (`functions/.env` — copy from `functions/.env.example`)

| Variable | Purpose |
| :--- | :--- |
| `ALLOWED_EMAIL_0/1` | Callable auth gate |
| `GFN_VPC_ID` | Default `NP-WAW-01` |
| `ITAD_API_KEY` | IsThereAnyDeal price history (optional) |
| `ITAD_COUNTRY` | Default `UA` |

---

## 6. Deploy & ops runbook

**Prerequisites:** Firebase **Blaze** plan, `firebase login`, `firebase use staging`.

```bash
cd /mnt/c/Work/nen
npm run build                                    # hosting serves dist/ — build first
firebase deploy --only functions,firestore:rules,hosting
```

**Hosting only** (frontend CSS/JS changes):

```bash
npm run build && firebase deploy --only hosting
```

**After deploy — smoke test checklist:**

- [ ] Sign in as both allowed users
- [ ] Add Game (Steam URL) → scrape + list-based dev check
- [ ] Maintenance → Load meta info (540s client timeout)
- [ ] RU alert filter + Run dev check in edit modal
- [ ] Sidebar lifecycle tabs + filter reset on tab change
- [ ] Global filters (lifecycle chip "Banned" from Active tab)
- [ ] Sync GeForce button (or wait for weekly schedule)
- [ ] Dynamic background visible (screenshots rotating)
- [ ] Edit modal scrollable; hype picker readable

**Scheduled functions (deploy with functions):**

- `syncLibrarySteam` — every **6 hours**: gated dynamic/static/player sync, `hasUpdateSinceState` (replaces legacy `refreshLibraryVersions` / `versionRefresh.js`)
- `syncGfnCatalogScheduled` — weekly GFN catalog refresh

**Do not commit:** `.firebase/`, `.env.local`, `functions/.env`

---

## 7. Bulk import (blocked on ops prerequisites)

User JSON at `docs/all games.json` (147 games, legacy friend-export format). Schema v2 is implemented — import script writes nested `steamStatic` / `steamDynamic` / `steamStats`. **Still blocked on:** `firebase login`, DB wipe decision, `--dry-run`, then real import (see §10 **import-json**).

```bash
# Preview
npm run import-games -- path/to/games.json --dry-run

# Import
npm run import-games -- path/to/games.json --app-id default_app
```

**JSON format** — array of strings, canonical objects, or **legacy friend-export objects**:

```json
[
  "https://store.steampowered.com/app/105600/Terraria/",
  "570",
  {
    "steamInput": "1145360",
    "libraryState": "active",
    "owned": { "user0": true, "user1": false },
    "userNotes": { "user0": "want co-op", "user1": "" },
    "finishedRating": null
  },
  {
    "Game link": "https://store.steampowered.com/app/435150/Divinity_Original_Sin_2__Definitive_Edition/",
    "Lev0r owned": true,
    "Punpun owned": true,
    "Game status": "Active"
  }
]
```

**Legacy format** (auto-detected via `Game link` key): ownership keys resolve from `VITE_USER0_NICKNAME` / `VITE_USER1_NICKNAME` in `.env.local` (e.g. `"Lev0r owned"`, `"Punpun owned"`). `Game status` accepts Active/Finished/replayable/Waiting-for-updates/banned (case-insensitive, trims whitespace). Optional `Comment` → `stateMeta.note`.

**Auth for script:** `GOOGLE_APPLICATION_CREDENTIALS` **or** `firebase login` + `firebase use`.

**RU vetting:** list lookup for all developers; `aggregateGameVetting` on every imported game. Re-run: `node scripts/revet-ru-games.mjs`.

---

## 8. Filtering behavior (reference for agents)

Implemented in `DashboardShell.jsx` + `gameFilters.js` + `GameFiltersBar.jsx`.

| Condition | Game pool |
| :--- | :--- |
| No active filters | Current sidebar lifecycle tab only |
| Any active filter (`hasActiveFilters`) | **All games** in library |
| Sidebar tab click | Resets filters to `DEFAULT_GAME_FILTERS` |

**Active filter fields:** `searchText`, `steamTags[]`, `developmentStatus`, `ownership`, `onSaleOnly`, `gfnOnly`, `updateAvailableOnly`, `ruOnly`, `libraryStates[]`.

**Filter panel:** `expanded` React state; opens on search focus or when filters active; closes on outside click (if no active filters) or Escape.

---

## 9. Completed work (do not re-implement)

- [x] React + Vite SPA, Firebase Auth (User 0 / 1), Firestore hooks
- [x] Total Hype formula + overrides (RU alert, finished, banned → 0)
- [x] Lifecycle system (5 states, modal, sidebar tabs, update badge, `syncLibrarySteam` scheduler)
- [x] Add Game + duplicate guard + Steam caching + `steamTags`
- [x] GFN GraphQL catalog sync + client badge from global catalog
- [x] Error reporting (`reportError`, `ErrorBanner`)
- [x] Full GameEditModal + per-user notes + manual RU flag
- [x] Phase 9 UI: sidebar controls, mint palette, card polish, fullscreen screenshots, edit toggles
- [x] Firestore config path fix (`config/default`)
- [x] Search & filters v2 (global scope, lifecycle chips, GFN/update toggles)
- [x] Finished rating 1–5 stars
- [x] Dynamic background (screenshots, top 5 hype, env gate)
- [x] Browser title `Nen?` + mint favicon
- [x] Bulk import script + list-based dev vetting in `addGameFromSteam`
- [x] Developer background-check cache (`devBgCheck`) + bundled source lists (`devSources`)
- [x] Maintenance modal + RU filter + manual Run dev check
- [x] Remove Gemini and OpenCorporates from vetting pipeline
- [x] Filter UX fixes: header clear button, tag height, stable toggle panel
- [x] Hype picker + edit modal readability/height fixes
- [x] **Schema v2 backend** — nested `steamStatic` / `steamDynamic` / `steamStats` in `steam.js` + `addGameFromSteam` (no v1 backward compat)
- [x] **`syncLibrarySteam`** — unified 6h scheduled job in `steamSync.js` (replaced `versionRefresh.js`)
- [x] **Metacritic in hype formula** — `MetacriticFactor` in `hypeScore.js`; hover breakdown updated
- [x] **GameCard tooltips + badges** — avg players ("Now: N"), reviews all+recent, version + `lastUpdateAt`, release/EA durations via `formatDuration.js`
- [x] **Frontend schema v2 migration** — `gameAccessors.js`; `GameCard`, filters, hype, modals, dynamic BG read nested paths
- [x] **Import script v2 paths** — `scripts/import-games.mjs` writes nested steam objects
- [x] **Sync policy implemented** — 6h gated job, banned skip-all, TBA no stats, static/dynamic cadences, official Steam player API only
- [x] **Sync cost model** — ~700 writes/day @ 147 games; timeout risk ~400–500 games

---

## 10. Remaining tasks

### P0 — Import + deploy (user-driven)

| ID | Task | Details |
| :--- | :--- | :--- |
| **manual-test** | Execute manual testing checklist | Run §6 smoke test list **before** bulk import — verify v2 reads/writes, sync job, tooltips, filters |
| **import-json** | Run bulk import | JSON at `docs/all games.json` (147 games). Dry-run validated. Real import + `revet-ru-games.mjs` if RU flags missing. **No DB wipe needed** for Gemini removal. |
| **deploy-verify** | Confirm production deploy | `firebase deploy --only functions,firestore:rules,hosting` (or split as needed). Run §6 smoke test after deploy + import. |

### P1 — Optional polish (discuss with user before building)

| ID | Task | Details / notes |
| :--- | :--- | :--- |
| **refresh-steam** | "Refresh from Steam" in GameEditModal | Re-scrape single game; update nested steam objects |
| **mobile-pass** | Mobile UX | Tooltips on touch, grid breakpoints, modals, sidebar drawer behavior |
| **json-export** | Library export | Client-side JSON backup of all game docs |
| **coop-warning** | Co-op warning on add | Warn if Steam categories lack co-op IDs (9, 38, 39, 48) |

### P2 — Deferred / low priority

| ID | Task | Details / notes |
| :--- | :--- | :--- |
| **wishlist-sync** | Scheduled wishlist import | Needs Steam Web API key + public Steam IDs + profiles |
| **banned-passcode** | Archive passcode for Banned tab | Optional privacy for two trusted users |
| **hosting-ci** | Document or script CI deploy | GitHub Action → build → `firebase deploy` |
| **nicknames-firestore** | Move nicknames to config doc | Env vars work today; optional centralization |
| **ready-to-play-preset** | Filter preset: both own + active | Explicitly deferred — use chips instead |

### Explicitly dropped (do not revive without user approval)

- Gemini / OpenCorporates developer vetting
- News feed UI
- Re-run GFN sync on every version refresh
- In-app dynamic background toggle

---

## 11. Known pitfalls (learned from past bugs)

1. **Firestore path segments** must be even — use `config/default`, not `config` alone.
2. **Filter panel** must not use `:focus-within` for expand/collapse — breaks toggles.
3. **Edit modal flex** — avoid `flex: 1 1 0` on body without explicit modal height; use `height: min(90vh, 820px)` + `flex: 1 1 auto`.
4. **GFN badge** reads `gfnCatalog.steamAppIds` Set client-side — `geforceNowReady` on doc is scrape-time snapshot but UI prefers catalog.
5. **`collectSteamTags`** for filter UI should use **all `games`**, not tab-scoped list.
6. **Commit/push** only when user explicitly asks.
7. **Schema v2** — no flat v1 Steam fields; banned games skip all sync; TBA games have no `steamStats`.

---

## 12. Agent workflow for next iteration

1. Read this file + `manifest_of_understanding.md` + `ai_rules.md`.
2. Search codebase before adding features (many Phase 9–15 pieces already exist).
3. For multi-step work: update **this file** (check off / add tasks), implement in focused chunks, run `npm run build`.
4. Use subagents for large parallel chunks if user requests orchestration.
5. Ask before: git commit, push, production deploy, bulk import without dry-run.
6. After completing tasks, update §9/§10 in this file and optionally sync brief notes into `manifest_of_understanding.md` if spec changed.

---

## 13. Cloud Functions reference

| Export | Type | Purpose |
| :--- | :--- | :--- |
| `addGameFromSteam` | Callable | Scrape + write game; list-based dev vetting → `ruDeveloperAlert` |
| `vetGameDevelopers` | Callable | Manual re-vet one game (`forceRefresh`); any lifecycle state |
| `syncSteamLibrary` | Callable | Manual full meta load (Steam + HLTB + ITAD); 540s timeout |
| `syncDevSources` | Callable | Manual sync of NE GRAI + curator JSON to Firestore |
| `syncDevSourcesScheduled` | Scheduled | Weekly source JSON refresh |
| `syncGfnCatalog` | Callable | Manual full GFN catalog sync |
| `syncGfnCatalogScheduled` | Scheduled | Weekly catalog refresh |
| `syncLibrarySteam` | Scheduled | Every **6 hours**: dynamic daily, static gated, player samples 4×/day, banned skip-all, `hasUpdateSinceState` |

Client wrappers: `src/services/cloudFunctions.js`.

---

*End of handoff. Update this file when shipping features or changing decisions.*

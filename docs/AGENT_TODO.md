# Agent Handoff & TODO — Nen?

**Last updated:** 2026-05-30  
**Repo:** https://github.com/Lev0r/nen  
**Firebase project:** `nen-tracker` (CLI alias: `staging` in `.firebaserc`)  
**Latest commit at handoff:** `e9c05f9`

This file is the **single progress tracker and onboarding doc** for the next AI agent or developer session. Read this first, then `manifest_of_understanding.md` (spec) and `ai_rules.md` (constraints).

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
│   ├── index.js               # addGameFromSteam (callable)
│   ├── steam.js               # Steam scrape (cc=ua, UAH), defaults on new games
│   ├── gemini.js              # RU developer vetting (multi-model fallback)
│   ├── gfnSync.js             # Full GFN catalog → Firestore config
│   ├── versionRefresh.js      # Scheduled version checks → hasUpdateSinceState
│   ├── steamCache.js          # In-memory JSON cache for Steam HTTP
│   └── .env                   # GEMINI_API_KEY, ALLOWED_EMAIL_0/1, GFN_VPC_ID (NOT in git)
├── scripts/
│   └── import-games.mjs       # One-time bulk import (no UI)
├── src/
│   ├── components/
│   │   ├── DashboardShell.jsx     # Sidebar tabs, filters, grid
│   │   ├── GameFiltersBar.jsx     # Search + expandable filters (React state, not :focus-within)
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
| **Gemini RU vetting** | Run **only** when final `libraryState === 'active'` (add game UI + bulk import) | Skip vetting for finished/banned/etc. imports |
| **Bulk import** | Script only (`scripts/import-games.mjs`), no UI button | One-time ~50 game migration |
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
| `GEMINI_API_KEY` | RU developer vetting |
| `ALLOWED_EMAIL_0/1` | Callable auth gate |
| `GFN_VPC_ID` | Default `NP-WAW-01` |

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
- [ ] Add Game (Steam URL) → scrape + Gemini if active
- [ ] Sidebar lifecycle tabs + filter reset on tab change
- [ ] Global filters (lifecycle chip "Banned" from Active tab)
- [ ] Sync GeForce button (or wait for weekly schedule)
- [ ] Dynamic background visible (screenshots rotating)
- [ ] Edit modal scrollable; hype picker readable

**Scheduled functions (deploy with functions):**

- `refreshLibraryVersions` — version checks, sets `hasUpdateSinceState`
- `syncGfnCatalogScheduled` — weekly GFN catalog refresh

**Do not commit:** `.firebase/`, `.env.local`, `functions/.env`

---

## 7. Bulk import (pending user JSON)

User will provide JSON from a friend. **Do not run against prod without `--dry-run` first.**

```bash
# Preview
npm run import-games -- path/to/games.json --dry-run

# Import
npm run import-games -- path/to/games.json --app-id default_app
```

**JSON format** — array of strings or objects:

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
  }
]
```

**Auth for script:** `GOOGLE_APPLICATION_CREDENTIALS` **or** `firebase login` + `firebase use`.

**Gemini:** only runs when saved `libraryState === 'active'`.

---

## 8. Filtering behavior (reference for agents)

Implemented in `DashboardShell.jsx` + `gameFilters.js` + `GameFiltersBar.jsx`.

| Condition | Game pool |
| :--- | :--- |
| No active filters | Current sidebar lifecycle tab only |
| Any active filter (`hasActiveFilters`) | **All games** in library |
| Sidebar tab click | Resets filters to `DEFAULT_GAME_FILTERS` |

**Active filter fields:** `searchText`, `steamTags[]`, `developmentStatus`, `ownership`, `onSaleOnly`, `gfnOnly`, `updateAvailableOnly`, `libraryStates[]`.

**Filter panel:** `expanded` React state; opens on search focus or when filters active; closes on outside click (if no active filters) or Escape.

---

## 9. Completed work (do not re-implement)

- [x] React + Vite SPA, Firebase Auth (User 0 / 1), Firestore hooks
- [x] Total Hype formula + overrides (RU alert, finished, banned → 0)
- [x] Lifecycle system (5 states, modal, sidebar tabs, update badge, version scheduler)
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
- [x] Bulk import script + Gemini gating in `addGameFromSteam`
- [x] Filter UX fixes: header clear button, tag height, stable toggle panel
- [x] Hype picker + edit modal readability/height fixes

---

## 10. Remaining tasks

### P0 — Next session (user-driven)

| ID | Task | Details |
| :--- | :--- | :--- |
| **import-json** | Run bulk import | User will supply JSON. Always `--dry-run` first. Confirm Gemini only on `active` entries. |
| **deploy-verify** | Confirm production deploy | User deploys manually. Verify smoke test list (§6). |

### P1 — Optional polish (discuss with user before building)

| ID | Task | Details / notes |
| :--- | :--- | :--- |
| **refresh-steam** | "Refresh from Steam" in GameEditModal | Re-scrape single game via callable or admin script; update price, tags, version, screenshots |
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
| `addGameFromSteam` | Callable | Scrape + write game; Gemini if `libraryState === 'active'` |
| `syncGfnCatalog` | Callable | Manual full GFN catalog sync |
| `syncGfnCatalogScheduled` | Scheduled | Weekly catalog refresh |
| `refreshLibraryVersions` | Scheduled | Steam version checks |

Client wrappers: `src/services/cloudFunctions.js`.

---

*End of handoff. Update this file when shipping features or changing decisions.*

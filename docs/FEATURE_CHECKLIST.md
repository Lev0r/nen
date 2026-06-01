# Feature Checklist

**Last updated:** 2026-06-01 (evening)
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
| Bulk import script | ✅ | Production library seeded (~147 games) |
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
| Dynamic BG from top 5 hype | ✅ | Screenshots today; **round 2:** gradient animation |
| **Card visibility vs dynamic BG** | ✅ | Reduced BG noise; dimmed unhovered thumbnails — **round 2:** always-dim baseline |
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
| Bulk `revet-ru-games.mjs` | ✅ | CLI; `--dry-run`, `--verbose`, decision trace |
| Bulk re-vet via Maintenance UI | ✅ | `revetAllGames` callable |
| Curator rec type parsing | ✅ | Commit 9e3f1fd |
| **Maintenance: dev BG source controls** | ✅ | Sync button, freshness, counts, re-vet |
| **NE GRAI exact match only** | ✅ | No substring/suffix stripping; regression tests |
| **RU alert message format + dedup** | ✅ | Short NE GRAI text; curator link only; dev+pub dedup |
| **`test-dev-sources.mjs` regression suite** | ✅ | NE GRAI false positives, format, curator dedup |
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
| **UI polish round 2** | 📋 | See [UI polish round 2](#ui-polish-round-2-planned) below |
| Mobile UX pass | 📋 | P1 (fold into round 2 or separate) |
| News feed UI | 🚫 | Dropped |

---

## Ops & deployment

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Deploy runbook | ✅ | [OPS.md](./OPS.md) |
| **Dev CLI handbook** | ✅ | [DEV_CLI.md](./DEV_CLI.md) — all admin scripts |
| Config schema v3 migration | ✅ | `npm run migrate-config-v3` |
| Env var documentation | ✅ | |
| Production smoke test | ✅ | Completed 2026-06-01 |
| **Local Cloud Functions testing** | 📋 | **User request** — emulator workflow documented + validated |
| Real import of 147 games | ✅ | Production library live |
| Post-deploy RU re-vet (logic-only changes) | ✅ | Re-vet only — no source re-sync unless lists changed |
| CI/CD pipeline | ⏸ | Deferred |

---

## Session log — 2026-06-01 (shipped)

**Morning — UI, lifecycle, maintenance**

- Auth spinner; AddGame dismiss; co-op filter tag removal
- Card redesign; Clash Display + General Sans; reduced visual noise
- TBA sub-tab under Active (default Active excludes TBA)
- `previewSteamGame` + co-op confirm two-phase add
- Firestore-only dev sources; Sich 5 curators; incremental sync; `--to-firestore` script
- Maintenance dev BG UI (sync, freshness, re-vet)
- Error severity taxonomy; grouping; counters; clear info; weekly purge

**Afternoon — config v3, RU vetting hardening, ops**

- Config schema v3: split `config/default` → dedicated docs; centralized `maintenance-errors` + `maintenance-audit`
- Dev sources v2 split across `config/dev-sources-*` Firestore docs
- NE GRAI **exact normalized match only** — fixes substring false positives (Rebellion, Iron Gate AB, etc.)
- RU alert messages simplified; dedupe developer+publisher and app+curator double-hits
- `docs/DEV_CLI.md` handbook; npm aliases for PowerShell-safe Firestore seed
- Sync/revet progress logging; `revet-ru-games --verbose` decision trace; dry-run source-load fix
- `test-dev-sources.mjs` regression suite (8 NE GRAI cases + format/dedup checks)

## UI polish round 2 (planned)

Structured backlog for the next card/shell pass. Primary files: `DynamicBackground.jsx`, `GameCard.jsx`, `index.css`, `GameEditModal.jsx`.

### 1. Background — gradient instead of screenshots

| Item | Detail |
| :--- | :--- |
| Replace screenshot carousel | Disable top-5 hype screenshot BG; use a slow, pleasant animated gradient instead |
| Motion | Subtle, eye-friendly; no harsh flicker |
| Env | Keep build-time toggle pattern (`VITE_ENABLE_DYNAMIC_BG` or successor) |

### 2. Card header — title only

| Item | Detail |
| :--- | :--- |
| Single-line header | After price moves out, header is **game name only** (one line, ellipsis) |
| Title row padding | Remove left/right padding on `.game-card-title-row` |
| Truncated title tooltip | Hover shows full game name when text overflows |

### 3. Meta line — price + finished rating

| Item | Detail |
| :--- | :--- |
| Move price/sale | Relocate from `.game-card-price-row` into `.game-card-meta-line` with pipe separators (version · critics · players · HLTB pattern) |
| Alignment | Left-aligned meta — do not center price |
| Sale / historical low | Keep sale styling + historical-low badge in meta |
| Both own | Keep rule: hide price when both users own |
| Finished rating | Move from tags row into meta, **after price** |
| Rating display | Show color-coded digit **1–5** only (not star badge in tags) |
| Rating tooltip | Hover: per-user label (nickname / “personal rating” / “owner rating”) |
| Rating click | Open `GameEditModal` scrolled to finished-rating section (mirror `editFocusNotes`) |

### 4. Thumbnail — always slightly dimmed

| Item | Detail |
| :--- | :--- |
| Baseline | All card thumbnails slightly darkened by default (less color noise, still readable) |
| Hover | Hovered card brightens + scale (keep current lift) |
| Change from today | Dim is **always on**; not only when another card is hovered (`:has(.game-card:hover)` grid rule) |

### 5. Thumbnail overlay icons — unified chrome

Applies to: screenshots, owned, lifecycle, total hype (and GFN if present).

| Item | Detail |
| :--- | :--- |
| Glow / outline | Consistent glow on all; fix missing hype glow and screenshots glow |
| Background | Unified semi-transparent pill BG (match screenshots style); hype ring must not use opaque fill |
| Shape | Keep circular indicators; unify `box-shadow`, border, and backdrop |

### 6. Footer — notes + edit

| Item | Detail |
| :--- | :--- |
| Notes button shape | Rectangular middle segment — no rounded corners |
| Separator | Visible divider between notes and edit buttons |
| SteamDB | Unchanged first segment |

## Session log — 2026-05-31 (shipped)

- Lists-only RU vetting (Gemini removed)
- Maintenance modal (Load meta, GFN, errors)
- RU filter + manual Run dev check
- Import fixes + revet script
- Curator recommended vs flagged parsing
- Client sync timeout 540s; useGames id fix

---

## Smoke test checklist (completed 2026-06-01)

- [x] Sign in as both allowed users — auth spinner, no blank flash
- [x] Add Game → preview → co-op confirm (try with/without co-op tags)
- [x] Add Game → Escape / backdrop dismiss
- [x] Maintenance → Load meta info
- [x] Maintenance → Sync dev sources → verify freshness + counts
- [x] Maintenance → Re-vet all games (after vetting logic deploy)
- [x] Maintenance → errors grouped by severity/source; clear info
- [x] RU filter + Run dev check in edit modal
- [x] Active tab vs TBA sub-tab counts
- [x] Lifecycle tabs + filter reset on tab change
- [x] Global filters (e.g. Banned from Active tab)
- [x] Co-op tags absent from filter chip list
- [x] Sync GFN
- [x] Dynamic background + card readability (dimmed thumbnails)
- [x] Edit modal scrollable; hype picker readable
- [ ] RU explanation text — short NE GRAI line; single curator link (after re-vet deploy)
- [ ] Wishlist / library ownership sync (when implemented)

---

## Agent maintenance

When completing work:

1. Update status in this file
2. Add decision to [DECISIONS.md](./DECISIONS.md) if non-obvious
3. Update relevant [features/](./features/) doc
4. Add debt to [CODE_IMPROVEMENTS.md](./CODE_IMPROVEMENTS.md) if found

# Feature Checklist

**Last updated:** 2026-06-02
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
| Dynamic BG animated wave mesh | ✅ | Warm graphite + sage wave CSS; `VITE_ENABLE_DYNAMIC_BG=false` to disable |
| **Unified warm graphite theme** | ✅ | Softer sage accent, glass panels, sidebar/filters |
| Card thumbnails | ✅ | Full color; hover scale only (no dim filter) |
| **Contextual lifecycle badge on card** | ✅ | Hidden on lifecycle tabs; shown when filters search full library |
| Clash Display + General Sans fonts | ✅ | Card redesign, unified badges (6px radius) |

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
| **Steam library sync** (ownership) | ✅ | Callable `syncSteamOwnership` — reconciles `owned.user0/user1` via Steam Web API |
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
| **UI polish round 2 + follow-ups** | ✅ | See session logs below |
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
| Production smoke test | ✅ | Completed 2026-06-02 (incl. UI round 2 + RU re-vet) |
| Real import of 147 games | ✅ | Production library live |
| Post-deploy RU re-vet | ✅ | Completed 2026-06-02 — new message format applied |
| CI/CD pipeline | ⏸ | Deferred |
| **Local Cloud Functions testing** | 📋 | **User request** — emulator workflow documented + validated |

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

## Session log — 2026-06-01 evening (UI polish round 2)

- Animated gradient background replaces screenshot carousel
- Card header: title only + truncation tooltip; price + finished rating in meta line (trailing right)
- Finished rating: color-coded digit 1–5; click → edit modal (`focusRating`)
- Unified overlay icon chrome (owned, hype, lifecycle, screenshots, GFN)
- Footer: rectangular notes button + separator before edit
- RU badge moved to thumbnail bottom-center
- Unified badge height/radius (6px) across status, reviews, GFN, lifecycle, update

## Session log — 2026-06-02 (filters + RU acknowledgment)

- On sale filter excludes games owned by both users
- Manual RU acknowledgment preserved on re-vet (`alert` off + explanation kept); CLI `--wipe-user-acknowledged` to restore flags

## Session log — 2026-06-02 (card layout + gradient tuning)

- Gradient wave palette: coral / moss / teal; faster wave animation; stronger glass opacity
- Card header: price under title (mid-size); "Owned by both players" when both own; historical low icon on sale only
- Thumbnail height 120px; hype ring centered on thumbnail bottom border (opaque graphite + glow)
- Meta line: version, critics, players, HLTB, finished rating (no price)

## Session log — 2026-06-02 (UI polish follow-ups + ops sign-off)

- Lighter lavender/mint gradient (visible against cards; reduced overlay)
- Thumbnail dim filter removed — full color at rest
- Contextual lifecycle badge: hidden on sidebar lifecycle tabs, shown when filters scope full library
- Production smoke test signed off (UI + maintenance + RU)
- Bulk RU re-vet completed — simplified NE GRAI/curator explanation text on game docs

## Session log — 2026-05-31 (shipped)

- Lists-only RU vetting (Gemini removed)
- Maintenance modal (Load meta, GFN, errors)
- RU filter + manual Run dev check
- Import fixes + revet script
- Curator recommended vs flagged parsing
- Client sync timeout 540s; useGames id fix

---

## Smoke test checklist (completed 2026-06-02)

- [x] Sign in as both allowed users — auth spinner, no blank flash
- [x] Add Game → preview → co-op confirm (try with/without co-op tags)
- [x] Add Game → Escape / backdrop dismiss
- [x] Maintenance → Load meta info
- [x] Maintenance → Sync dev sources → verify freshness + counts
- [x] Maintenance → Re-vet all games (vetting logic deploy)
- [x] Maintenance → errors grouped by severity/source; clear info
- [x] RU filter + Run dev check in edit modal
- [x] RU explanation text — short NE GRAI line; single curator link (post re-vet)
- [x] Active tab vs TBA sub-tab counts
- [x] Lifecycle tabs + filter reset on tab change
- [x] Global filters (e.g. Banned from Active tab) — lifecycle badge appears on cards
- [x] Co-op tags absent from filter chip list
- [x] Sync GFN
- [x] Dynamic gradient background visible; card thumbnails full color
- [x] Edit modal scrollable; hype picker readable; `focusRating` scroll on rating click
- [x] Footer notes button rectangular with separator; header price row + meta finished rating
- [x] Steam library ownership sync (`syncSteamOwnership`)
- [ ] Steam wishlist sync (when implemented)

---

## Agent maintenance

When completing work:

1. Update status in this file
2. Add decision to [DECISIONS.md](./DECISIONS.md) if non-obvious
3. Update relevant [features/](./features/) doc
4. Add debt to [CODE_IMPROVEMENTS.md](./CODE_IMPROVEMENTS.md) if found

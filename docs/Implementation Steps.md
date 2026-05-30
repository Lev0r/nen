# Implementation Steps

**Project:** Nen? Co-op Gaming Tracker  
**Purpose:** Single checklist to track what is done and what remains before the project is "complete."  
**Last updated:** 2026-05-30 (Phase 6 shipped — deploy pending)

Read alongside [manifest_of_understanding.md](./manifest_of_understanding.md) (spec) and [PROJECT_HANDOFF.md](./PROJECT_HANDOFF.md) (code map & ops).

---

## Done

- [x] React + Vite SPA, Firebase Auth (Google, two allowed emails → User 0 / User 1)
- [x] Firestore games collection, security rules, real-time `useGames()` sorted by Total Hype
- [x] Glassmorphism UI, dashboard shell (sidebar + top bar + grid)
- [x] Game cards: Total Hype ring, tier picker, owned toggle, Steam overview, reviews, sale pricing, RU alert, screenshots modal
- [x] Cloud Function `addGameFromSteam` — Steam scrape (UAH, `cc=ua`), Gemini RU vetting, Firestore write
- [x] Nicknames from env (`VITE_USER0/1_NICKNAME`) — no Me/Friend hardcoding

---

## Lifecycle system (replaces `finished`, `abandoned`, custom `tags`)

Primary way to organize games. **No custom user tags** — lifecycle + optional note per state is enough.

### Schema (target)

- [x] Add `libraryState`: `active` | `replayable` | `waiting_for_updates` | `finished` | `banned`
- [x] Add `stateMeta`: `{ versionAtEntry, enteredAt, note }` — snapshot when entering (or re-entering) a state
- [x] Add `hasUpdateSinceState` — true when Steam `currentVersion` differs from `stateMeta.versionAtEntry`
- [x] Add `lastVersionCheck` — for throttling background checks on finished games
- [x] Remove writing `finished`, `abandoned`, and custom `tags` on new/updated docs
- [x] Legacy read fallback: `abandoned` → `banned`, `finished` → `finished`, else `active`

### Lifecycle meanings

| State | Meaning |
|-------|---------|
| **active** | In rotation — default for new imports |
| **replayable** | Worth playing again without needing new content |
| **waiting_for_updates** | Done with current content; notify when version/content changes |
| **finished** | Completed, unlikely to replay — check for major patches ~weekly |
| **banned** | Ignored (RU devs or any reason) — optional note required in UX |

### UI & behavior

- [x] **Lifecycle modal** on card — all 5 states visible, optional note, confirm in a couple of clicks
- [x] **Sidebar tabs** filter by `libraryState` (replace Ready to Play / boolean finished views)
- [x] **Mute updates:** re-assign the **same** state → refresh `stateMeta.versionAtEntry` + `enteredAt`, clear `hasUpdateSinceState`
- [x] **Update badge** on card when `hasUpdateSinceState` — no news feed; badge only
- [x] **Total Hype = 0** for `finished` and `banned` (same override pattern as RU alert); tier picker disabled

### Background version tracker

- [x] Scheduled Cloud Function refreshes Steam version (and price/reviews while at it)
- [x] Daily checks for `active`, `replayable`, `waiting_for_updates`
- [x] Weekly checks for `finished`; skip `banned`
- [x] Set `hasUpdateSinceState` when version changes vs `stateMeta.versionAtEntry`

---

## Card UX & quick wins

- [x] **SteamDB link** on card — `https://steamdb.info/app/{appId}/`
- [x] **Creative owned icons** — 3 distinct SVGs (not circles): gray backpack (neither), amber crystal (one), green crossed pickaxes (both)
- [x] **Hide price when both own** — if `owned.user0 && owned.user1`, do not show price/sale on card
- [x] **GeForce NOW badge** — verify availability, show icon on card if playable on GeForce NOW (store `geforceNowReady: boolean` on scrape/refresh)
- [x] Screenshots button placement polish (move off awkward footer spot)
- [ ] Deferred: remove top bar, move Add Game / user into sidebar
- [ ] Deferred: mobile responsiveness second pass (tooltips on touch, grid, modals)

---

## Add Game & Steam data

- [x] **Duplicate alert** — if game id already exists in library, block add and show clear message (check client-side and in `addGameFromSteam`)
- [x] **Steam caching** — cache all Steam HTTP responses in Cloud Functions (TTL per endpoint: appdetails, reviews, news, GFN lookup); avoid hammering Steam on refresh/add
- [x] Store **`steamTags`** from Steam genres/categories on scrape (for search/filter only — not lifecycle tags)
- [ ] Deferred: manual "refresh game from Steam" callable (scheduled refresh may cover most cases)
- [ ] Deferred: co-op warning on add if no online co-op category
- [ ] Deferred: wishlist scheduled sync (needs Steam API key + Steam IDs per user)

---

## Search & dynamic filtering

- [x] Search/filter bar on dashboard (works within current sidebar lifecycle tab)
- [x] Filter/search by **game name** (text)
- [x] Filter by **lifecycle state** (sidebar + optional multi-select in search bar)
- [x] Filter by **Steam tags** (`steamTags` — genres/categories from Steam)
- [x] Filter by **development status** (`released` / `early_access` / `tba`)
- [x] Filter by **ownership** (neither / one / both own) — optional chip filters
- [x] Filter by **on sale** — secondary filter, not a sidebar lifecycle tab
- [ ] Deferred: "Ready to Play" as a saved filter preset (both own + active lifecycle)

---

## Total Hype (do not change formula coefficients without approval)

- [x] Formula: TierBase × Ownership × Status × Steam reviews
- [x] RU developer alert → Total Hype 0
- [x] Finished lifecycle state → Total Hype 0
- [x] Banned lifecycle state → Total Hype 0

---

## Infrastructure & ops

- [x] Functions region `europe-west1`, Blaze plan, `functions/.env` for secrets
- [ ] Deploy lifecycle + refresh functions after implementation
- [ ] Deferred: JSON export of library
- [ ] Deferred: Firestore `/config` doc (nicknames stay in env for now)
- [ ] Deferred: archive passcode for banned view (simple Banned tab first)
- [ ] Deferred: hosting CI (`npm run build` + `firebase deploy`)

---

## Documentation

- [x] Lifecycle model, hype overrides, and new requirements captured in manifest
- [x] Handoff points to this file as progress tracker
- [x] Mark items `[x]` here as each feature ships
- [x] Update PROJECT_HANDOFF "What's done" when milestones complete

---

## Explicitly out of scope (for now)

- News feed UI — replaced by version/update badges on relevant lifecycle states
- Custom user tags — lifecycle + `stateMeta.note` only
- Client-side CORS Steam scraping — Functions-first (manifest F5 legacy text updated)

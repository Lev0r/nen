# Code & Pattern Improvements Backlog

Categorized from codebase review, git history, and agent research (2026-05-31). Not a commitment — prioritize with user before large refactors.

**Last updated:** 2026-06-03 (Steam events data backlog)

---

## Must-have

| ID | Area | Item | Rationale |
| :--- | :--- | :--- | :--- |
| M1 | Auth | Unify allowlist — env vars vs hardcoded `firestore.rules` emails | Drift / security footgun |
| M4 | Ops | Post-deploy re-vet after vetting **logic** changes | `syncDevSources` only when source lists change (new curators, NE GRAI refresh) |
| M5 | Sync | Monitor full-library sync timeout at ~400–500 games | 540s sequential job may fail |
| M6 | HLTB | Treat HLTB as fragile; surface failures clearly | Unofficial API, auth can break |
| E1 | Steam events | Replace `KNOWN_SCHEDULE` with real upcoming calendar | SteamDB blocked (403) from Functions; options: manual JSON, local browser sync, richer Steam parse |

---

## Should-have

| ID | Area | Item | Rationale |
| :--- | :--- | :--- | :--- |
| S3 | RU vetting | Build dev-name curator index in weekly sync (`buildDevIndex`) | Dev hits without app-ID path |
| S7 | Callables | `addGameFromSteam` client timeout aligned with 120s function | Inconsistent with sync wrappers |
| S8 | Steam | Remove or wire `fetchGeForceNowReady` dead code | Confusing vs catalog-only badge |
| S12 | Steam | ~~Wishlist sync + library ownership sync~~ | **Done** — callables + 24h orchestrator tasks |
| S13 | QA | Periodic release QA (syncs, RU, notifications) | Initial smoke test done 2026-06-01 |

---

## Nice-to-have

| ID | Area | Item | Rationale |
| :--- | :--- | :--- | :--- |
| N1 | UI | Mobile pass — tooltips, grid, modals, sidebar drawer | P1 polish; may follow round 2 |
| N3 | UI | ~~"Refresh from Steam" in GameEditModal~~ | Single-game re-scrape — **done** (2026-06-02) |
| N4 | UI | Live Total Hype preview in edit modal | UX clarity |
| N5 | Hype | Use or drop `recentReviewPercent` in formula | Fetched but unused |
| N6 | Hype | Document ITAD missing → neutral Metacritic factor | Transparency in breakdown |
| N7 | Data | Persist `totalHype` server-side | Enable Firestore sort/query |
| N8 | Cache | ~~Firestore-backed Steam HTTP cache~~ | **Done** — `steam-app-meta` L2 cache (180d TTL); see [steam-app-meta-cache.md](./features/steam-app-meta-cache.md) |
| N9 | Notes | Lighter inline note editor vs full edit modal | UX |
| N10 | Lifecycle | `stateMeta.enteredBy` audit field | Attribution |
| N11 | Filters | Search developers/publishers, not just name | Power user |
| N12 | Export | Client-side library JSON backup | P1 |
| N13 | RU | Use `lookupCuratorClearanceByAppId` in explanations | Clearer "cleared by curator" UX |
| N15 | ITAD | Show ITAD price vs scraped Steam price | Data already fetched |

---

## Completed (2026-06-02 — sync orchestrator)

| ID | Item |
| :--- | :--- |
| S14 | DRY auth/paths/gamePersist — `functions/lib/auth.js`, `functions/lib/firestorePaths.js`, `functions/gamePersist.js` extracted from `index.js` |
| N8 | Firestore app-meta cache — `functions/steamAppMetaCache.js`, `steam-app-meta` collection |
| — | Unified scheduler orchestrator — `scheduledSyncOrchestrator` replaces 3 separate schedulers |
| — | Single appdetails fetch when static+dynamic due; price piggyback on static-only sync (`mapPriceData` → `steamDynamic`) |
| — | `steamRateLimiter.js` — serial store queue (400ms) + Web API concurrent pool |
| — | Scheduled ownership (24h one-way merge) + wishlist (24h auto-import co-op) |

---

## Completed (2026-06-01 session)

| ID | Item |
| :--- | :--- |
| M2 | Sich curators (5 IDs) |
| M3 | Dev BG source controls in Maintenance UI |
| S1 | Remove co-op tags from filter chips |
| S2 | Co-op category warning on add (two-phase confirm) |
| S4 | Bulk re-vet button (`revetAllGames`) |
| S5 | Source freshness + counts in Maintenance |
| S6 | Auth loading spinner |
| S9 | Card visibility — dim BG, darken unhovered thumbnails |
| S10 | TBA sub-tab under Active |
| S11 | Errors panel — severity grouping + detail |
| N2 | AddGameModal Escape + backdrop dismiss |
| — | Config schema v3 (`maintenance-errors`, `maintenance-audit`, split config docs) |
| — | Dev sources v2 Firestore split (`config/dev-sources-*`) |
| — | NE GRAI exact match + `test-dev-sources.mjs` regression suite |
| — | RU alert message format + aggregation dedup (dev+pub, app+curator) |
| — | `docs/DEV_CLI.md` handbook + npm seed aliases |
| N14 | Publisher names in game-level vet loop (`collectVettingNames`) |
| M7 | Production bulk import + smoke test (147 games) |
| — | Production RU re-vet after message-format deploy (2026-06-02) |
| U1 | Animated gradient BG (replaces screenshot carousel) |
| U2 | Card header/meta layout — title only; price + rating in meta |
| U3 | Thumbnail always-dim + unified overlay icon chrome |
| U4 | Footer notes/edit separator + rectangular notes btn |
| N3 | "Refresh from Steam" in GameEditModal (`refreshGameFromSteam`) |

---

## Deferred (discuss before building)

| ID | Item | Notes |
| :--- | :--- | :--- |
| D1 | ~~Wishlist sync~~ | Moved to **S12** (wishlist + library ownership sync) |
| D2 | Banned tab passcode | Privacy for two trusted users |
| D3 | Ready to Play filter preset | Use chips instead |
| D4 | Hosting CI / GitHub Action deploy | Manual deploy today |
| D5 | Nicknames in Firestore config | Env vars work |
| D6 | GameDev DOU automated lookup | Context-only by design |
| D7 | In-app dynamic BG toggle | Build-time env only |

---

## Do not revive without approval

- Gemini / OpenCorporates developer vetting
- News feed UI
- Open-ended AI web research for RU flags

---

## Code style (ongoing)

| Rule | Source |
| :--- | :--- |
| Minimize diff scope; match existing patterns | `ai_rules.md`, user rules |
| No Redux / heavy state libs | `ai_rules.md` |
| Component-driven React; small focused files | `ai_rules.md` |
| Never hardcode User 0/1 display names | Core contract |
| Do not alter Total Hype coefficients without user OK | `ai_rules.md` |
| Commit/push only when user asks | User preference |
| Run `npm run build` after client chunks | Deploy habit |

---

## Test / quality gaps

| Gap | Suggestion |
| :--- | :--- |
| No automated tests | Smoke scripts only (`test-dev-sources.mjs`) |
| No E2E for filters/modals | Manual checklist in FEATURE_CHECKLIST |
| Subagent findings not in CI | Pre-import manual smoke test remains critical |
| Local functions testing undocumented | `functions/package.json` has `serve`; `VITE_USE_FUNCTIONS_EMULATOR` in dev — validate workflow (OPS § planned) |
| RU vetting regression not in CI | Run `npm run test-dev-sources` manually before deploy |

Update this file when closing items or discovering new debt.

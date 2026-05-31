# Code & Pattern Improvements Backlog

Categorized from codebase review, git history, and agent research (2026-05-31). Not a commitment — prioritize with user before large refactors.

---

## Must-have

| ID | Area | Item | Rationale |
| :--- | :--- | :--- | :--- |
| M1 | Auth | Unify allowlist — env vars vs hardcoded `firestore.rules` emails | Drift / security footgun |
| M2 | RU vetting | Add Sich curators (`37941500`, `44677918`, `45525669`, `45830587`, `45985173`) | User-requested source; finish RU flow |
| M3 | Maintenance | Expose `syncDevSources` in UI + `cloudFunctions.js` wrapper | Production source refresh without CLI |
| M4 | Ops | Document/trigger post-deploy: deploy → syncDevSources → revet | False RU flags until sources + games refreshed |
| M5 | Sync | Monitor full-library sync timeout at ~400–500 games | 540s sequential job may fail |
| M6 | HLTB | Treat HLTB as fragile; surface failures clearly | Unofficial API, auth can break |
| M7 | Import | Run production bulk import + smoke test | P0 user ops still pending |

---

## Should-have

| ID | Area | Item | Rationale |
| :--- | :--- | :--- | :--- |
| S1 | Filters | Remove co-op-related tags from filter chip list | User request; co-op-only library |
| S2 | Add game | Co-op category warning (IDs 9, 38, 39, 48) | User request; non-blocking confirm |
| S3 | RU vetting | Build dev-name curator index in weekly sync (`buildDevIndex`) | Dev hits without app-ID path |
| S4 | Maintenance | Bulk re-vet callable or button | Avoid CLI for 147 games |
| S5 | Maintenance | Show `devBgCheck.sources` freshness + counts | Ops visibility |
| S6 | Auth | Loading spinner during `AuthProvider` init | Blank flash on load |
| S7 | Callables | `addGameFromSteam` client timeout aligned with 120s function | Inconsistent with sync wrappers |
| S8 | Steam | Remove or wire `fetchGeForceNowReady` dead code | Confusing vs catalog-only badge |

---

## Nice-to-have

| ID | Area | Item | Rationale |
| :--- | :--- | :--- | :--- |
| N1 | UI | Mobile pass — tooltips, grid, modals, sidebar drawer | P1 polish |
| N2 | UI | AddGameModal Escape + backdrop dismiss | Parity with other modals |
| N3 | UI | "Refresh from Steam" in GameEditModal | Single-game re-scrape |
| N4 | UI | Live Total Hype preview in edit modal | UX clarity |
| N5 | Hype | Use or drop `recentReviewPercent` in formula | Fetched but unused |
| N6 | Hype | Document ITAD missing → neutral Metacritic factor | Transparency in breakdown |
| N7 | Data | Persist `totalHype` server-side | Enable Firestore sort/query |
| N8 | Cache | Firestore-backed Steam HTTP cache | Cold start rate limits |
| N9 | Notes | Lighter inline note editor vs full edit modal | UX |
| N10 | Lifecycle | `stateMeta.enteredBy` audit field | Attribution |
| N11 | Filters | Search developers/publishers, not just name | Power user |
| N12 | Export | Client-side library JSON backup | P1 |
| N13 | RU | Use `lookupCuratorClearanceByAppId` in explanations | Clearer "cleared by curator" UX |
| N14 | Vetting | Publisher names in game-level vet loop | Index already has publishers |
| N15 | ITAD | Show ITAD price vs scraped Steam price | Data already fetched |

---

## Deferred (discuss before building)

| ID | Item | Notes |
| :--- | :--- | :--- |
| D1 | Wishlist sync | Steam Web API key + public profiles |
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

Update this file when closing items or discovering new debt.

# Agent Intro — Nen?

**Last updated:** 2026-06-03 (session wrap: Events home, filter UX, Steam events data note)  
**Repo:** https://github.com/Lev0r/nen  
**Firebase project:** `nen-tracker` (CLI alias: `staging` in `.firebaserc`)

Onboarding entry point for AI agents and developers. Read this first, then only the docs relevant to your task.

---

## What is Nen?

**Nen?** is a two-user co-op Steam game library tracker (React + Vite SPA, Firebase). Two abstract users (**User 0** / **User 1**) import games from Steam, track lifecycle, ownership, personal hype tiers, and RU developer alerts. **Total Hype** drives sort order; the dashboard uses a static nebula background (not hype-driven).

Never hardcode personal names in UI — use `VITE_USER0_NICKNAME` / `VITE_USER1_NICKNAME`.

### Current product state (2026-06-03)

| Area | Behavior |
| :--- | :--- |
| **Default view** | **Events** page (`topView: 'events'`) — hero + 6 upcoming Steam sales/fests from `config/steam-events` |
| **Library** | Sidebar lifecycle tabs set tri-state filter presets on the **full** library; grid always `filterGames(games, …)` |
| **Filters** | Tri-state chips (include / exclude); panel **collapsed on load**; stays open when changing sidebar nav if already expanded |
| **Mobile (≤768px)** | Hamburger drawer nav; search in top-right modal; filter search hidden in bar |
| **Steam events data** | **Not SteamDB** — see [steam-events.md](./features/steam-events.md#why-not-steamdb) |
| **Deploy** | `main` includes `syncSteamEvents` callable + `steamEvents` 7d task; seed via Maintenance after functions deploy |

**Recent commits (this session):** `0a8199c` (tri-state, Events, mobile, modals) · `ef34d7c` (Events default home, filters collapsed on load) · `4b30fe1` (sidebar nav preserves open filter panel).

---

## Read order (minimal path)

| Step | File | When to read |
| :--- | :--- | :--- |
| 1 | **[`AGENT_INTRO.md`](./AGENT_INTRO.md)** (this file) | Always |
| 2 | **[`FEATURE_CHECKLIST.md`](./FEATURE_CHECKLIST.md)** | Status, backlog, what not to rebuild |
| 3 | **[`manifest_of_understanding.md`](./manifest_of_understanding.md)** | Schema, formulas, feature specs (F1–F6) |
| 4 | **[`ai_rules.md`](./ai_rules.md)** | Constraints, anti-patterns |
| 5 | **Feature doc** from [`features/README.md`](./features/README.md) | Task-specific deep dive |
| 6 | **[`OPS.md`](./OPS.md)** | Deploy, env vars, scripts |
| 6b | **[`DEV_CLI.md`](./DEV_CLI.md)** | All local CLI scripts — flags, examples (update when adding scripts) |
| 7 | **[`DECISIONS.md`](./DECISIONS.md)** | Why past choices were made |
| 8 | **[`CODE_IMPROVEMENTS.md`](./CODE_IMPROVEMENTS.md)** | Tech debt and refactor backlog |

Past chat transcripts (Cursor agent history) — search by feature name before re-implementing.

---

## Code map (quick)

```
nen/
├── docs/                    ← you are here
├── functions/               # Cloud Functions, europe-west1, Node 20
│   ├── index.js             # Callables: addGame, vetGame, sync*
│   ├── schedulerOrchestrator.js  # Single 6h scheduledSyncOrchestrator
│   ├── scheduler/tasks.js   # Task registry (library, ownership, wishlist, GFN, dev, purge)
│   ├── steam.js             # Steam scrape → schema v2
│   ├── steamSync.js         # Library metadata sync core
│   ├── steamAppMetaCache.js # Firestore L2 app-meta cache (wishlist filter)
│   ├── steamRateLimiter.js  # Serial store queue + Web API pool
│   ├── gamePersist.js       # enrichAndPersistFromSteam (shared add/import path)
│   ├── lib/auth.js          # assertAllowedUser
│   ├── lib/firestorePaths.js # Path helpers incl. scheduler-state, steam-app-meta
│   ├── devSources.js        # RU list lookups
│   ├── devVetting.js        # Developer vet orchestration
│   ├── devBgCheck.js        # Dev vetting cache (config/dev-bg-check)
│   ├── configPaths.js       # Re-exports lib/firestorePaths (backward compat)
│   ├── maintenanceStore.js  # maintenance-errors + maintenance-audit
│   ├── devSourceSync.js     # Weekly NE GRAI + curator sync
│   ├── gfnSync.js           # GFN catalog
│   ├── steamEventsSync.js   # Featured sales/festivals → config/steam-events
│   ├── hltb.js / itad.js    # Third-party enrich
│   └── data/                # Local-only CLI export (gitignored); prod reads config/dev-sources-*
├── public/backgrounds/      # nebula1.webp + README
├── scripts/                 # Admin CLI (import, revet, sync sources)
└── src/
    ├── components/          # DashboardShell, EventsPage, GameCard, modals, filters
    ├── hooks/               # useMatchMedia (mobile ≤768px)
    ├── contexts/            # AuthContext, MaintenanceDataContext (split maintenance listeners)
    ├── services/            # db.js, cloudFunctions.js
    └── utils/               # hypeScore, gameFilters, libraryState, accessors
```

### Critical Firestore paths

| Path | Purpose |
| :--- | :--- |
| `artifacts/{appId}/public/data/games/{steamAppId}` | Game documents (`default_app`) |
| `artifacts/{appId}/public/data/steam-app-meta/{steamAppId}` | Wishlist co-op filter cache (180d TTL) |
| `artifacts/{appId}/public/data/config/scheduler-state` | Orchestrator task timestamps (`lastRunAt`, `lastCompleteAt`) |
| `artifacts/{appId}/public/data/config/dev-bg-check` | Developer vetting cache (`developers.{cacheKey}`) |
| `artifacts/{appId}/public/data/config/gfn-catalog` | GeForce NOW Steam app ID list |
| `artifacts/{appId}/public/data/config/steam-library-sync` | Last library meta sync stats |
| `artifacts/{appId}/public/data/config/steam-events` | Steam sales/festivals (`nextFeatured`, `upcoming`) |
| `artifacts/{appId}/public/data/config/third-party-health` | HLTB/ITAD health counters |
| `artifacts/{appId}/public/data/config/maintenance-errors` | Centralized maintenance error entries |
| `artifacts/{appId}/public/data/config/maintenance-audit` | Denormalized Maintenance UI snapshot |
| `artifacts/{appId}/public/data/config/dev-sources-*` | NE GRAI + curator lists (schema v2) |
| `artifacts/{appId}/public/data/config/default` | **Deprecated** — migrate with `npm run migrate-config-v3` |

**Path segments must be even** — e.g. `config/gfn-catalog`, not `config` alone.

---

## Agent workflow

1. Read this file + [`FEATURE_CHECKLIST.md`](./FEATURE_CHECKLIST.md) — do not re-implement completed work.
2. Search codebase and git history before adding features.
3. For multi-step work: implement in focused chunks; run `npm run build` after client changes.
4. **Ask before:** git commit, push, production deploy, bulk import without `--dry-run`.
5. Update [`FEATURE_CHECKLIST.md`](./FEATURE_CHECKLIST.md) when shipping or deferring features.
6. Update the relevant [`features/`](./features/) doc if behavior changes materially.
7. **New dev CLI script?** Update [`DEV_CLI.md`](./DEV_CLI.md) (flags, examples, Firestore impact) in the same change.

User preference: orchestrator may split large tasks into subagents.

---

## Feature index

See **[`features/README.md`](./features/README.md)** for one-page summaries and cross-links.

| Feature | Doc |
| :--- | :--- |
| Auth & access | [`features/auth-and-access.md`](./features/auth-and-access.md) |
| Lifecycle & ownership | [`features/lifecycle-and-ownership.md`](./features/lifecycle-and-ownership.md) |
| Total Hype | [`features/total-hype.md`](./features/total-hype.md) |
| Steam sync & HLTB/ITAD/GFN | [`features/steam-sync-and-data.md`](./features/steam-sync-and-data.md) |
| RU developer vetting | [`features/ru-developer-vetting.md`](./features/ru-developer-vetting.md) |
| Filters & search | [`features/filters-and-search.md`](./features/filters-and-search.md) |
| Steam events | [`features/steam-events.md`](./features/steam-events.md) |
| UI shell & modals | [`features/ui-shell-and-modals.md`](./features/ui-shell-and-modals.md) |
| Maintenance & errors | [`features/maintenance-and-errors.md`](./features/maintenance-and-errors.md) |
| Bulk import | [`features/bulk-import.md`](./features/bulk-import.md) |

---

## Known pitfalls

1. **Filter panel** — use React `expanded` state, not CSS `:focus-within` (breaks toggles).
2. **Filter scope** — sidebar sets lifecycle preset (`filtersForSidebarNav`); grid always filters full library; **Clear filters** resets to `DEFAULT_GAME_FILTERS` (entire library, not nav preset).
3. **Schema v2 only** — nested `steamStatic` / `steamDynamic` / `steamStats`; no v1 flat fields.
4. **Banned games** — skip all Steam sync; **TBA** — no player stats.
5. **GFN badge** — reads `config/gfn-catalog.steamAppIds`, not per-game scrape field.
6. **Firestore dev sources (schema v2)** — split docs `config/dev-sources-*`; seed via `--to-firestore`. Legacy `devBgCheck.sources` on deprecated `config/default` is unused. Developer cache lives on `config/dev-bg-check`.
7. **Maintenance errors (schema v3)** — stored in `config/maintenance-errors`, not on game docs. UI reads `config/maintenance-audit` for sync labels.
8. **Curator vetting** — only `not_recommended` + `informational` flag; `recommended` = clearance (does not override NE GRAI).
9. **NE GRAI vetting** — exact normalized name match only (no substring; no suffix stripping on studio/games/entertainment).
10. **RU alert text** — NE GRAI: `developer found in "Не Грай" database`; curator: markdown link + `(not recommended or informational)`; no duplicate curator line when app ID already flagged.
11. **Scheduled sync** — single Cloud Scheduler job `scheduledSyncOrchestrator` (every 6h); per-task intervals in `config/scheduler-state`. Old jobs `syncLibrarySteam`, `syncGfnCatalogScheduled`, `syncDevSourcesScheduled` are removed.
12. **Lifecycle badge on card** — always shown on grid cards (full-library view).
13. **Post-deploy RU re-vet** — required after vetting *logic* changes only (not source re-sync); completed 2026-06-02.
14. **Background** — `public/backgrounds/nebula1.webp` with blur on one fixed layer only; cards use opaque `--glass-bg` (no per-card `backdrop-filter`).
15. **F2P ownership** — `getEffectiveOwnership` treats `Free to Play` as both-own client-side; Firestore `owned` flags unchanged.
16. **Steam playtime** — only `steamOwnership` sync writes `steamPlaytime.*` from existing `GetOwnedGames`; never add per-game Web API calls for hours.
17. **Version/status “new”** — `hasUpdateSinceState` covers version or `developmentStatus` drift; acknowledge on card rebaselines `stateMeta` without changing lifecycle; sidebar dot per tab.
18. **Filter panel** — collapsed on load; opens on user action; sidebar nav does not collapse an open panel (`filtersExpanded` in shell); outside-click ignores `.sidebar` / drawer.
19. **Events default home** — `topView` starts as `events`; lifecycle tabs switch to `library`.
20. **Filter facets** — status/ownership/tags/lifecycle use tri-state `{ include, exclude }` (chip cycle off → include → exclude); footer toggles same tri-state. Facet gating always on (`filterMode={true}`). **Clear filters** uses `hasActiveFilters` / `onResetFilters` → `DEFAULT_GAME_FILTERS` (entire library).

---

## Do not commit

`.firebase/`, `.env.local`, `functions/.env`, `.tmp-ne-grai/`, `functions/data/`

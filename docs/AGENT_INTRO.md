# Agent Intro — Nen?

**Last updated:** 2026-06-01  
**Repo:** https://github.com/Lev0r/nen  
**Firebase project:** `nen-tracker` (CLI alias: `staging` in `.firebaserc`)

Onboarding entry point for AI agents and developers. Read this first, then only the docs relevant to your task.

---

## What is Nen?

**Nen?** is a two-user co-op Steam game library tracker (React + Vite SPA, Firebase). Two abstract users (**User 0** / **User 1**) import games from Steam, track lifecycle, ownership, personal hype tiers, and RU developer alerts. **Total Hype** drives sort order and the dynamic background.

Never hardcode personal names in UI — use `VITE_USER0_NICKNAME` / `VITE_USER1_NICKNAME`.

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
│   ├── steam.js             # Steam scrape → schema v2
│   ├── steamSync.js         # 6h library sync
│   ├── devSources.js        # RU list lookups
│   ├── devVetting.js        # Developer vet orchestration
│   ├── devBgCheck.js        # Dev vetting cache (config/dev-bg-check)
│   ├── configPaths.js       # Config doc IDs + path helpers
│   ├── maintenanceStore.js  # maintenance-errors + maintenance-audit
│   ├── devSourceSync.js     # Weekly NE GRAI + curator sync
│   ├── gfnSync.js           # GFN catalog
│   ├── hltb.js / itad.js    # Third-party enrich
│   └── data/                # Bundled vetting JSON (deployed with functions)
├── scripts/                 # Admin CLI (import, revet, sync sources)
└── src/
    ├── components/          # DashboardShell, GameCard, modals, filters
    ├── services/            # db.js, cloudFunctions.js
    └── utils/               # hypeScore, gameFilters, libraryState, accessors
```

### Critical Firestore paths

| Path | Purpose |
| :--- | :--- |
| `artifacts/{appId}/public/data/games/{steamAppId}` | Game documents (`default_app`) |
| `artifacts/{appId}/public/data/config/dev-bg-check` | Developer vetting cache (`developers.{cacheKey}`) |
| `artifacts/{appId}/public/data/config/gfn-catalog` | GeForce NOW Steam app ID list |
| `artifacts/{appId}/public/data/config/steam-library-sync` | Last library meta sync stats |
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
| UI shell & modals | [`features/ui-shell-and-modals.md`](./features/ui-shell-and-modals.md) |
| Maintenance & errors | [`features/maintenance-and-errors.md`](./features/maintenance-and-errors.md) |
| Bulk import | [`features/bulk-import.md`](./features/bulk-import.md) |

---

## Known pitfalls

1. **Filter panel** — use React `expanded` state, not CSS `:focus-within` (breaks toggles).
2. **Filter scope** — no filters = current tab; any filter active = full library.
3. **Schema v2 only** — nested `steamStatic` / `steamDynamic` / `steamStats`; no v1 flat fields.
4. **Banned games** — skip all Steam sync; **TBA** — no player stats.
5. **GFN badge** — reads `config/gfn-catalog.steamAppIds`, not per-game scrape field.
6. **Firestore dev sources (schema v2)** — split docs `config/dev-sources-*`; seed via `--to-firestore`. Legacy `devBgCheck.sources` on deprecated `config/default` is unused. Developer cache lives on `config/dev-bg-check`.
7. **Maintenance errors (schema v3)** — stored in `config/maintenance-errors`, not on game docs. UI reads `config/maintenance-audit` for sync labels.
8. **Curator vetting** — only `not_recommended` + `informational` flag; `recommended` = clearance (does not override NE GRAI).

---

## Do not commit

`.firebase/`, `.env.local`, `functions/.env`, `.tmp-ne-grai/`

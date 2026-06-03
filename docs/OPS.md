# Operations & Deploy Runbook

**Related:** [AGENT_INTRO.md](./AGENT_INTRO.md) · [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) · [ru-developer-vetting.md](./features/ru-developer-vetting.md)

**Last updated:** 2026-06-03 (orchestrator deployed; static nebula BG)

---

## Prerequisites

- Firebase **Blaze** plan
- `firebase login`
- `firebase use staging` (or `nen-tracker`)

---

## Environment variables

### Frontend (`.env.local` — copy from `.env.example`)

| Variable | Purpose |
| :--- | :--- |
| `VITE_FIREBASE_*` | Web app config |
| `VITE_ALLOWED_EMAIL_0/1` | Must match rules + functions |
| `VITE_USER0_NICKNAME`, `VITE_USER1_NICKNAME` | Display names |
| `VITE_FIREBASE_FUNCTIONS_REGION` | `europe-west1` |
| `VITE_ENABLE_DYNAMIC_BG` | Default on (`public/backgrounds/nebula1.webp`); `false` + rebuild to disable |
| `VITE_USE_FUNCTIONS_EMULATOR` | Local emulators only |

### Functions (`functions/.env` — copy from `functions/.env.example`)

| Variable | Purpose |
| :--- | :--- |
| `ALLOWED_EMAIL_0/1` | Callable auth gate |
| `GFN_VPC_ID` | Default `NP-WAW-01` |
| `ITAD_API_KEY` | Optional ITAD enrichment |
| `ITAD_COUNTRY` | Default `UA` |
| `STEAM_WEB_API_KEY` | Plain hex key from steamcommunity.com/dev/apikey (not a URL) — owned games + wishlist sync |
| `STEAM_ID_0`, `STEAM_ID_1` | 64-bit Steam IDs for User 0 / User 1 |

**Do not commit:** `.env.local`, `functions/.env`, `.firebase/`

---

## Deploy

```bash
cd /mnt/c/Work/nen
npm run build
firebase deploy --only functions,firestore:rules,hosting
```

**Hosting only** (frontend changes):

```bash
npm run build && firebase deploy --only hosting
```

---

## Scheduled Cloud Functions

| Function | Schedule | Notes |
| :--- | :--- | :--- |
| `scheduledSyncOrchestrator` | Every **6 hours** | Single job — runs all due tasks (library metadata, ownership, wishlist, GFN, dev sources, app-meta purge). See [steam-sync-and-data.md](./features/steam-sync-and-data.md#unified-scheduler-orchestrator). |

**After deploy:** If orphaned Cloud Scheduler jobs remain from the old three-scheduler setup (`syncLibrarySteam`, `syncGfnCatalogScheduled`, `syncDevSourcesScheduled`), delete them in the [Firebase console](https://console.firebase.google.com/) → Functions → Scheduler (or Google Cloud Console → Cloud Scheduler). Only `scheduledSyncOrchestrator` should remain.

**Post-deploy checks:**

1. Confirm orchestrator runs in function logs
2. Verify `config/scheduler-state` is populated after first tick
3. Monitor first daily wishlist run for `cacheHits` / `cacheMisses` in `config/steam-wishlist-candidates`
4. After deploy with `steamEvents` task: run **Sync Steam events** in Maintenance once, or wait for orchestrator (7d due) — verify `config/steam-events` has `nextFeatured` / `upcoming`

---

## Callable reference

| Export | Client wrapper | Purpose |
| :--- | :--- | :--- |
| `previewSteamGame` | ✅ | Scrape-only preview for add flow |
| `addGameFromSteam` | ✅ | Add + vet game |
| `vetGameDevelopers` | ✅ `runDevCheck` | Manual re-vet one game |
| `syncSteamLibrary` | ✅ | Load meta info |
| `refreshGameFromSteam` | ✅ | Single-game re-scrape (GameEditModal) |
| `syncGfnCatalog` | ✅ | GFN catalog |
| `syncSteamOwnership` | ✅ | One-way ownership merge (Steam Web API) |
| `syncSteamWishlists` | ✅ | Wishlist → co-op candidates (no auto-import) |
| `syncDevSources` | ✅ | Refresh RU source lists |
| `syncSteamEvents` | ✅ | Steam sales/festivals → `config/steam-events` |
| `revetAllGames` | ✅ | Bulk re-vet all games |
| `clearMaintenanceInfoErrors` | ✅ | Clear info-level maintenance errors |

Region: `europe-west1`. Client timeouts in `cloudFunctions.js`: metadata/GFN/dev/wishlist/revet **540s**; ownership + refresh **120s**.

---

## Admin scripts (local → production Firestore)

**Full CLI reference:** [`DEV_CLI.md`](./DEV_CLI.md) — parameters and examples per script.

Requires `firebase login` + project, or `GOOGLE_APPLICATION_CREDENTIALS`.

```bash
# Preview bulk import
npm run import-games -- "docs/all games.json" --dry-run

# Import library (done — library live in production)
# npm run import-games -- "docs/all games.json" --app-id default_app

# Refresh RU flags on all games (after vetting logic deploy — no source re-sync needed)
node scripts/revet-ru-games.mjs --dry-run
node scripts/revet-ru-games.mjs

# Seed dev sources directly to Firestore (preferred for prod refresh)
node scripts/sync-dev-sources.mjs --to-firestore
node scripts/sync-dev-sources.mjs --to-firestore --build-dev-index   # slow; optional dev index

# Export bundled JSON locally (dev/offline only — runtime reads Firestore)
node scripts/sync-dev-sources.mjs
node scripts/sync-dev-sources.mjs --curators-only

# Smoke test lookups
node scripts/test-dev-sources.mjs
```

### Dev source seed workflow (schema v2 — split config docs)

Production functions read **split Firestore docs** under `config/dev-sources-*` — not `devBgCheck.sources` on `config/default`.

| Document ID | Contents |
| :--- | :--- |
| `dev-sources-meta` | Sync summary for Maintenance UI |
| `dev-sources-ne-grai` | NE GRAI publisher names |
| `dev-sources-curator-{key}` | Per-curator flagged/cleared app ID arrays |
| `dev-sources-dev-index` | Optional developer index (`--build-dev-index`) |

**Migrate from legacy blob:**

```bash
node scripts/wipe-legacy-dev-sources.mjs
node scripts/sync-dev-sources.mjs --to-firestore --full
node scripts/revet-ru-games.mjs
```

1. **First deploy / fresh seed** — `node scripts/sync-dev-sources.mjs --to-firestore --full`
2. **Re-vet games** — Maintenance → Re-vet all games, or `node scripts/revet-ru-games.mjs`
3. **Ongoing** — weekly `devSources` orchestrator task or Maintenance → Sync dev sources (incremental)

**Clear maintenance errors:** `node scripts/wipe-maintenance-errors.mjs`

**Migrate config schema v3** (split `config/default` → dedicated docs):

```bash
node scripts/migrate-config-v3.mjs --dry-run
node scripts/migrate-config-v3.mjs
firebase deploy --only functions
```

---

## RU vetting refresh (production)

After deploying curator-logic or **source list** changes:

1. **`firebase deploy --only functions`**
2. **Refresh Firestore sources** — Maintenance → **Sync dev sources**, or `node scripts/sync-dev-sources.mjs --to-firestore` *(skip if lists unchanged)*
3. **Re-vet games** — Maintenance → **Re-vet all games**, or `node scripts/revet-ru-games.mjs`

After deploying **vetting logic only** (exact match, message format, dedup): steps 2 is unnecessary — **re-vet only** (step 3).

No DB wipe needed. Stale vetting errors clear from `config/maintenance-errors` on successful Run dev check.

---

## Local Cloud Functions testing (planned)

Partial wiring exists; workflow needs validation and documentation.

| Piece | Location |
| :--- | :--- |
| Emulator script | `cd functions && npm run serve` → `firebase emulators:start --only functions` |
| Client hook | `VITE_USE_FUNCTIONS_EMULATOR=true` in `.env.local` (dev only) |
| Connect | `src/firebase.js` → `connectFunctionsEmulator(functions, '127.0.0.1', 5001)` |

**Notes:**

- Today the SPA still uses **production Firestore/Auth** when emulating functions — only callables route locally
- Callable auth (`ALLOWED_EMAIL_0/1`) and secrets (`ITAD_API_KEY`, etc.) must be in `functions/.env`
- Consider adding `emulators` block to `firebase.json` if ports or UI are needed
- Document smoke paths: `previewSteamGame`, `addGameFromSteam`, `syncSteamLibrary`, `syncDevSources`, `vetGameDevelopers`

---

## Pending ops

| Item | Status |
| :--- | :--- |
| Local Functions emulator workflow | Documented in [Local Cloud Functions testing](#local-cloud-functions-testing-planned); not yet validated end-to-end |

**Done (2026-06-03):** Sync orchestrator deployed (`scheduledSyncOrchestrator` live; legacy scheduler jobs removed). Background: `public/backgrounds/nebula1.webp` with fixed-layer blur (8px); deploy frontend with `npm run build && firebase deploy --only hosting` when shipping BG/perf changes.

Production smoke tests and bulk RU re-vet are **complete** as of 2026-06-02. Post-orchestrator: confirm `config/scheduler-state` after first 6h tick if not already checked.

---

## Firestore console paths

`artifacts` → `default_app` → `public` → `data` →

- `games/{steamAppId}` — library documents
- `steam-app-meta/{steamAppId}` — wishlist co-op filter cache (180d TTL; see [steam-app-meta-cache.md](./features/steam-app-meta-cache.md))
- `config/scheduler-state` — orchestrator task `lastRunAt` / `lastCompleteAt` per task id
- `config/dev-bg-check` — developer vetting cache
- `config/gfn-catalog` — GeForce NOW Steam app IDs
- `config/steam-library-sync` — last meta sync stats
- `config/steam-ownership-sync` — last ownership merge stats
- `config/steam-wishlist-candidates` — wishlist co-op candidates + cache hit/miss stats
- `config/third-party-health` — HLTB/ITAD health
- `config/maintenance-errors` — centralized error entries
- `config/maintenance-audit` — Maintenance UI snapshot
- `config/dev-sources-*` — RU vetting source lists
- `config/default` — **deprecated** (migrate with `npm run migrate-config-v3`)

---

## Cost notes

~700 Firestore writes/day @ 147 games — free tier OK. Daily wishlist with ~90% app-meta cache hits adds negligible store traffic (~0–5 calls/day after warm-up). Full-library function sync may timeout at ~400–500 games.

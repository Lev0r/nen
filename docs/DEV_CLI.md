# Dev CLI Handbook

Local admin scripts for Nen? — run from repo root unless noted.

**Last updated:** 2026-06-01

**Not covered here:** React app (`npm run dev`), production Maintenance buttons (Cloud Callables), scheduled functions.

> **When adding a script:** update this handbook (summary table + full entry with parameters and examples).

---

## Setup (Firestore scripts)

Required once per machine before any script that writes to Firestore:

```bash
firebase login
firebase use staging
gcloud auth application-default login --project nen-tracker
```

Alternative: set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON path.

| Setting | Default |
| :--- | :--- |
| Firebase project | `nen-tracker` (CLI alias `staging`) |
| Firestore artifact | `default_app` (`--app-id`) |

---

## Script index

| Script | npm alias | Auth | Writes Firestore | Status |
| :--- | :--- | :---: | :---: | :--- |
| [import-games](#import-games) | `npm run import-games --` | Yes | Yes | Active |
| `sync-dev-sources` | `npm run sync-dev-sources --` | If `--to-firestore` | If `--to-firestore` | Active |
| | `npm run sync-dev-sources:firestore:full` | Yes | Yes | **Preferred Firestore seed (Windows)** |
| | `npm run sync-dev-sources:local` | No | No | Local JSON export |
| [test-dev-sources](#test-dev-sources) | `npm run test-dev-sources` | No | No | Active (local smoke) |
| [revet-ru-games](#revet-ru-games) | `npm run revet-ru-games --` | Yes | Yes | Active |
| [fix-steam-links](#fix-steam-links) | `npm run fix-steam-links --` | No | No | Active (import prep) |
| [wipe-maintenance-errors](#wipe-maintenance-errors) | `npm run wipe-maintenance-errors --` | Yes | Yes | Active (cleanup) |
| [wipe-legacy-dev-sources](#wipe-legacy-dev-sources) | `npm run wipe-legacy-dev-sources --` | Yes | Yes | Legacy cleanup |
| [migrate-config-v3](#migrate-config-v3) | `npm run migrate-config-v3 --` | Yes | Yes | One-time migration |

---

## import-games

Bulk-import games from JSON into Firestore. Scrapes Steam, pre-vets developers, writes game docs and updates `config/dev-bg-check`.

**Invoke**

```text
npm run import-games -- <jsonPath> [options]
node scripts/import-games.mjs <jsonPath> [options]
```

### Parameters

| Name | Kind | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `jsonPath` | positional | Yes | — | Path to JSON array (canonical or legacy friend-export format) |
| `--dry-run` | flag | No | off | Scrape and vet; do not write to Firestore |
| `--app-id` | option | No | `default_app` | Firestore artifact id |

### Examples

**Preview a full import**

```bash
npm run import-games -- "docs/all games.json" --dry-run
```

**Import to production artifact**

```bash
npm run import-games -- "docs/all games.json" --app-id default_app
```

**PowerShell — quote the path**

```powershell
npm run import-games -- "docs/all games.json" --dry-run
```

---

## sync-dev-sources

Download NE GRAI + Steam curator vetting lists. Two modes:

1. **Local export** → writes `functions/data/*.json` (offline dev / smoke tests)
2. **Firestore seed** → writes `config/dev-sources-*` (production source of truth)

Production runtime reads **Firestore only**. `--to-firestore` re-downloads from the internet; it does **not** upload existing local JSON files.

**Invoke**

```text
npm run sync-dev-sources:firestore:full          # Firestore full seed (recommended on Windows)
npm run sync-dev-sources:firestore               # Firestore incremental
npm run sync-dev-sources:local                   # local JSON only
node scripts/sync-dev-sources.mjs [options]      # direct (best on PowerShell for custom flags)
```

### Parameters

| Name | Kind | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `--to-firestore` | flag | No | off | Write to Firestore (`config/dev-sources-*`) instead of local JSON |
| `--full` | flag | No | off | Force full curator re-download (ignore saved progress). Use after wipe or first seed |
| `--skip-curators` | flag | No | off | Skip Steam curator app-id lists |
| `--curators-only` | flag | No | off | Skip NE GRAI; sync curators only |
| `--build-dev-index` | flag | No | off | Build optional `dev-sources-dev-index` (slow; **not required** for app-id vetting) |
| `--curator-delay-ms` | option | No | `800` | Delay between Steam API calls when building dev index |
| `--app-id` | option | No | `default_app` | Firestore artifact (**only** with `--to-firestore`) |

### Examples

**Seed Firestore after a wipe (production — use on Windows/PowerShell)**

```bash
npm run sync-dev-sources:firestore:full
```

Or call node directly (PowerShell-safe):

```powershell
node scripts/sync-dev-sources.mjs --to-firestore --full --app-id default_app
```

**Export sources locally for offline testing**

```bash
npm run sync-dev-sources:local
npm run test-dev-sources
```

**Incremental Firestore update (keep curator progress)**

```bash
npm run sync-dev-sources:firestore
```

> **PowerShell trap:** `npm run sync-dev-sources -- --to-firestore --full` often drops flags and only passes `default_app`, running a **local export** instead. Use `sync-dev-sources:firestore:full` or `node scripts/...` directly.

---

## test-dev-sources

Smoke-test NE GRAI / curator / app-id lookups using **local** `functions/data/*.json`. No parameters. No Firestore.

**Invoke**

```text
npm run test-dev-sources
node scripts/test-dev-sources.mjs
```

### Parameters

None.

### Examples

**Run after local export**

```bash
npm run sync-dev-sources
npm run test-dev-sources
```

---

## revet-ru-games

Re-apply RU developer vetting on all games in Firestore. Reads `config/dev-sources-*`, repopulates `config/dev-bg-check`, updates `ruDeveloperAlert` on each game.

**Invoke**

```text
npm run revet-ru-games -- [options]
node scripts/revet-ru-games.mjs [options]
```

### Parameters

| Name | Kind | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `--dry-run` | flag | No | off | Log changes and decision trace; no Firestore writes |
| `--verbose` | flag | No | off | Print decision trace for every game, not only changes |
| `--wipe-user-acknowledged` | flag | No | off | Re-apply source flags on games with alert off but explanation kept (manual acknowledgments) |
| `--app-id` | option | No | `default_app` | Firestore artifact id |

Requires `config/dev-sources-*` seeded (`npm run sync-dev-sources:firestore:full`). Changed games print a per-layer trace: curator app list → developer cache → NE GRAI → curator dev index.

### Examples

**Preview flag changes**

```bash
npm run revet-ru-games -- --dry-run
```

**Re-vet library after source seed**

```bash
npm run revet-ru-games -- --app-id default_app
```

---

## fix-steam-links

Fix legacy `"Game Title on Steam"` link strings in import JSON by resolving Steam store URLs. Rewrites the file in place. No Firestore.

**Invoke**

```text
npm run fix-steam-links -- [jsonPath]
node scripts/fix-steam-links.mjs [jsonPath]
```

### Parameters

| Name | Kind | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `jsonPath` | positional | No | `docs/all games.json` | Friend-export JSON to update |

### Examples

**Fix default import file**

```bash
npm run fix-steam-links
```

**Fix a specific file before import**

```bash
npm run fix-steam-links -- "docs/all games.json"
npm run import-games -- "docs/all games.json" --dry-run
```

---

## wipe-maintenance-errors

Clear centralized errors and strip **legacy** error fields from game documents (post–schema v3 cleanup).

**Invoke**

```text
npm run wipe-maintenance-errors -- [options]
node scripts/wipe-maintenance-errors.mjs [options]
```

### Parameters

| Name | Kind | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `--dry-run` | flag | No | off | Report counts only |
| `--app-id` | option | No | `default_app` | Firestore artifact id |

### What it clears

- `config/maintenance-errors` (all entries)
- Legacy game fields: `lastSyncError`, `vettingError`, `thirdPartyErrors`, HLTB/ITAD status fields
- Resets `hltbErrors` / `itadErrors` on `config/steam-library-sync`
- Rebuilds `config/maintenance-audit`

Does **not** remove HLTB hours, ITAD prices, or `ruDeveloperAlert`.

### Examples

**Check how many games still have legacy error fields**

```bash
npm run wipe-maintenance-errors -- --dry-run
```

**Full cleanup**

```bash
npm run wipe-maintenance-errors -- --app-id default_app
```

---

## wipe-legacy-dev-sources

**Legacy cleanup.** Removes obsolete dev-source storage. Prefer deleting `config/dev-sources-*` docs in console or using `--include-v2-docs` before a fresh seed.

**Invoke**

```text
npm run wipe-legacy-dev-sources -- [options]
node scripts/wipe-legacy-dev-sources.mjs [options]
```

### Parameters

| Name | Kind | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `--include-v2-docs` | flag | No | off | Also delete all `dev-sources-*` config documents |
| `--app-id` | option | No | `default_app` | Firestore artifact id |

### What it clears

| Mode | Action |
| :--- | :--- |
| Default | Deletes `devBgCheck.sources` on deprecated `config/default` only |
| `--include-v2-docs` | Above + deletes `dev-sources-meta`, `dev-sources-ne-grai`, `dev-sources-curator-*`, `dev-sources-dev-index` |

Does **not** touch `config/dev-bg-check` or game documents.

### Examples

**Wipe Firestore source docs before re-seed**

```bash
npm run wipe-legacy-dev-sources -- --include-v2-docs
npm run sync-dev-sources -- --to-firestore --full
npm run revet-ru-games
```

**Remove obsolete blob on deprecated config doc only**

```bash
npm run wipe-legacy-dev-sources
```

---

## migrate-config-v3

**One-time migration** from monolithic `config/default` to schema v3 split docs. Skip if production is already on v3.

**Invoke**

```text
npm run migrate-config-v3 -- [options]
node scripts/migrate-config-v3.mjs [options]
```

### Parameters

| Name | Kind | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `--dry-run` | flag | No | off | Show planned writes only |
| `--app-id` | option | No | `default_app` | Firestore artifact id |

### Creates / updates

`dev-bg-check`, `gfn-catalog`, `steam-library-sync`, `third-party-health`, `maintenance-errors`, `maintenance-audit`

Does **not** delete `config/default`.

### Examples

**Preview migration**

```bash
npm run migrate-config-v3 -- --dry-run
```

**Run migration before deploying v3-only functions**

```bash
npm run migrate-config-v3
firebase deploy --only functions
```

---

## Optional local data (`functions/data/`)

| File | Purpose | Safe to delete? |
| :--- | :--- | :--- |
| `ne-grai-russian-publishers.json` | Local NE GRAI export | Yes — regenerate with `npm run sync-dev-sources` |
| `curator-flagged-appids.json` | Local curator export | Yes — same |
| `curator-flagged-developers.json` | Optional dev index | Yes — only if you used `--build-dev-index` |

These files are **not used in production**. Production reads Firestore `config/dev-sources-*`.

You can delete the whole `functions/data/` folder locally; re-create with `npm run sync-dev-sources` when you need offline tests.

**Repo note:** JSON snapshots may be committed for convenience. They can be removed from git and added to `.gitignore` if you only seed via `--to-firestore`.

---

## Other removable artifacts

| Path | What it is | Action |
| :--- | :--- | :--- |
| `.tmp-ne-grai/` | Untracked temp from NE GRAI experiments | Delete anytime |
| `config/default` (Firestore) | Deprecated monolithic config doc | Delete in console after v3 migration verified |
| Legacy error fields on games | Pre–v3 per-game errors | `npm run wipe-maintenance-errors -- --dry-run` to check; then run without `--dry-run` |

---

## Common sequences

### Fresh dev sources + re-vet library

```bash
npm run wipe-legacy-dev-sources -- --include-v2-docs
npm run sync-dev-sources -- --to-firestore --full
npm run revet-ru-games -- --dry-run
npm run revet-ru-games
```

### First bulk import

```bash
npm run fix-steam-links -- "docs/all games.json"
npm run import-games -- "docs/all games.json" --dry-run
npm run import-games -- "docs/all games.json"
```

### Verify no legacy error fields on games

```bash
npm run wipe-maintenance-errors -- --dry-run
```

---

## Firebase CLI (deploy)

Not Node scripts; listed for completeness.

| Command | Purpose |
| :--- | :--- |
| `npm run build && firebase deploy --only functions,firestore:rules,hosting` | Full deploy |
| `cd functions && npm run deploy` | Functions only |
| `cd functions && npm run serve` | Local functions emulator |

See [`OPS.md`](./OPS.md) for env vars and scheduled jobs.

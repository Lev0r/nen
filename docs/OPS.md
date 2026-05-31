# Operations & Deploy Runbook

**Related:** [AGENT_INTRO.md](./AGENT_INTRO.md) · [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) · [ru-developer-vetting.md](./features/ru-developer-vetting.md)

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
| `VITE_ENABLE_DYNAMIC_BG` | Default on; `false` + rebuild to disable |
| `VITE_USE_FUNCTIONS_EMULATOR` | Local emulators only |

### Functions (`functions/.env` — copy from `functions/.env.example`)

| Variable | Purpose |
| :--- | :--- |
| `ALLOWED_EMAIL_0/1` | Callable auth gate |
| `GFN_VPC_ID` | Default `NP-WAW-01` |
| `ITAD_API_KEY` | Optional ITAD enrichment |
| `ITAD_COUNTRY` | Default `UA` |

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

| Function | Schedule |
| :--- | :--- |
| `syncLibrarySteam` | Every 6 hours |
| `syncGfnCatalogScheduled` | Every 168 hours |
| `syncDevSourcesScheduled` | Every 168 hours |

---

## Callable reference

| Export | Client wrapper | Purpose |
| :--- | :--- | :--- |
| `addGameFromSteam` | ✅ | Add + vet game |
| `vetGameDevelopers` | ✅ `runDevCheck` | Manual re-vet one game |
| `syncSteamLibrary` | ✅ | Load meta info |
| `syncGfnCatalog` | ✅ | GFN catalog |
| `syncDevSources` | ❌ **no UI** | Refresh RU source lists |

Region: `europe-west1`. Sync callables: **540s** client timeout in `cloudFunctions.js`.

---

## Admin scripts (local → production Firestore)

Requires `firebase login` + project, or `GOOGLE_APPLICATION_CREDENTIALS`.

```bash
# Preview bulk import
npm run import-games -- "docs/all games.json" --dry-run

# Import library
npm run import-games -- "docs/all games.json" --app-id default_app

# Refresh RU flags on all games
node scripts/revet-ru-games.mjs --dry-run
node scripts/revet-ru-games.mjs

# Update bundled vetting JSON (local files only — deploy functions to ship)
node scripts/sync-dev-sources.mjs
node scripts/sync-dev-sources.mjs --curators-only
node scripts/sync-dev-sources.mjs --build-dev-index   # slow; optional dev index

# Smoke test lookups
node scripts/test-dev-sources.mjs
```

---

## RU vetting refresh (production)

After deploying curator-logic or source changes:

1. **`firebase deploy --only functions`**
2. **Refresh Firestore sources** — call `syncDevSources` (no UI yet; browser console or add Maintenance button)
3. **`node scripts/revet-ru-games.mjs`** — update all game flags + dev cache

No DB wipe needed. Stale `vettingError` clears on successful Run dev check.

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
- Document smoke paths: `addGameFromSteam`, `syncSteamLibrary`, `syncDevSources`, `vetGameDevelopers`

---

## 2026-05-31 release — test & polish (planned)

Validate and improve recently shipped behavior before/at bulk import:

- Maintenance modal — Load meta info, GFN sync, error acknowledge dot
- RU filter + Run dev check + curator parsing
- Sync timeouts (540s client) and user-facing error messages
- Notifications / toasts / inline feedback consistency

See smoke checklist in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md).

---

## Firestore console paths

`artifacts` → `default_app` → `public` → `data` → `games` / `config` → `default`

---

## Cost notes

~700 Firestore writes/day @ 147 games — free tier OK. Full-library function sync may timeout at ~400–500 games.

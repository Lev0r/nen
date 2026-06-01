# Bulk Import & Admin Scripts

**Related:** [Steam sync](./steam-sync-and-data.md) · [RU vetting](./ru-developer-vetting.md) · [OPS](../OPS.md)

## Import script

```bash
node scripts/import-games.mjs path/to/games.json [--dry-run] [--app-id default_app]
# or: npm run import-games -- docs/all\ games.json --dry-run
```

**Data:** `docs/all games.json` — 147 games, legacy friend-export format (URLs fixed via `fix-steam-links.mjs`).

### Pipeline

1. Normalize entries → scrape Steam (450ms delay) → skip duplicates
2. Pre-vet all unique developers once
3. Write schema v2 docs with `aggregateGameVetting`

### Auth

`GOOGLE_APPLICATION_CREDENTIALS` or `firebase login` + `firebase use`.

### Status

| Step | Status |
| :--- | :--- |
| Script + dry-run | Done |
| Production import | **Pending** (M7 — user ops) |
| Post-import `revet-ru-games.mjs` | Run after import if sources changed |

## Dev source scripts

```bash
# Seed Firestore directly (preferred for prod)
node scripts/sync-dev-sources.mjs --to-firestore
node scripts/sync-dev-sources.mjs --to-firestore --build-dev-index

# Export bundled JSON locally (dev only)
node scripts/sync-dev-sources.mjs
node scripts/sync-dev-sources.mjs --curators-only
```

Production runtime reads **Firestore only** — see [ru-developer-vetting.md](./ru-developer-vetting.md).

## Other scripts

| Script | Purpose |
| :--- | :--- |
| `revet-ru-games.mjs` | Re-apply RU flags to all Firestore games |
| `test-dev-sources.mjs` | Smoke test lookups |
| `fix-steam-links.mjs` | Resolve legacy "Title on Steam" placeholders |

## JSON formats

See script header in `import-games.mjs` — canonical objects, raw URLs/app IDs, or legacy `Game link` + nickname-owned keys.

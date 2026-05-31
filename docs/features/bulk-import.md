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
| Production import | **Pending** (user ops) |
| Post-import `revet-ru-games.mjs` | Pending if flags stale |

## Other scripts

| Script | Purpose |
| :--- | :--- |
| `revet-ru-games.mjs` | Re-apply RU flags to all Firestore games |
| `sync-dev-sources.mjs` | Local NE GRAI + curator JSON → `functions/data/` |
| `test-dev-sources.mjs` | Smoke test lookups |
| `fix-steam-links.mjs` | Resolve legacy "Title on Steam" placeholders |

**Note:** Local `sync-dev-sources` updates bundled JSON only. Production needs deploy + `syncDevSources` callable or wait for weekly schedule.

## JSON formats

See script header in `import-games.mjs` — canonical objects, raw URLs/app IDs, or legacy `Game link` + nickname-owned keys.

# Bulk Import & Admin Scripts

**Related:** [Steam sync](./steam-sync-and-data.md) · [RU vetting](./ru-developer-vetting.md) · [OPS](../OPS.md) · [DEV_CLI](../DEV_CLI.md) (full script reference)

## Import script

```bash
node scripts/import-games.mjs path/to/games.json [--dry-run] [--app-id default_app]
# or: npm run import-games -- docs/all\ games.json --dry-run
```

**Data:** `docs/all games.json` — 147 games, legacy friend-export format (URLs fixed via `fix-steam-links.mjs`).

### Pipeline

1. Normalize entries → scrape Steam (450ms delay) → skip duplicates
2. Pre-vet all unique developers and publishers once
3. Write schema v2 docs with `aggregateGameVetting`

### Auth

`GOOGLE_APPLICATION_CREDENTIALS` or `firebase login` + `firebase use`.

### Status

| Step | Status |
| :--- | :--- |
| Script + dry-run | Done |
| Production import | **Done** (~147 games in Firestore) |
| Post-import / post-deploy re-vet | **Done** (2026-06-02) — run again only after vetting logic or source list changes |

## Dev source scripts

See [DEV_CLI.md](../DEV_CLI.md) for full flags. Quick reference:

```bash
# Seed Firestore directly (preferred for prod)
npm run sync-dev-sources:firestore:full   # Windows-safe alias
# or: node scripts/sync-dev-sources.mjs --to-firestore --full

# Export bundled JSON locally (dev only)
node scripts/sync-dev-sources.mjs
node scripts/sync-dev-sources.mjs --curators-only
```

Production runtime reads **Firestore only** — see [ru-developer-vetting.md](./ru-developer-vetting.md).

## Other scripts

| Script | Purpose |
| :--- | :--- |
| `revet-ru-games.mjs` | Re-apply RU flags; `--dry-run`, `--verbose` decision trace |
| `test-dev-sources.mjs` | Regression smoke (NE GRAI exact match, message format, dedup) |
| `migrate-config-v3.mjs` | One-time split of legacy `config/default` |
| `fix-steam-links.mjs` | Resolve legacy "Title on Steam" placeholders |

## JSON formats

See script header in `import-games.mjs` — canonical objects, raw URLs/app IDs, or legacy `Game link` + nickname-owned keys.

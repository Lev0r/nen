# UI Shell & Modals

**Spec:** [`manifest_of_understanding.md`](../manifest_of_understanding.md) § 5, F6  
**Related:** [Filters](./filters-and-search.md) · [Total Hype](./total-hype.md) · [Maintenance](./maintenance-and-errors.md)

## Layout

```
LoginGate → DashboardShell
  ├── DynamicBackground (fixed, z-index 0)
  └── sidebar + main grid
        ├── GameFiltersBar
        └── GameCard[]
```

- **Sidebar** — lifecycle tabs with counts, Add Game, Maintenance (no top header)
- **Palette** — dark obsidian + mint `#14e8a0`; no blue in primary UI
- **Typography** — Clash Display (titles/headings), General Sans (body/UI) — see `index.css`
- **Title** — browser tab `Nen?`

## Dynamic background

`DynamicBackground.jsx` — today: top 5 non-banned games by Total Hype; Steam **screenshots**; 60s slide / 4s crossfade. Disable: `VITE_ENABLE_DYNAMIC_BG=false` at build time.

**Planned (round 2):** replace screenshots with slow animated gradient — see [FEATURE_CHECKLIST](../FEATURE_CHECKLIST.md) § UI polish round 2.

Reduced visual noise: lower BG opacity/contrast; card thumbnails dimmed on hover grid. **Round 2:** always-slightly-dim baseline; brighten on card hover only.

## Modals

| Modal | Trigger | Notes |
| :--- | :--- | :--- |
| `AddGameModal` | Sidebar | Two-phase: preview → co-op confirm → add |
| `MaintenanceModal` | Sidebar | Sync + error log + dev sources |
| `GameEditModal` | Card edit | Full metadata, Run dev check |
| `LifecycleModal` | Card lifecycle badge | State + note + finished stars |
| `ScreenshotsModal` | Card footer | Fullscreen carousel |

Glassmorphism: `.modal-backdrop` + `.glass-panel` in `index.css`.

## GameCard highlights

- Card redesign — cleaner layout, reduced visual noise
- Hype ring (bottom-right), ownership indicator (bottom-left)
- Lifecycle badge, update pulse, GFN pill, RU border
- Price in header today — **round 2:** move to meta line; title-only header
- Finished rating in tags today — **round 2:** meta line, numeric 1–5, click → edit modal rating section
- Tooltips: players, reviews, version, release/EA duration

### Planned — UI polish round 2

See [FEATURE_CHECKLIST](../FEATURE_CHECKLIST.md) § UI polish round 2 for full spec (gradient BG, title tooltip, thumbnail icon unify, footer notes/edit).

## Add game flow

1. User enters Steam URL → `previewSteamGame` (scrape only)
2. If missing co-op categories → confirm dialog
3. `addGameFromSteam` persists + vets

Escape + backdrop dismiss supported (disabled while loading). See [Bulk import](./bulk-import.md) for CLI path. Client duplicate check by app ID before persist.

## Deferred

- Mobile UX pass (tooltips, sidebar drawer)
- "Refresh from Steam" in edit modal

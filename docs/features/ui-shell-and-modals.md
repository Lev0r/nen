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
- **Title** — browser tab `Nen?`

## Dynamic background

`DynamicBackground.jsx` — top 5 non-banned games by Total Hype; Steam **screenshots**; 60s slide / 4s crossfade. Disable: `VITE_ENABLE_DYNAMIC_BG=false` at build time.

## Modals

| Modal | Trigger | Notes |
| :--- | :--- | :--- |
| `AddGameModal` | Sidebar | Steam URL → `addGameFromSteam` |
| `MaintenanceModal` | Sidebar | Sync + error log |
| `GameEditModal` | Card edit | Full metadata, Run dev check |
| `LifecycleModal` | Card lifecycle badge | State + note + finished stars |
| `ScreenshotsModal` | Card footer | Fullscreen carousel |

Glassmorphism: `.modal-backdrop` + `.glass-panel` in `index.css`.

## GameCard highlights

- Hype ring (bottom-right), ownership indicator (bottom-left)
- Lifecycle badge, update pulse, GFN pill, RU border
- Price hidden when both own
- Tooltips: players, reviews, version, release/EA duration

## Add game flow

See [Bulk import](./bulk-import.md) for CLI path. Client duplicate check by app ID before callable.

## Deferred

- Mobile UX pass (tooltips, sidebar drawer)
- AddGameModal Escape / backdrop dismiss (other modals have it)
- "Refresh from Steam" in edit modal

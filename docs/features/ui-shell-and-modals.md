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
- **Palette** — warm graphite glass + softer sage `#4cc9a0`; no blue in primary UI
- **Typography** — Clash Display (titles/headings), General Sans (body/UI) — see `index.css`
- **Title** — browser tab `Nen?`

## Dynamic background

`DynamicBackground.jsx` — layered CSS wave mesh (blurred blobs + diagonal sheen, top-right → bottom-left flow). Warm graphite base with sage + forest + bronze tones. No external library. Disable: `VITE_ENABLE_DYNAMIC_BG=false`. Respects `prefers-reduced-motion`.

Card thumbnails: full color at rest; slight scale on card hover. Lifecycle badge on thumbnail: **hidden** on lifecycle tabs; shown when filters scope the full library.

## Modals

| Modal | Trigger | Notes |
| :--- | :--- | :--- |
| `AddGameModal` | Sidebar | Two-phase: preview → co-op confirm → add |
| `MaintenanceModal` | Sidebar | Sync + error log + dev sources |
| `GameEditModal` | Card edit | Full metadata, Run dev check |
| `LifecycleModal` | Card lifecycle badge (when visible) or edit | State + note + finished stars |
| `ScreenshotsModal` | Card footer | Fullscreen carousel |

Glassmorphism: `.modal-backdrop` + `.glass-panel` in `index.css`.

## GameCard highlights

- Title-only header with truncation tooltip
- Meta line: centered cluster — items intrinsic width, pipe-separated (price/rating last)
- Cards, sidebar, and panels share `--glass-bg` (transparent warm graphite)
- Finished rating: color-coded 1–5 in meta; click opens edit modal at rating (`focusRating`)
- Hype ring (bottom-right), ownership (bottom-left), lifecycle (top), screenshots (top-right)
- Unified semi-transparent overlay chrome + glow on thumb controls
- Footer: SteamDB | notes (rectangular, separator) | edit
- RU badge on thumbnail bottom-center; unified badge height/radius (6px)
- Meta trailing: price + finished rating aligned right
- Tooltips: players, reviews, version, release/EA duration

## Add game flow

1. User enters Steam URL → `previewSteamGame` (scrape only)
2. If missing co-op categories → confirm dialog
3. `addGameFromSteam` persists + vets

Escape + backdrop dismiss supported (disabled while loading). See [Bulk import](./bulk-import.md) for CLI path. Client duplicate check by app ID before persist.

## Deferred

- Mobile UX pass (tooltips, sidebar drawer)
- "Refresh from Steam" in edit modal

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

`DynamicBackground.jsx` — layered CSS wave mesh (blurred blobs + diagonal sheen, top-right → bottom-left flow). Warm graphite base with coral, moss, and teal wave tones. No external library. Disable: `VITE_ENABLE_DYNAMIC_BG=false`. Respects `prefers-reduced-motion`.

Card thumbnails: **120px** height, full color at rest; slight scale on card hover. Lifecycle badge on thumbnail: **hidden** on lifecycle tabs; shown when filters scope the full library.

## Modals

| Modal | Trigger | Notes |
| :--- | :--- | :--- |
| `AddGameModal` | Sidebar | Two-phase: preview → co-op confirm → add |
| `MaintenanceModal` | Sidebar | Sync + error log + dev sources |
| `GameEditModal` | Card edit | Full metadata, Run dev check, **Refresh from Steam** |
| `LifecycleModal` | Card lifecycle badge (when visible) or edit | State + note + finished stars |
| `ScreenshotsModal` | Card footer | Fullscreen carousel |

Glassmorphism: `.modal-backdrop` + `.glass-panel` in `index.css`.

## GameCard highlights

- Header: title + price row (mid-size typography under title); truncation tooltip on title
- Price row: sale price + discount; **historical low icon only when on sale**; **"Owned by both players"** when both users own (keeps header height stable)
- Meta line: version, critics, players, HLTB, finished rating — intrinsic-width cluster, pipe-separated
- Cards, sidebar, and panels share `--glass-bg` (warm graphite glass)
- Finished rating: color-coded 1–5 in meta; click opens edit modal at rating (`focusRating`)
- Hype ring (bottom-right): vertical center on thumbnail bottom border (overlaps thumb + body); opaque graphite fill, graphite outline, score-colored glow
- Ownership (bottom-left inside thumb), lifecycle (top), screenshots (top-right)
- Footer: SteamDB | notes (rectangular, separator) | edit
- RU badge on thumbnail bottom-center; unified badge height/radius (6px)
- Tooltips: players, reviews, version, release/EA duration

## Add game flow

1. User enters Steam URL → `previewSteamGame` (scrape only)
2. If missing co-op categories → confirm dialog
3. `addGameFromSteam` persists + vets

Escape + backdrop dismiss supported (disabled while loading). See [Bulk import](./bulk-import.md) for CLI path. Client duplicate check by app ID before persist.

**Refresh from Steam** (GameEditModal Basic section): callable `refreshGameFromSteam` re-scrapes `steamStatic`, `steamDynamic`, player stats, and HLTB/ITAD for one game (`force` sync). Skips banned games; errors recorded in `config/maintenance-errors`.

## Deferred

- Mobile UX pass (tooltips, sidebar drawer)

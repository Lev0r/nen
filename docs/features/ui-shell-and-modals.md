# UI Shell & Modals

**Spec:** [`manifest_of_understanding.md`](../manifest_of_understanding.md) § 5, F6  
**Related:** [Filters](./filters-and-search.md) · [Total Hype](./total-hype.md) · [Maintenance](./maintenance-and-errors.md)

## Layout

```
LoginGate → DashboardShell
  ├── DynamicBackground (fixed, z-index 0)
  └── sidebar + main (`library` grid or `events` view)
        ├── GameFiltersBar
        └── GameCard[]
```

- **Sidebar** — **Events** nav first (sales/festivals view); lifecycle tabs with counts and **update dot** (`nav-item-update-dot`) when any game in that tab (or Active sub-tab) has `hasUpdateSinceState`; Add Game, Maintenance (no top header)
- **Mobile (≤768px)** — hamburger opens drawer with same nav; search in top-right icon → `MobileSearchModal`; **Filters** opens full-screen `FilterSheetModal` (scrollable chip groups); inline filter search hidden (`hideSearch` on `GameFiltersBar`); drawer/search use `--modal-backdrop-bg` / `--modal-panel-bg`
- **Palette** — warm graphite glass + softer sage `#4cc9a0`; no blue in primary UI
- **Typography** — Clash Display (titles/headings), General Sans (body/UI) — see `index.css`
- **Title** — browser tab `Nen?`

## Dynamic background

`DynamicBackground.jsx` — single **`nebula1.webp`** from `public/backgrounds/`. Blur is applied on **one fixed layer** behind the UI (`filter: blur` on `.app-background__image`), not `backdrop-filter` on cards. Warm **graphite overlay** keeps cards readable. No crossfade. Disable: `VITE_ENABLE_DYNAMIC_BG=false`. See [`public/backgrounds/README.md`](../../public/backgrounds/README.md).

Cards and shell use **opaque glass** (`--glass-bg`) — no `backdrop-filter` on game cards or the dashboard grid (scroll/GPU perf).

Card thumbnails: **120px** height, full color at rest; slight scale on card hover (disabled under reduced motion). Lifecycle badge on thumbnail: **hidden** on lifecycle tabs; shown when filters scope the full library.

## Modals

| Modal | Trigger | Notes |
| :--- | :--- | :--- |
| `AddGameModal` | Sidebar | Two-phase: preview → co-op confirm → add |
| `MaintenanceModal` | Sidebar | Sync + error log + dev sources |
| `GameEditModal` | Card edit | Full metadata, Run dev check, **Refresh from Steam** |
| `LifecycleModal` | Card lifecycle badge (when visible) or edit | State + note + finished stars |
| `ScreenshotsModal` | Card footer | Fullscreen carousel |

Panels: `.modal-backdrop` (`--modal-backdrop-bg`) + modal panels (`--modal-panel-bg`, ~92% opacity) in `index.css` — less transparent than shell cards (`--glass-bg`).

## GameCard highlights

- Header: title + price row (mid-size typography under title); truncation tooltip on title
- Price row: sale price + discount; **historical low icon only when on sale**; **"Owned by both players"** when both users own (keeps header height stable)
- Meta line: version, critics, players, HLTB, finished rating — intrinsic-width cluster, pipe-separated
- **Pending update** — when `hasUpdateSinceState`, version shows a `new` indicator; tooltip lists version and/or status drift; click → `VersionAcknowledgePopover` rebaselines `stateMeta` without changing lifecycle
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

## Events view

`EventsPage.jsx` — hero for `nextFeatured`, grid of six `upcoming` events from `config/steam-events`. See [Steam events](./steam-events.md).

## Touch tooltips (`FloatingTooltip`)

- **Desktop:** hover to show (unchanged)
- **Coarse pointer (touch):** tap toggles tooltip; tap outside or Escape dismisses
- **Controls with actions** (ownership, hype, lifecycle): first tap shows tooltip (suppresses button click); second tap on the control runs the action
- Anchors use `user-select: none` and `touch-action: manipulation` to avoid text-selection conflicts

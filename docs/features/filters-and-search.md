# Filters & Search

**Last updated:** 2026-06-03 (collapsed on load; nav preserves expanded panel)

**Spec:** [`manifest_of_understanding.md`](../manifest_of_understanding.md) § F2  
**Related:** [Lifecycle](./lifecycle-and-ownership.md) · [RU vetting](./ru-developer-vetting.md) · [UI shell](./ui-shell-and-modals.md)

## Scope rules

| Source | Behavior |
| :--- | :--- |
| **Sidebar tab / Active sub-tab** | Sets a **lifecycle filter preset** via `filtersForSidebarNav(activeTab, activeSubTab)` and clears all other filter fields |
| **Grid & filter panel** | Always operate on the **full library** (`games`) |
| **Clear filters** | Resets to `DEFAULT_GAME_FILTERS` (entire library — all includes/excludes empty, footer tri-states `off`) |

The sidebar is not a separate browse pool — it is the primary way to choose lifecycle include rules (and Active sub-tabs add TBA include/exclude). Users refine in the filter panel on top of that preset.

Implemented: `src/utils/gameFilters.js`, `src/components/GameFiltersBar.jsx`, `DashboardShell.jsx`.

### Nav presets (`filtersForSidebarNav`)

| Nav | Preset |
| :--- | :--- |
| Active → **Active** | `libraryStates.include: ['active']`, `developmentStatuses.exclude: ['tba']` (null/unknown status kept) |
| Active → **TBA** | `libraryStates.include: ['active']`, `developmentStatuses.include: ['tba']` |
| Other lifecycle tabs | `libraryStates.include: [tabId]` |

## Tri-state filter model

Each chip dimension uses `{ include: [], exclude: [] }`. Footer toggles use `'off' | 'include' | 'exclude'`.

| Rule | Behavior |
| :--- | :--- |
| **Include non-empty** | Game must match **at least one** included value in that dimension |
| **Exclude non-empty** | Game must **not** match any excluded value |
| **Both empty / footer `off`** | Dimension ignored |

**Chip click cycle:** neutral → include (green `.filter-chip--include`) → exclude (red outline `.filter-chip--exclude`) → neutral. Helper: `cycleChipState(current)`.

**Footer toggles** cycle the same tri-state (`off` → `include` → `exclude` → `off`). Include = must match condition; exclude = must not match.

## Filter fields

| Field | UI |
| :--- | :--- |
| `searchText` | Name substring (case-insensitive) |
| `libraryStates` | Lifecycle chips (tri-state) |
| `developmentStatuses` | released / early_access / tba (tri-state) |
| `steamTags` | Tag chips (tri-state) — **co-op tags excluded** |
| `ownerships` | neither / one / both (tri-state) |
| `onSaleOnly` | Footer tri-state (include excludes games owned by both users) |
| `gfnOnly` | Footer tri-state (global GFN catalog) |
| `ruOnly` | Footer tri-state |
| `updateAvailableOnly` | Footer tri-state (`hasUpdateSinceState`) |

Tag chip cloud: `collectSteamTags(games, currentFilters, gfnIds)` — only tags that appear on games matching the **current sidebar preset and other filters** (Steam tag selection ignored when building the list). Tags not in the current view (e.g. `sports` only on Finished games while browsing Active) are **omitted**, not shown disabled. Excluded from the cloud: co-op-related tags and **`early access`** (use Status chips instead). Source: `steamStatic.steamTags` from Steam scrape (genres + co-op categories).

Each `GameCard` shows its **lifecycle badge** on the thumbnail (full-library view).

## Add game co-op validation

Two-phase add flow — see [UI shell](./ui-shell-and-modals.md):

1. `previewSteamGame` scrapes metadata
2. If no co-op Steam categories (9, 38, 39, 48), show non-blocking confirm before `addGameFromSteam`

## Deferred

- **Ready to Play preset** — use ownership + lifecycle chips instead

## Dynamic option disabling (facet gating)

`DashboardShell` passes `filterMode={true}` always. `filterSourceGames` is the full library.

For each chip/toggle option, count games matching **all other active filters** plus that option alone (simulated as include). An option is **enabled** when count &gt; 0 **or** it is already in include/exclude; otherwise the chip gets `filter-chip--disabled` and footer switches get `game-filters-switch--disabled`. Helpers live in `gameFilters.js`; `GameFiltersBar` uses `chipEnabled` with `filterMode`.

**Lifecycle chips** use `allGames`. **Status, ownership, tags, and footer toggles** use `filterSourceGames` (same full library).

## Grid sort (filtered view)

After `filterGames`, the grid applies a **stable** sort: non–RU-alert games first, `isRuDeveloperAlert` games last, preserving descending Total Hype order within each group (inherited from Firestore subscription sort).

## UX notes

- Panel starts **collapsed** on page load (sidebar nav presets do not auto-expand it)
- Opens on search focus, **Filters** button (mobile), chip/toggle change (`updateFilter`), or mobile search modal “Open filters”
- Collapse: **×** in expanded panel header, click outside the bar (not sidebar nav), or **Escape** — filters and grid results stay unchanged
- Sidebar nav clicks update filter presets without collapsing an open panel; `filtersExpanded` / `onFiltersExpandedChange` in `DashboardShell` persist across library tabs and Events ↔ library
- **Clear filters** when `hasActiveFilters` (any include/exclude/search/footer not `off`); `onResetFilters` sets `DEFAULT_GAME_FILTERS`
- Do not use CSS `:focus-within` for panel expand (breaks toggles)

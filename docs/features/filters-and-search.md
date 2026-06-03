# Filters & Search

**Last updated:** 2026-06-03

**Spec:** [`manifest_of_understanding.md`](../manifest_of_understanding.md) § F2  
**Related:** [Lifecycle](./lifecycle-and-ownership.md) · [RU vetting](./ru-developer-vetting.md) · [UI shell](./ui-shell-and-modals.md)

## Scope rules

| Source | Behavior |
| :--- | :--- |
| **Sidebar tab / Active sub-tab** | Sets a **lifecycle filter preset** via `filtersForSidebarNav(activeTab, activeSubTab)` and clears all other filter fields |
| **Grid & filter panel** | Always operate on the **full library** (`games`) |
| **Clear filters** | Resets to the **current sidebar preset**, not empty filters |

The sidebar is not a separate browse pool — it is the primary way to choose `libraryStates` (and Active sub-tabs add TBA include/exclude rules). Users refine in the filter panel on top of that preset.

Implemented: `src/utils/gameFilters.js`, `src/components/GameFiltersBar.jsx`, `DashboardShell.jsx`.

### Nav presets (`filtersForSidebarNav`)

| Nav | Preset |
| :--- | :--- |
| Active → **Active** | `libraryStates: ['active']`, `excludeDevelopmentStatuses: ['tba']` (null/unknown status kept) |
| Active → **TBA** | `libraryStates: ['active']`, `developmentStatuses: ['tba']` |
| Other lifecycle tabs | `libraryStates: [tabId]` |

Helpers: `filtersMatchNavPreset`, `hasFiltersBeyondNavPreset` (Clear button + empty state).

## Filter fields

| Field | UI |
| :--- | :--- |
| `searchText` | Name substring (case-insensitive) |
| `libraryStates[]` | Lifecycle chips |
| `developmentStatuses[]` | released / early_access / tba (OR) |
| `excludeDevelopmentStatuses[]` | Exclude listed statuses (used by Active sub-tab preset; no chip UI) |
| `steamTags[]` | Tag chips (OR) — **co-op tags excluded** |
| `ownerships[]` | neither / one / both (OR) |
| `onSaleOnly` | Toggle (excludes games owned by both users) |
| `gfnOnly` | Toggle (global GFN catalog) |
| `ruOnly` | Toggle |
| `updateAvailableOnly` | Toggle (`hasUpdateSinceState`) |

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

For each chip/toggle option, count games matching **all other active filters** plus that option alone. An option is **enabled** when count &gt; 0 **or** it is already selected; otherwise the chip gets `filter-chip--disabled` and footer switches get `game-filters-switch--disabled`. Helpers live in `gameFilters.js`; `GameFiltersBar` uses `chipEnabled` with `filterMode`.

**Lifecycle chips** use `allGames`. **Status, ownership, tags, and footer toggles** use `filterSourceGames` (same full library).

Status and ownership are **additive multi-select** (OR within each dimension, AND across dimensions). No “All” chip — deselect all chips in a group to clear that dimension.

## Grid sort (filtered view)

After `filterGames`, the grid applies a **stable** sort: non–RU-alert games first, `isRuDeveloperAlert` games last, preserving descending Total Hype order within each group (inherited from Firestore subscription sort).

## UX notes

- Panel expands on search focus or when changing a filter (`updateFilter`)
- **Desktop:** `hasActiveFilters` auto-expands the panel (nav preset always includes lifecycle, so panel tends to stay expanded)
- **Mobile (≤768px):** panel stays collapsed until the user opens it (search focus, **Filters** button, or a chip/toggle change)
- Collapse: **×** in expanded panel header, click outside the bar, or **Escape** — filters and grid results stay unchanged
- **Clear filters** when `hasFiltersBeyondNavPreset` (resets to sidebar preset via `onResetFilters`)
- Do not use CSS `:focus-within` for panel expand (breaks toggles)

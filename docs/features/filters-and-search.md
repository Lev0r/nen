# Filters & Search

**Last updated:** 2026-06-03

**Spec:** [`manifest_of_understanding.md`](../manifest_of_understanding.md) § F2  
**Related:** [Lifecycle](./lifecycle-and-ownership.md) · [RU vetting](./ru-developer-vetting.md) · [UI shell](./ui-shell-and-modals.md)

## Scope rules

| Condition | Game pool |
| :--- | :--- |
| No active filters | **Current sidebar lifecycle tab** only |
| Any filter active (`hasActiveFilters`) | **Entire library** |
| Sidebar tab click | Resets all filters to defaults |

Implemented: `src/utils/gameFilters.js`, `src/components/GameFiltersBar.jsx`, `DashboardShell.jsx`.

## Filter fields

| Field | UI |
| :--- | :--- |
| `searchText` | Name substring (case-insensitive) |
| `libraryStates[]` | Lifecycle chips |
| `steamTags[]` | Tag chips (OR) — **co-op tags excluded** |
| `developmentStatuses[]` | released / early_access / tba (OR within dimension; empty = no filter) |
| `ownerships[]` | neither / one / both (OR within dimension; empty = no filter) |
| `onSaleOnly` | Toggle (excludes games owned by both users) |
| `gfnOnly` | Toggle (global GFN catalog) |
| `ruOnly` | Toggle |
| `updateAvailableOnly` | Toggle (`hasUpdateSinceState`) |

Tag list built from **full library** (`collectSteamTags(games)`), not current tab. Co-op-related tags filtered out in `gameFilters.js` (`isCoopTag`).

When **any filter is active**, the grid searches the full library and each `GameCard` shows its **lifecycle badge** on the thumbnail (hidden on lifecycle-only tab views where state is implicit).

## Add game co-op validation

Two-phase add flow — see [UI shell](./ui-shell-and-modals.md):

1. `previewSteamGame` scrapes metadata
2. If no co-op Steam categories (9, 38, 39, 48), show non-blocking confirm before `addGameFromSteam`

## Deferred

- **Ready to Play preset** — use ownership + lifecycle chips instead

## Dynamic option disabling (facet gating)

`DashboardShell` passes `filterMode={filtersScopeGlobal}` (`hasActiveFilters`) into `GameFiltersBar`.

| Mode | Condition | Chip / toggle enabled state |
| :--- | :--- | :--- |
| **Browse** | No active filters | **All** chips and footer toggles enabled (click any filter to enter filter mode) |
| **Filter** | Any filter active | Dynamic facet disabling (below) |

In **filter mode**, `filterSourceGames` is the full library (same pool as the result count denominator). For each chip/toggle option, count games matching **all other active filters** plus that option alone. An option is **enabled** when count &gt; 0 **or** it is already selected; otherwise the chip gets `filter-chip--disabled` and footer switches get `game-filters-switch--disabled` (still visible). Helpers live in `gameFilters.js` (`isLibraryStateFilterEnabled`, `isDevelopmentStatusFilterEnabled`, etc.); `GameFiltersBar` wraps them with `chipEnabled` so browse mode skips gating.

**Lifecycle chips** use the **full library** (`allGames`) for facet counts. **Status, ownership, tags, and footer toggles** use `filterSourceGames` (equals full `games` in filter mode). On a sidebar tab in browse mode, tab-scoped `filterSourceGames` does **not** affect chip disabled state — only grid results and counts do.

Status and ownership are **additive multi-select** (OR within each dimension, AND across dimensions). No “All” chip — deselect all chips in a group to clear that dimension.

## Grid sort (filtered view)

After `filterGames`, the grid applies a **stable** sort: non–RU-alert games first, `isRuDeveloperAlert` games last, preserving descending Total Hype order within each group (inherited from Firestore subscription sort).

## UX notes

- Panel expands on search focus or when changing a filter (`updateFilter`)
- **Desktop:** active filters auto-expand the panel (`matchMedia` above 768px)
- **Mobile (≤768px):** panel stays collapsed until the user opens it (search focus, **Filters** button, or a chip/toggle change); active filters alone do not auto-expand
- Collapse: **×** in expanded panel header, click outside the bar, or **Escape** — filters and grid results stay unchanged
- **Clear filters** in header when any filter active (resets values and collapses panel)
- Do not use CSS `:focus-within` for panel expand (breaks toggles)

# Filters & Search

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
| `developmentStatus` | released / early_access / tba / all |
| `ownership` | neither / one / both |
| `onSaleOnly` | Toggle |
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

## UX notes

- Panel expands on search focus or active filters
- **Clear filters** in header when any filter active
- Do not use CSS `:focus-within` for panel expand (breaks toggles)

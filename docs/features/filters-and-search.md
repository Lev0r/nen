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
| `steamTags[]` | Tag chips (OR) |
| `developmentStatus` | released / early_access / tba / all |
| `ownership` | neither / one / both |
| `onSaleOnly` | Toggle |
| `gfnOnly` | Toggle (global GFN catalog) |
| `ruOnly` | Toggle |
| `updateAvailableOnly` | Toggle (`hasUpdateSinceState`) |

Tag list built from **full library** (`collectSteamTags(games)`), not current tab.

## Planned changes (not implemented)

- **Remove co-op-related tags from filter UI** — all library games are co-op-focused; co-op tag chips add noise
- **Co-op validation on add** — warn if Steam categories lack co-op IDs (9, 38, 39, 48): *"This game does not have a co-op tag. Are you sure you want to add it?"*
- **Ready to Play preset** — deferred (use ownership + lifecycle chips)

## UX notes

- Panel expands on search focus or active filters
- **Clear filters** in header when any filter active
- Do not use CSS `:focus-within` for panel expand (breaks toggles)

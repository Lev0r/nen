# Lifecycle & Ownership

**Spec:** [`manifest_of_understanding.md`](../manifest_of_understanding.md) § F2  
**Related:** [Total Hype](./total-hype.md) · [Steam sync](./steam-sync-and-data.md) · [Filters](./filters-and-search.md)

## Implemented

### Lifecycle (`libraryState`)

| State | Sidebar tab |
| :--- | :--- |
| `active` | Active (with sub-tabs) |
| `replayable` | Replayable |
| `waiting_for_updates` | Waiting for updates |
| `finished` | Finished |
| `banned` | Banned |

### Active sub-tabs

Under **Active**, nested sub-tabs split the pool:

| Sub-tab | Pool |
| :--- | :--- |
| **Active** (default) | `libraryState === 'active'` and `developmentStatus !== 'tba'` |
| **TBA** | `libraryState === 'active'` and `developmentStatus === 'tba'` |

Implemented in `DashboardShell.jsx` (`ACTIVE_SUB_TABS`, `matchesActiveSubTab`).

- **`resolveLibraryState`** — `src/utils/libraryState.js` (legacy `abandoned` → `banned`)
- **`LifecycleModal`** — card lifecycle badge (when visible) or edit modal; optional note; finished rating when `finished`
- **Lifecycle badge on card** — shown only when filters scope the full library (`showLifecycleBadge={filtersScopeGlobal}` in `DashboardShell.jsx`); hidden on sidebar lifecycle tabs
- **`stateMeta`** — `versionAtEntry`, `enteredAt`, `note` on state change via `buildStateMetaUpdates`
- **`hasUpdateSinceState`** — set when Steam version ≠ `versionAtEntry` (`steamSync.js`); cleared on re-assigning lifecycle
- **Finished rating** — 1–5 stars (`FinishedRatingPicker.jsx`); cleared when leaving `finished`

### Ownership & notes

- **`owned.user0` / `owned.user1`** — quick toggle on card; full edit in `GameEditModal`
- **Lifecycle note** — `stateMeta.note` (shared)
- **Per-user notes** — `userNotes.user0` / `userNotes.user1` (edit modal)

## Sync interaction

| State | Sync behavior |
| :--- | :--- |
| `banned` | Skip all Steam/HLTB/ITAD/player sync |
| `finished` | Slower dynamic/ITAD/player intervals (7d vs 24h) |
| Others | Normal 6h gated sync |

## Hype interaction

`finished` and `banned` force Total Hype to **0** — see [Total Hype](./total-hype.md).

## Deferred

- Banned tab passcode (archive privacy)
- `stateMeta.enteredBy` audit field

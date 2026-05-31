# Feature Documentation Index

Minimal docs for task-focused agent onboarding. Each file links to code paths, related features, and the canonical spec section in [`manifest_of_understanding.md`](../manifest_of_understanding.md).

| Feature | Summary | Spec | Primary code |
| :--- | :--- | :--- | :--- |
| [Auth & access](./auth-and-access.md) | Google sign-in, 2-user allowlist, Firestore rules | F1 | `AuthContext.jsx`, `firestore.rules` |
| [Lifecycle & ownership](./lifecycle-and-ownership.md) | 5 library states, ownership, notes, finished stars | F2 | `libraryState.js`, `LifecycleModal.jsx` |
| [Total Hype](./total-hype.md) | Sort score, tier picker, formula overrides | F3 | `hypeScore.js`, `GameCard.jsx` |
| [Steam sync & data](./steam-sync-and-data.md) | Scrape, 6h sync, HLTB, ITAD, GFN | F5, F6 | `steam.js`, `steamSync.js` |
| [RU developer vetting](./ru-developer-vetting.md) | List-based RU flags, cache, manual re-check | F4 | `devSources.js`, `devVetting.js` |
| [Filters & search](./filters-and-search.md) | Toolbar filters, scope rules, RU toggle | F2 | `gameFilters.js`, `GameFiltersBar.jsx` |
| [UI shell & modals](./ui-shell-and-modals.md) | Sidebar, cards, dynamic BG, add/edit flow | §5 | `DashboardShell.jsx`, `GameCard.jsx` |
| [Maintenance & errors](./maintenance-and-errors.md) | Sync UI, error log, acknowledge dot | F4 | `MaintenanceModal.jsx`, `appErrors.js` |
| [Bulk import](./bulk-import.md) | CLI import of ~147 games, revet script | — | `scripts/import-games.mjs` |

**Cross-cutting:** [`../OPS.md`](../OPS.md) · [`../DECISIONS.md`](../DECISIONS.md) · [`../FEATURE_CHECKLIST.md`](../FEATURE_CHECKLIST.md) · [`../CODE_IMPROVEMENTS.md`](../CODE_IMPROVEMENTS.md)

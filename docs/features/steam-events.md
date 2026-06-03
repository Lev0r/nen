# Steam Events

**Last updated:** 2026-06-03

**Related:** [Steam sync](./steam-sync-and-data.md) · [UI shell](./ui-shell-and-modals.md) · [Maintenance](./maintenance-and-errors.md) · [OPS](../OPS.md)

## Overview

Steam sales and festival calendar for the dashboard **Events** view (SteamDB-style overview, not a SteamDB scrape).

**Data sources:**

- Steam store **`featuredcategories`** API (`cc=us`, `l=english`) — spotlight items with `/sale/SLUG` URLs
- Optional sale-page HTML enrichment (`og:title`, `og:image`) for up to 5 slugs per sync
- **`KNOWN_SCHEDULE`** in `functions/steamEventsSync.js` — public Steam Next Fest 2026 dates (Jun 15–22, Oct 19–26) and approximate seasonal sale placeholders

All `store.steampowered.com` HTTP uses the shared **store rate limiter** (`scheduleStoreRequest`).

## Firestore

| Doc | Path | Written by |
| :--- | :--- | :--- |
| `steam-events` | `artifacts/{appId}/public/data/config/steam-events` | `syncSteamEventsCore` |

**Fields:** `syncedAt`, `events[]`, `nextFeatured`, `upcoming` (next 6 after featured), `eventCount`, `sourceNote`, `schemaVersion`.

## Scheduler & callable

| Entry | Interval / trigger | Core |
| :--- | :--- | :--- |
| Task `steamEvents` | **7d** (orchestrator) | `syncSteamEventsCore` |
| `syncSteamEvents` | Callable (Maintenance) | same |

Client: `syncSteamEvents()` in `src/services/cloudFunctions.js` (120s timeout).

## Frontend

| Piece | Path |
| :--- | :--- |
| Events page | `src/components/EventsPage.jsx` |
| Subscription | `useSteamEvents` in `src/services/db.js` via `MaintenanceDataContext` |
| Nav | Sidebar **Events** (top, above lifecycle tabs); `topView`: `library` \| `events` in `DashboardShell.jsx` |

## Deploy

After `firebase deploy --only functions`, the new callable `syncSteamEvents` is live. The orchestrator picks up task `steamEvents` on the next 6h tick (runs when 7d since last complete). Run **Sync Steam events** once from Maintenance to seed `config/steam-events`.

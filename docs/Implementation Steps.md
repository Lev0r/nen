# Implementation Steps

**Project:** Nen? Co-op Gaming Tracker  
**Purpose:** Single checklist to track what is done and what remains before the project is "complete."  
**Last updated:** 2026-05-30 (consolidated backlog — your comments incorporated)

Read alongside [manifest_of_understanding.md](./manifest_of_understanding.md) (spec) and [PROJECT_HANDOFF.md](./PROJECT_HANDOFF.md) (code map & ops).

---

## Consolidated remaining work (start here)

Everything below is **not done yet**, ordered by suggested priority. Completed history is in sections further down.

### Confirmed from discussion (2026-05-30)

| Topic | Decision |
|-------|----------|
| **GFN sync** | Saves **full GFN Steam catalog** to Firestore (~2k IDs), **not** your library. New games get badge without re-sync. |
| **`steamInput` in import JSON** | Same as + Add Game: Steam URL or App ID (see [Bulk import notes](#bulk-import-notes)). |
| **Search vs sidebar** | Text search searches **all games** (overrides lifecycle sidebar tab). |
| **Filters** | Add GFN toggle, Update available toggle, lifecycle state chips (same panel as On sale). |
| **Dynamic background** | Top 5 by Total Hype; all tabs; **`VITE_ENABLE_DYNAMIC_BG` default `true`**; set `false` + redeploy to disable. |
| **Bulk import Gemini** | Run vetting **only** for games imported as **`libraryState: 'active'`** (default). |
| **Browser branding** | Done (Phase 14). |
| **Finished rating** | 1–5 stars in edit modal and/or when marking Finished. |
| **Edit modal bug** | Toggle clicks must not collapse body / inflate footer. |

### Phase 10 — Bugs & small UX polish

- [x] **Edit modal toggle bug** — clicking owned / RU / other toggles shrinks modal body; Save/Cancel footer steals vertical space. Fix layout (stable body height, scroll inside body, sticky footer without flex collapse).
- [x] **Search bar:** placeholder `Search` (capital S) + search icon on the left inside input.
- [x] **Screenshot viewer:** zone cursors — left `←`, right `→`, center `✕` (or cross); semi-transparent dark pill behind `5/6` counter text.
- [x] **GFN badge on thumbnail:** semi-transparent dark background pill so badge stays readable on bright headers.

### Phase 11 — Search & filters (v2)

**Current (v1):** filters + search scoped to **active sidebar lifecycle tab** only.

**Target (v2):**

- [x] **Global search:** any non-empty search text queries **all games** in the library — **sidebar tab ignored** until search is cleared.
- [x] **Lifecycle filter chips** in expanded filter panel: Active / Replayable / Waiting for updates / Finished / Banned (multi-select; combines with other filters).
- [x] **GeForce NOW** toggle — same control style as “On sale only”; match `game.id` ∈ `gfnCatalog.steamAppIds`.
- [x] **Update available** toggle — `hasUpdateSinceState === true`.
- [x] Keep: dev status, ownership, Steam tags, on sale.

**Deferred:** “Ready to Play” preset (both own + active) — use ownership + lifecycle chips instead.

### Phase 12 — Finished rating (1–5 stars)

- [x] Schema: `finishedRating: null | 1 | 2 | 3 | 4 | 5` (meaningful when `libraryState === 'finished'`; clear when leaving Finished).
- [x] **GameEditModal:** star picker row.
- [x] **LifecycleModal:** optional star picker when user selects **Finished** (can skip without blocking).
- [x] **GameCard:** show rating on finished games (compact stars near title or lifecycle badge).

### Phase 13 — Dynamic background

- [x] Rotating full-viewport background using **existing Steam `thumbnail` URLs** on each game doc (no separate download service).
- [x] Pool: **top 5 games by Total Hype** from full library; **exclude `banned`**; same pool on **every sidebar tab** (not tied to Active tab).
- [x] Crossfade ~60s; dark overlay keeps UI readable.
- [x] **Disable via redeploy only:** env `VITE_ENABLE_DYNAMIC_BG=false` → rebuild + deploy (no in-app toggle). **Default: `true` (on).**

### Phase 14 — Browser tab title & app icon *(was Phase 8 — still open)*

- [x] **`index.html` `<title>`:** `Nen? Co-op Tracker` (replace `vite-temp`).
- [x] **Favicon / PWA icon:** replace `public/favicon.svg` (and link tags if needed) with Nen? branded mint/dark icon.

### Phase 15 — One-time bulk import (~50 games)

- [x] Script `scripts/import-games.mjs` (run locally once, **no UI button**).
- [x] Reads JSON prepared by user; calls same scrape path as `addGameFromSteam`; skips duplicates; logs errors.
- [x] Confirm before run: Gemini RU vetting **only for games imported with `libraryState: 'active'`** (or default active); skip vetting for other lifecycle states.

**JSON format** (see [Bulk import notes](#bulk-import-notes) below).

### Phase 16 — Ops & optional follow-ups

- [ ] **Deploy** Firebase: functions (`addGameFromSteam`, `syncGfnCatalog`, `refreshLibraryVersions`), firestore rules, hosting.
- [ ] Edit modal: “Refresh from Steam” single-game action (optional).
- [ ] Mobile pass: tooltips on touch, grid, modals, sidebar (optional).
- [ ] JSON **export** of library (optional backup).
- [ ] Wishlist scheduled sync (optional; needs Steam API key + Steam IDs + public profiles).
- [ ] Co-op warning on add (optional).
- [ ] Archive passcode for Banned tab (optional; two trusted users).
- [ ] Hosting CI documented or scripted (optional).
- [ ] Move nicknames to Firestore config (optional; env works today).

**Explicitly dropped / low value:**

- ~~Re-run GFN on version refresh~~ — GFN catalog is global; badge reads catalog at render time.
- ~~News feed UI~~ — replaced by update badges.

---

## Reference notes

### GFN sync — does it cover games not in our library?

**Yes.** `syncGfnCatalog` downloads the **full GeForce NOW Steam catalog** (~2000 app IDs via GraphQL) into Firestore `config/default.gfnCatalog.steamAppIds`. It is **not** limited to games already in your library.

When you **Add Game** later, the GFN badge checks that global list client-side — **no re-sync required** for each new game (re-sync weekly or manually only to refresh the catalog itself).

### Bulk import notes

**What is `steamInput`?** Same value you paste in **+ Add Game**: a Steam store URL or raw App ID. Examples:

```json
[
  "https://store.steampowered.com/app/105600/Terraria/",
  "570",
  {
    "steamInput": "1145360",
    "libraryState": "active",
    "owned": { "user0": true, "user1": false },
    "userNotes": { "user0": "want to try co-op", "user1": "" }
  }
]
```

Strings = URL or App ID only (defaults for everything else). Objects = optional field overrides after scrape.

---

## Done (summary)

- [x] React + Vite SPA, Firebase Auth (User 0 / User 1), Firestore, Total Hype formula + overrides
- [x] Lifecycle system (5 states, modal, sidebar tabs, update badge, version scheduler)
- [x] Add Game + duplicate guard + Steam caching + `steamTags` (filters only)
- [x] GFN GraphQL catalog sync + badge from Firestore catalog
- [x] Error reporting (`reportError`, `ErrorBanner`)
- [x] Full edit modal + per-user notes + manual RU flag
- [x] Phase 9 UI: sidebar controls (no top bar), mint palette, card polish, fullscreen screenshots, edit toggles, collapsible search
- [x] Firestore config path fix: `artifacts/{appId}/public/data/config/default`

---

## Lifecycle system ✅

All schema + UI + background version tracker items complete. See git history / Phase 7 below for detail.

| State | Meaning |
|-------|---------|
| **active** | In rotation — default for new imports |
| **replayable** | Worth playing again without needing new content |
| **waiting_for_updates** | Done with current content; notify when version/content changes |
| **finished** | Completed — optional 1–5 star rating (`finishedRating`) |
| **banned** | Ignored (RU devs or any reason) |

---

## Search & filtering ✅ (v1 — Phase 9)

- [x] Collapsible filter bar; name, Steam tags, dev status, ownership, on sale
- [x] Scoped to **current sidebar lifecycle tab**

**v2 complete:** Phase 11 (global search, lifecycle chips, GFN / update toggles).

---

## Card UX ✅

- [x] SteamDB, owned icons, hide price when both own, GFN badge, footer actions, no tags on cards
- [x] Sidebar layout (was listed as deferred — **done in Phase 9**)

---

## Add Game & Steam data ✅

- [x] Duplicate alert, caching, steamTags on scrape
- [ ] Deferred: wishlist sync, co-op warning on add, manual refresh callable

---

## Total Hype ✅

Formula + RU / finished / banned overrides — do not change coefficients without approval.

---

## Infrastructure

- [x] Functions region `europe-west1`, config doc for `gfnCatalog`
- [ ] **Deploy** (Phase 16)

---

## Explicitly out of scope

- News feed UI
- Custom user lifecycle tags (use `stateMeta.note` + `userNotes` instead)
- Client-side Steam scraping

---

## Completed phase log (archive)

<details>
<summary>Phase 7 — GFN catalog, errors, card polish, full edit</summary>

- [x] GFN GraphQL sync (`NP-WAW-01`), atomic catalog writes, Sync GeForce + weekly schedule
- [x] Error reporting wired
- [x] Card footer, edit modal, per-user notes
- [ ] Follow-up: refresh from Steam in edit; mobile pass on edit/footer

</details>

<details>
<summary>Phase 9 — UI overhaul</summary>

- [x] Layout + mint palette + sidebar
- [x] GameCard polish (GFN position, RU by title, owned icons, hover)
- [x] Fullscreen screenshots
- [x] Edit toggles
- [x] Collapsible search

</details>

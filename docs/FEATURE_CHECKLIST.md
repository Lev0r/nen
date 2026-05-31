# Feature Checklist

**Last updated:** 2026-05-31  
Track implemented, pending, deferred, and dropped features. Update when shipping.

**Legend:** ✅ Done · 🔄 In progress / partial · ⏳ Pending ops · 📋 Planned · 🚫 Dropped · ⏸ Deferred

---

## Core platform

| Feature | Status | Notes |
| :--- | :---: | :--- |
| React + Vite SPA | ✅ | |
| Firebase Auth (Google, 2 users) | ✅ | [auth-and-access.md](./features/auth-and-access.md) |
| Firestore real-time games subscription | ✅ | `useGames` in `db.js` |
| Firestore security rules | ✅ | Config write server-only |
| Cloud Functions europe-west1 | ✅ | [OPS.md](./OPS.md) |
| Firebase Hosting | ✅ | `dist/` after `npm run build` |

---

## Game library & schema

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Schema v2 nested Steam objects | ✅ | No v1 compat |
| Add game from Steam URL/App ID | ✅ | Duplicate guard |
| Game edit modal (full metadata) | ✅ | |
| Steam tags on scrape | ✅ | Genres + co-op categories |
| Co-op specs (online/split/cross) | ✅ | From Steam category IDs |
| Screenshots modal | ✅ | |
| Per-user notes + lifecycle notes | ✅ | |
| Bulk import script | ✅ | Real prod import ⏳ |
| Library JSON export | ⏸ | P1 deferred |

---

## Lifecycle & ownership

| Feature | Status | Notes |
| :--- | :---: | :--- |
| 5 lifecycle states + sidebar tabs | ✅ | |
| **TBA games — separate sub-tab under Active** | 📋 | **User request** — exclude TBA from default Active tab; reduce noise |
| Lifecycle modal + update badge | ✅ | |
| `hasUpdateSinceState` from sync | ✅ | |
| Finished rating 1–5 stars | ✅ | |
| Ownership quick toggle on card | ✅ | |
| Banned tab passcode | ⏸ | Deferred |

---

## Total Hype

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Formula (tier × ownership × status × reviews × critics) | ✅ | |
| Overrides: RU / finished / banned → 0 | ✅ | |
| Hype ring + hover breakdown | ✅ | |
| Per-user tier picker (DRG theme) | ✅ | |
| MetacriticFactor + ITAD fallback | ✅ | |
| Sort library by Total Hype | ✅ | Client-side compute |
| Dynamic BG from top 5 hype | ✅ | Screenshots, env gate |
| **Card visibility vs dynamic BG** | 📋 | **User request** — reduce BG noise; darken unhovered thumbnails |

---

## Steam sync & enrichment

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Steam scrape (UA region, UAH) | ✅ | |
| Scheduled 6h library sync | ✅ | Gated per game/lifecycle |
| Manual "Load meta info" | ✅ | Maintenance modal |
| HLTB playtime | ✅ | Fragile unofficial API |
| ITAD critics + historical low | ✅ | Needs `ITAD_API_KEY` |
| GFN catalog sync + badge | ✅ | Weekly + manual |
| Player stats (official API, 28 samples) | ✅ | Skip TBA/banned |
| Refresh single game from Steam | 📋 | P1 — not built |
| **Steam wishlist sync** (new games) | 📋 | **User request** — Web API key + public profiles |
| **Steam library sync** (ownership) | 📋 | **User request** — reconcile `owned.user0/user1` from Steam libraries |
| "Ready to Play" filter preset | ⏸ | Use chips instead |

---

## RU developer vetting

| Feature | Status | Notes |
| :--- | :---: | :--- |
| NE GRAI publisher list | ✅ | ~3800 names |
| Curator PlayUA (42985013) | ✅ | Flagged rec types only |
| Curator Avoid RU (45452241) | ✅ | Recommended = clearance |
| Developer cache (`devBgCheck.developers`) | ✅ | |
| Weekly source sync to Firestore | ✅ | Callable exists |
| Game-level `aggregateGameVetting` | ✅ | App ID + dev names |
| RU filter toggle | ✅ | |
| Manual "Run dev check" | ✅ | |
| Manual RU toggle per game | ✅ | Does not clear cache |
| Bulk `revet-ru-games.mjs` | ✅ | CLI only |
| Curator rec type parsing | ✅ | Commit 9e3f1fd |
| **Sich Ukrainian Spirit sources** | 📋 | **User request** — group + 5 curators + child groups |
| **Maintenance: dev BG source controls** | 📋 | **User request** — sync button, freshness, counts, bulk re-vet |
| Gemini vetting | 🚫 | Removed 2026-05-31 |
| OpenCorporates | 🚫 | Removed |

### Sich RU source (planned detail)

| Item | Status |
| :--- | :---: |
| Curators 37941500, 44677918, 45525669, 45830587, 45985173 | 📋 |
| Group sich-ukrainian-spirit + sich_ua2–5 | 📋 | Prefer curator API over group scrape |
| Weekly sync + bundled JSON | 📋 | Same pipeline as PlayUA/Avoid RU |
| Post-add: deploy → syncDevSources → revet | ⏳ | Ops |

---

## Filters & search

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Text search (game name) | ✅ | |
| Lifecycle / tag / status / ownership filters | ✅ | |
| Sale / GFN / update / RU toggles | ✅ | |
| Global scope when any filter active | ✅ | |
| Tab click resets filters | ✅ | |
| Clear filters in header | ✅ | |
| **Remove co-op tags from filter UI** | 📋 | **User request** |
| **Co-op warning on add game** | 📋 | **User request** — warn if no co-op categories 9/38/39/48 |

---

## UI & maintenance

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Mint glassmorphism design system | ✅ | |
| Sidebar layout | ✅ | |
| Maintenance modal + error log | ✅ | |
| Error acknowledge dot | ✅ | |
| **Errors panel — group by source/severity** | 📋 | **User request** — richer detail per error |
| Mobile UX pass | 📋 | P1 |
| News feed UI | 🚫 | Dropped |

---

## Ops & deployment

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Deploy runbook | ✅ | [OPS.md](./OPS.md) |
| Env var documentation | ✅ | |
| Production smoke test checklist | ⏳ | User-driven |
| **Test & polish 2026-05-31 release** | 📋 | **User request** — maintenance syncs, RU flow, notifications |
| **Local Cloud Functions testing** | 📋 | **User request** — emulator workflow documented + validated |
| Real import of 147 games | ⏳ | `docs/all games.json` ready |
| Post-deploy RU source refresh | ⏳ | syncDevSources + revet |
| CI/CD pipeline | ⏸ | Deferred |

---

## Session log — 2026-05-31 (shipped)

- Lists-only RU vetting (Gemini removed)
- Maintenance modal (Load meta, GFN, errors)
- RU filter + manual Run dev check
- Import fixes + revet script
- Curator recommended vs flagged parsing
- Client sync timeout 540s; useGames id fix

---

## Smoke test checklist (before/after import)

- [ ] Sign in as both allowed users
- [ ] Add Game → scrape + dev check
- [ ] Maintenance → Load meta info
- [ ] RU filter + Run dev check in edit modal
- [ ] Lifecycle tabs + filter reset on tab change
- [ ] Global filters (e.g. Banned from Active tab)
- [ ] Sync GFN
- [ ] Dynamic background rotating
- [ ] Edit modal scrollable; hype picker readable
- [ ] TBA games excluded from default Active tab (when implemented)
- [ ] Errors panel grouped by source/severity (when implemented)
- [ ] Dev BG source controls in Maintenance (when implemented)
- [ ] Wishlist / library ownership sync (when implemented)

---

## Agent maintenance

When completing work:

1. Update status in this file
2. Add decision to [DECISIONS.md](./DECISIONS.md) if non-obvious
3. Update relevant [features/](./features/) doc
4. Add debt to [CODE_IMPROVEMENTS.md](./CODE_IMPROVEMENTS.md) if found

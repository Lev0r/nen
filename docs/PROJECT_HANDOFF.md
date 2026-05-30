# Nen? Co-op Gaming Tracker — Project Handoff

**Last updated:** 2026-05-30  
**Repo:** https://github.com/Lev0r/nen  
**Firebase project:** `nen-tracker`  
**Latest commit (at handoff):** `1dfb62c` — Cloud Functions, Total Hype UX, Steam UAH integration

This document is for the **next developer or AI agent** continuing work without prior chat context. Read this first, then the linked docs.

> **Progress tracker:** Use **[Implementation Steps.md](./Implementation%20Steps.md)** as the go-to checklist for what is done and what remains.

---

## 1. Where to look (documentation map)

| Document | Purpose |
|----------|---------|
| **[Implementation Steps.md](./Implementation%20Steps.md)** | **Progress checklist** — what’s done, what’s left to call the project complete |
| **[manifest_of_understanding.md](./manifest_of_understanding.md)** | Single source of truth: schema, Total Hype formula, feature specs (F1–F6), UI rules |
| **[ai_rules.md](./ai_rules.md)** | Constraints: no Me/Friend hardcoding, don’t change Total Hype formula without approval, keep it simple |
| **[firebase_setup_guide.md](./firebase_setup_guide.md)** | Blaze plan, deploy hosting/rules/functions, `functions/.env`, Gemini key |
| **This file** | Code map, ops notes, session context |

---

## 2. Repository layout (code map)

```
nen/
├── docs/                    # All project documentation
├── functions/               # Firebase Cloud Functions (Node 20, europe-west1)
│   ├── index.js             # Callable: addGameFromSteam
│   ├── steam.js             # Steam appdetails + reviews (cc=ua, UAH)
│   ├── gemini.js            # RU developer vetting (multi-model fallback)
│   ├── package.json
│   └── .env                 # GEMINI_API_KEY, ALLOWED_EMAIL_0/1 (NOT in git)
├── src/
│   ├── contexts/AuthContext.jsx
│   ├── components/
│   │   ├── LoginGate.jsx
│   │   ├── DashboardShell.jsx   # Sidebar views + grid
│   │   ├── GameCard.jsx         # Card UX, owned/hype, RU alert
│   │   ├── AddGameModal.jsx     # Calls Cloud Function
│   │   ├── FloatingTooltip.jsx  # Portal tooltips (above header)
│   │   ├── HypePicker.jsx
│   │   └── ScreenshotsModal.jsx
│   ├── services/
│   │   ├── db.js                # useGames, updateGame
│   │   └── cloudFunctions.js    # addGameFromSteam wrapper
│   ├── utils/
│   │   ├── hypeScore.js         # Total Hype formula + breakdown
│   │   ├── userConfig.js        # VITE_USER0/1_NICKNAME
│   │   └── gameHelpers.js       # isRuDeveloperAlert()
│   ├── firebase.js              # Auth, Firestore, Functions (europe-west1)
│   └── index.css                # Glassmorphism + card styles
├── firestore.rules
├── firebase.json
└── .env.local                   # VITE_* (NOT in git; see .env.example pattern)
```

### Firestore path (critical)

```
artifacts/default_app/public/data/games/{steamAppId}
```

Console navigation: `artifacts` → `default_app` → `public` → `data` → `games`.

### Environment variables

**Frontend (`.env.local`):**

- `VITE_FIREBASE_*` — from Firebase Console web app config  
- `VITE_ALLOWED_EMAIL_0`, `VITE_ALLOWED_EMAIL_1`  
- `VITE_USER0_NICKNAME`, `VITE_USER1_NICKNAME`  
- `VITE_FIREBASE_FUNCTIONS_REGION=europe-west1`  
- Optional: `VITE_USE_FUNCTIONS_EMULATOR=true` for local emulator  

**Functions (`functions/.env`, loaded on deploy):**

- `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/apikey)  
- `ALLOWED_EMAIL_0`, `ALLOWED_EMAIL_1` — must match frontend + `firestore.rules`

> Note: Root `.env.example` may be gitignored by `.env.*` rule; use `functions/.env.example` as template.

---

## 3. What is done (as of 2026-05-29)

### Phase 1 — Foundation ✅

- React + Vite SPA  
- Firebase Auth (Google), email lockout → User 0 / User 1  
- Firestore games collection  
- Firebase Hosting + rules config  

### Phase 2 — Auth & security ✅

- `AuthContext`, `LoginGate`  
- Firestore rules (emails must stay in sync with env)  

### Phase 3 — UI shell & design ✅

- Glassmorphism `index.css`, dark theme  
- Dashboard: sidebar + top bar + game grid  
- Mobile layout basics (sidebar horizontal on small screens)  

### Phase 4 — Data & cards ✅

- Real-time `useGames()` + sort by **Total Hype** desc  
- `updateGame()` for owned + hype tier  
- **No seed button** (removed)  

### Phase 5 — Cloud Functions ✅ (deployed)

- **`addGameFromSteam`** (callable, `europe-west1`):  
  - Scrapes Steam (`cc=ua`, English, UAH prices, `discountPercent`, reviews, overview, screenshots, coop specs)  
  - Writes game doc to Firestore  
  - Gemini vetting → `ruDeveloperAlert` / `ruDeveloperExplanation`  
- Frontend **+ Add Game** wired via `cloudFunctions.js`  
- Requires **Blaze** plan; secrets via `functions/.env` (not Secret Manager)  

### Card / formula UX ✅

- **Total Hype** ring (integer, no `%`) = full formula (tiers + ownership + status + Steam reviews)  
- Personal hype: DRG tiers (`worthless_crystal` / `morkite_found` / `we_rich`) per user  
- Owned: 3-stage icon, click toggle, colored tooltip  
- Hype: portal tooltip (fixed position), click → tier picker  
- Steam overview on card; review % badge; sale shows original + price + `-X%`  
- RU alert: red border, **RU** badge, explanation text  
- Screenshots modal; thumbnail/title → Steam store  
- Nicknames from env (no Me/Friend)  

### Design decisions (2026-05-30)

- **Lifecycle replaces** `finished`, `abandoned`, and custom user `tags`. Optional `stateMeta.note` per state.
- **No news feed** — version/update badges only for `waiting_for_updates` (and weekly checks for `finished`).
- **Mute updates:** re-assign same lifecycle state to rebaseline version snapshot.
- **Total Hype = 0** for `finished` and `banned` lifecycle states (in addition to RU alert).
- **Ready to Play** sidebar tab removed (may return as a search preset later).
- **`steamTags`** from Steam scrape used for search/filter only (not lifecycle).

### Phase 6 — Lifecycle, cards, search (2026-05-30) ✅

- **Lifecycle:** `libraryState`, modal, 5 sidebar tabs, update badge UI, hype overrides, legacy fallback
- **Version tracker:** scheduled `refreshLibraryVersions` (daily / weekly for finished)
- **Card UX:** SteamDB link, owned icons (backpack/crystal/pickaxes), hide price when both own, GFN badge, screenshots on thumbnail
- **Steam data:** duplicate guard, `steamCache.js`, `steamTags`, `geforceNowReady` on import
- **Search:** filter bar (name, tags, status, ownership, on sale) within lifecycle tab

### Not done / deferred

See **[Implementation Steps.md](./Implementation%20Steps.md)** — remaining items are mostly **deploy**, **wishlist sync**, **layout/mobile polish**, **JSON export**, **hosting CI**.

---

## 4. Remaining work

All items tracked in **[Implementation Steps.md](./Implementation%20Steps.md)**. Former backlog sections (wishlist, news feed, etc.) are consolidated there with done/deferred status.

---

## 6. Total Hype formula (do not change casually)

Defined in `src/utils/hypeScore.js` and `manifest_of_understanding.md` F3.

```
Total Hype = TierBase × OwnershipFactor × StatusFactor × SteamOverviewFactor
```

- `ruDeveloperAlert === true` → **Total Hype = 0** (non-negotiable per ai_rules)  
- `libraryState === 'finished'` or `'banned'` → **Total Hype = 0**  
- Legacy `hype.user0/1` numeric fields still mapped to tiers if present in old docs  

---

## 7. Operations cheat sheet

```bash
# Local dev
npm run dev

# Deploy functions (after editing functions/)
cd functions && npm install && cd ..
firebase deploy --only functions

# Deploy rules / hosting
firebase deploy --only firestore:rules
npm run build && firebase deploy --only hosting

# Logs
firebase functions:log --only addGameFromSteam
```

**Common issues:**

| Symptom | Fix |
|---------|-----|
| Empty Firestore but UI shows data | Wrong Firebase project in `.env.local` |
| Add Game fails | Blaze + `functions/.env` + redeploy functions |
| RU flag never appears | Check Gemini key + function logs; re-add game |
| No review % | Re-add game (old docs lack `steamReviewPercent`) |
| Permission denied | Align emails in `.env.local`, `functions/.env`, `firestore.rules` |

---

## 8. Next steps

Work through **[Implementation Steps.md](./Implementation%20Steps.md)** in order of priority. Mark items `[x]` as they ship.

---

## 9. Contacts / conventions

- **App name:** Nen? Co-op Gaming Tracker  
- **Users:** Always User 0 / User 1 in code; display via `getNickname()` / `getUserLabel()`  
- **Currency:** UAH via Steam `cc=ua`  
- **Functions region:** `europe-west1`  
- **Commits:** User prefers explicit request before git commit  

---

*End of handoff. Update [Implementation Steps.md](./Implementation%20Steps.md) when completing features.*

---

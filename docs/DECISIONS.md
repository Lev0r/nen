# Key Decisions Log

Chronological archive of product and technical decisions. Update when shipping material changes.

---

## Architecture

| Decision | Reason | Date |
| :--- | :--- | :--- |
| Firebase-only stack (Auth, Firestore, Hosting, Functions) | Two-user app; zero-ops hosting | 2026 |
| Functions region `europe-west1` | Latency + project standard | 2026 |
| Client never calls Steam directly | CORS, caching, secrets | 2026 |
| Schema v2 nested Steam objects | Clear sync cadences per field group | 2026 |
| No v1 flat-field backward compat | Migrate/re-import instead | 2026 |
| `config/default` doc id required | Firestore even segment count | 2026 |

## Users & UI

| Decision | Reason | Date |
| :--- | :--- | :--- |
| User 0 / User 1 abstraction | No hardcoded names | 2026 |
| Sidebar layout (no top header) | Phase 9 redesign | 2026 |
| Mint palette, no blue | User preference | 2026 |
| Browser title `Nen?` only | User preference | 2026 |
| Dynamic BG from screenshots, top 5 hype | Thumbnails too blurry | 2026 |
| News feed UI dropped | `hasUpdateSinceState` badge instead | 2026 |

## Filters & library

| Decision | Reason | Date |
| :--- | :--- | :--- |
| Filters active → search full library | Cross-tab queries (e.g. Banned from Active tab) | 2026 |
| Tab click resets filters | Avoid confusing combinations | 2026 |
| Tag list from entire library | All tags visible when filtering | 2026 |
| "Ready to Play" preset deferred | Use ownership + lifecycle chips | 2026 |

## Sync & data

| Decision | Reason | Date |
| :--- | :--- | :--- |
| Single 6h `syncLibrarySteam` job | Replaced separate version refresh | 2026 |
| Banned = skip all sync | Archive state | 2026 |
| TBA = no player stats | Meaningless counts | 2026 |
| Official Steam player API only | No third-party player estimates | 2026 |
| GFN full catalog in config | Badge without per-game re-sync | 2026 |
| GFN re-sync on version refresh dropped | Catalog is global | 2026 |
| Steam `cc=ua` | UAH prices, user locale | 2026 |
| Functions secrets in `functions/.env` | Project convention, not Secret Manager | 2026 |

## RU vetting

| Decision | Reason | Date |
| :--- | :--- | :--- |
| Curated lists only (NE GRAI + curators) | Citable, deterministic | 2026-05 |
| Gemini removed entirely | Hallucination risk; redundant with lists | 2026-05-31 |
| OpenCorporates removed | User chose not to use | 2026-05-31 |
| No DB wipe after Gemini removal | Game docs + cache still valid | 2026-05-31 |
| Curator `recommended` = clearance | Avoid false positives from Avoid RU list | 2026-05-31 |
| NE GRAI overrides curator clearance | Hard publisher list | 2026-05-31 |
| Manual RU toggle is per-game only | Does not change dev cache | 2026-05-31 |

## Workflow

| Decision | Reason | Date |
| :--- | :--- | :--- |
| Bulk import script-only, no UI | One-time ~147 game migration | 2026 |
| Commit/push only when user asks | User preference | 2026 |
| Orchestrator + subagents for large tasks | User preference | 2026 |

## Explicitly dropped

- Gemini / OpenCorporates vetting
- In-app dynamic BG toggle
- Re-run GFN on every version refresh

## Under discussion (2026-05-31)

| Proposal | Notes |
| :--- | :--- |
| Sich Ukrainian Spirit curators as RU source | 5 curator IDs; prefer curator API over group scrape — see [ru-developer-vetting.md](./features/ru-developer-vetting.md) |
| Remove co-op tags from filters | App is co-op-only by intent |
| Co-op warning on add | Non-blocking confirm if no co-op Steam categories |

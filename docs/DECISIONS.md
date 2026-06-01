# Key Decisions Log

Chronological archive of product and technical decisions. Update when shipping material changes.

**Last updated:** 2026-06-02

---

## Architecture

| Decision | Reason | Date |
| :--- | :--- | :--- |
| Firebase-only stack (Auth, Firestore, Hosting, Functions) | Two-user app; zero-ops hosting | 2026 |
| Functions region `europe-west1` | Latency + project standard | 2026 |
| Client never calls Steam directly | CORS, caching, secrets | 2026 |
| Schema v2 nested Steam objects | Clear sync cadences per field group | 2026 |
| No v1 flat-field backward compat | Migrate/re-import instead | 2026 |
| `config/default` doc id (legacy) | Firestore even segment count; **deprecated** — use split v3 docs | 2026 |
| Config schema v3 | Split monolithic `config/default`; centralize errors in `maintenance-errors` | 2026-06 |

## Users & UI

| Decision | Reason | Date |
| :--- | :--- | :--- |
| User 0 / User 1 abstraction | No hardcoded names | 2026 |
| Sidebar layout (no top header) | Phase 9 redesign | 2026 |
| Mint palette, no blue | User preference; **2026-06-02:** softer sage `#4cc9a0`, warm graphite glass |
| Dynamic BG wave mesh | Pure CSS blurred layers + diagonal sheen; complements accent | 2026-06-02 |
| Browser title `Nen?` only | User preference | 2026 |
| Dynamic BG animated gradient | Replaced screenshot slideshow (too noisy/blurry) | 2026-06-01 |
| Dynamic BG lavender + mint palette | Lighter slate base; complements mint accent | 2026-06-02 |
| Contextual lifecycle badge on cards | Hide on lifecycle tabs; show when filtering full library | 2026-06-02 |
| Card badge dimensions unified | 6px radius, shared height across status/reviews/GFN/lifecycle | 2026-06-02 |
| News feed UI dropped | `hasUpdateSinceState` badge instead | 2026 |
| **Clash Display + General Sans fonts** | Card redesign; cinematic titles + clean UI body | 2026-06-01 |
| **Card visibility pass** | Dim dynamic BG + unhovered thumbnails for readability | 2026-06-01 |

## Filters & library

| Decision | Reason | Date |
| :--- | :--- | :--- |
| Filters active → search full library | Cross-tab queries (e.g. Banned from Active tab) | 2026 |
| Tab click resets filters | Avoid confusing combinations | 2026 |
| Tag list from entire library | All tags visible when filtering | 2026 |
| "Ready to Play" preset deferred | Use ownership + lifecycle chips | 2026 |
| **Remove co-op tags from filter UI** | Co-op-only library; tag chips add noise | 2026-06-01 |
| **TBA sub-tab under Active** | Default Active excludes TBA; reduces main-view noise | 2026-06-01 |

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
| **Two-phase add (`previewSteamGame` + co-op confirm)** | Preview scrape first; non-blocking co-op warning before persist | 2026-06-01 |

## RU vetting

| Decision | Reason | Date |
| :--- | :--- | :--- |
| Curated lists only (NE GRAI + curators) | Citable, deterministic | 2026-05 |
| Gemini removed entirely | Hallucination risk; redundant with lists | 2026-05-31 |
| OpenCorporates removed | User chose not to use | 2026-05-31 |
| No DB wipe after Gemini removal | Game docs + cache still valid | 2026-05-31 |
| Curator `recommended` = clearance | Avoid false positives from Avoid RU list | 2026-05-31 |
| NE GRAI overrides curator clearance | Hard publisher list | 2026-05-31 |
| **NE GRAI exact normalized match only** | Substring + suffix-stripped collisions flagged unrelated Western studios | 2026-06-01 |
| Manual RU toggle is per-game only | Does not change dev cache | 2026-05-31 |
| **Firestore-only runtime sources** | Single source of truth; bundled JSON is dev export only | 2026-06-01 |
| **Sich curators (5 IDs) via curator API** | Same pipeline as PlayUA/Avoid RU; not group scrape | 2026-06-01 |
| **Incremental curator sync** | Resumable weekly job; avoids re-fetching complete lists | 2026-06-01 |
| **Simplified RU alert messages** | Shorter NE GRAI text; curator links without app ID; dedupe app + dev curator hits | 2026-06-01 |

## Maintenance & errors

| Decision | Reason | Date |
| :--- | :--- | :--- |
| **Error severity taxonomy (error / warning / info)** | Scan-friendly Maintenance panel | 2026-06-01 |
| **Group errors by severity then source** | Collapse duplicates; show counts | 2026-06-01 |
| **Clear info + weekly purge** | Info-level noise auto-purged; user can clear manually | 2026-06-01 |
| Dev BG controls in Maintenance UI | syncDevSources + freshness + bulk re-vet without CLI | 2026-06-01 |

## Workflow

| Decision | Reason | Date |
| :--- | :--- | :--- |
| Bulk import script-only, no UI | One-time ~147 game migration | 2026 |
| Commit/push only when user asks | User preference | 2026 |
| Orchestrator + subagents for large tasks | User preference | 2026 |
| `--to-firestore` seed script | Push sources to Firestore without full functions deploy | 2026-06-01 |
| **Config schema v3** | Split monolithic config; errors on `maintenance-errors` | 2026-06-01 |
| **DEV_CLI handbook** | Single reference for all admin scripts | 2026-06-01 |

## Explicitly dropped

- Gemini / OpenCorporates vetting
- In-app dynamic BG toggle
- Re-run GFN on every version refresh

## Under discussion

| Proposal | Notes |
| :--- | :--- |
| Steam wishlist sync + library ownership sync | Needs Web API key — see [steam-sync-and-data.md](./features/steam-sync-and-data.md) |

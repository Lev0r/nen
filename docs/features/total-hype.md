# Total Hype

**Spec:** [`manifest_of_understanding.md`](../manifest_of_understanding.md) § F3  
**Related:** [Lifecycle](./lifecycle-and-ownership.md) · [RU vetting](./ru-developer-vetting.md) · [UI shell](./ui-shell-and-modals.md)

## Formula

```
Total Hype = round(TierBase × Ownership × Status × SteamReview × Metacritic)
```

Clamped 0–100. Computed client-side in `src/utils/hypeScore.js`; sorted in `src/services/db.js`.

### Personal tiers (per user)

| Key | UI label | Multiplier |
| :--- | :--- | :--- |
| `worthless_crystal` | Worthless Crystal | 0.5 |
| `morkite_found` | Morkite Found | 1.0 (default) |
| `we_rich` | We're Rich! | 1.5 |

`TierBase = ((eff0 + eff1) / 15) × 100`

### Other factors

| Factor | Values |
| :--- | :--- |
| Ownership | both 1.0 · one 0.5 · neither 0.25 |
| Status | released 1.0 · early_access 0.75 · tba 0.1 |
| SteamReview | `0.9 + (reviewPercent/100)×0.15` |
| Metacritic | `0.96 + (score/100)×0.08` — Steam Metacritic first, else ITAD critics |

### Overrides (score forced to 0)

- `ruDeveloperAlert === true`
- `libraryState === 'finished'`
- `libraryState === 'banned'`

## UI

- Hype ring on `GameCard` — click opens `HypePicker` (active user only)
- Hover tooltip — full breakdown with nicknames
- [Dynamic background](./ui-shell-and-modals.md) — top 5 non-banned by hype

## Not in formula

HLTB hours, GFN, player counts, sale state, recent review % (fetched but unused in math).

## Rules

Do not change coefficients without explicit user approval (`ai_rules.md`).

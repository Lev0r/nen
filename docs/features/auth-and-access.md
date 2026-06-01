# Auth & Access

**Spec:** [`manifest_of_understanding.md`](../manifest_of_understanding.md) § F1  
**Related:** [Lifecycle](./lifecycle-and-ownership.md) · [OPS](../OPS.md)

## Implemented

- Google OAuth via Firebase Auth (`src/contexts/AuthContext.jsx`, `src/firebase.js`)
- Allowlist: `VITE_ALLOWED_EMAIL_0` / `VITE_ALLOWED_EMAIL_1` → `userIndex` 0 or 1; others signed out immediately
- **Auth loading spinner** — `LoginGate` shows spinner during `AuthProvider` init (no blank flash)
- `LoginGate` wraps app; `DashboardShell` after auth
- Firestore rules (`firestore.rules`): read/write games + read config for two hardcoded emails; **config write denied** (server only)

## Constraints

- Exactly two users; no roles beyond email → index
- Both users have identical write access to all game fields
- Nicknames from env (`src/utils/userConfig.js`), never "Me" / "Friend"

## See also

- [UI shell](./ui-shell-and-modals.md) — sidebar shows current user nickname

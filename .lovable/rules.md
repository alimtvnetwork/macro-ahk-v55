# Project Prohibitions

Consolidated prohibitions. Do not violate. Do not "improve" or re-propose.

## Storage & backend
- No Supabase (SDK, auth, tokens, storage keys). Storage = sql.js + OPFS + `chrome.storage.local` only.
- No `localStorage` for roles or admin checks.
- No `localStorage` in MV3 background code; use `chrome.storage.local`.
- No remote sql.js / wasm assets. Bundle `public/assets/sql-wasm.wasm`.
- No PascalCase rewrite of existing `chrome.storage.local` records.
- Never bind `undefined` to SQLite.
- Unified billing (Plan 10) for all workspaces is REJECTED.

## Reliability
- No recursive retry / exponential backoff. Sequential fail-fast only.
- No CI build notifications.
- Read-only folders: `skipped/`, `.release/`.

## Type safety & code quality
- No `unknown` outside `CaughtError`.
- No bare `log()` for errors. Use `RiseupAsiaMacroExt.Logger.error()`.
- No swallowed errors. Every `catch` logs.
- HARD ERROR logs must include `Path`, `Missing`, `Reason`, `ReasonDetail`, `SelectorAttempts`, `VariableContext`.
- Zero ESLint warnings/errors project-wide.
- Banned identifiers: `arr`, `cb`, `fn`, `el`, `msg`, `ctx`, `obj`, `val`.
- Function size cap: 15 lines.

## UI & Theme
- Dark-only theme. No light mode, no toggle.
- No hardcoded color classes (`text-white`, `bg-black`). Use semantic tokens.
- No `<noscript><img></noscript>` inside `<head>`.
- Em dashes (-) are BANNED in all output. Use commas, colons, or parentheses.

## Timezone
- No hardcoded timezone. UI uses `Intl.DateTimeFormat().resolvedOptions().timeZone`. Store UTC ISO-8601.

## Versioning
- GIT TAG `v*` is the sole source of truth.
- No version-specific workflow tests or asset manifest checkers.

## readme.txt (Non-negotiable)
- Never auto-write any time/clock/git-stamp content.
- Never include time / timestamp / clock values.
- Prohibited from action items or reminders.

## Prompts
- No per-invocation prompt archive files under `.lovable/prompts/`.
- Mirrors in `.lovable/prompts/` must be byte-identical to `standalone-scripts/prompts/`.

## References
- `.lovable/memory/constraints/`
- `.lovable/coding-guidelines.md`

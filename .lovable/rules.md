# .lovable/ Hard Rules

Consolidated prohibitions. Source: former `strictly-avoid.md` + memory constraints. Do not violate. Do not "improve" or re-propose.

## Storage & backend

- No Supabase (SDK, auth, tokens, storage keys). Storage = sql.js + OPFS + `chrome.storage.local` only.
- No `localStorage` for roles or admin checks (privilege escalation vector).
- No `localStorage` in MV3 background code; use `chrome.storage.local` wrapper or SQLite managers.
- No remote sql.js / wasm assets. Bundle `public/assets/sql-wasm.wasm`; resolve via `chrome.runtime.getURL`.
- No direct OPFS / DB-blob calls outside `src/background/db-persistence.ts`.
- IndexedDB injection cache is derived, never canonical.
- No PascalCase rewrite of existing `chrome.storage.local` records.
- Never bind `undefined` to SQLite; use `bindOpt()` / `bindReq()` from `handler-guards.ts`.

## Reliability

- No recursive retry / exponential backoff. Sequential fail-fast only.
- No CI build notifications (email or otherwise).
- Read-only folders: `skipped/`, `.release/`.

## Type safety & code quality

- No `unknown` outside `CaughtError`. Function params use designed types.
- No bare `log()` for errors. Use `RiseupAsiaMacroExt.Logger.error()` or `NamespaceLogger.error()`.
- No swallowed errors. Every `catch` logs via namespace logger.
- HARD ERROR logs must include `Path`, `Missing`, `Reason`, `ReasonDetail`, `SelectorAttempts`, `VariableContext`. Otherwise = Code Red violation.
- Zero ESLint warnings/errors project-wide.

## Timezone

- No hardcoded timezone anywhere (code, spec, audit, plan, readme, comment, log, memory). UI uses `Intl.DateTimeFormat().resolvedOptions().timeZone`. Store UTC ISO-8601.

## UI

- Dark-only theme. No light mode, no toggle.
- No hardcoded color classes (`text-white`, `bg-black`, `bg-[#...]`). Use semantic tokens (HSL) from `index.css` + `tailwind.config.ts`.
- No `<noscript><img></noscript>` inside `<head>`. Pixel fallbacks live in `<body>`.

## Versioning

- Release version changes are limited to `version.json`; optional publish action is a matching `v*` Git tag. Do not add CI/CD stale-version, propagation, readiness, or asset-manifest checks.

## `readme.txt` (sequenced, non-negotiable, read-once-retain-forever)

1. Never create, regenerate, or "update" `readme.txt` programmatically. Manual milestone marker; only the user writes it during a version bump.
2. Never include time / timestamp / clock / 12h or 24h value. No `HH:MM`, no AM/PM, no ISO time, no relative time, no zone/UTC.
3. Never propose date utilities, formatters, or `Intl.DateTimeFormat` wrappers for `readme.txt`.
4. Never suggest git commit time / last-update / build / deploy / last-modified stamps in `readme.txt`.
5. Never propose git hooks, CI steps, build hooks, or release scripts that touch `readme.txt`.
6. Never ask the user to choose a `readme.txt` format. Format is fixed.
7. Honor explicit one-shot user writes exactly, then re-apply rules 1-6 + 8 immediately. One-shot never overrides rules 2/4/8.
8. No stamp anywhere in `readme.txt` (body, header/footer, comment, sidecar, "somewhere in the readme").
9. Never surface `readme.txt` as an action item, next step, remaining task, or reminder. Invisible to AI's task surface.

## Prompts / archives

- No per-invocation prompt archive files under `.lovable/prompts/` (next N, plan N, proofread N). Only canonical mirrors updated when the prompt body itself changes.

## Deferred / forbidden workstreams

- P Store is deferred; never list or recommend.
- Phase 2c-storage v2 (PascalCase migration) is forbidden.

## References

- Full historical context: `.lovable/archive/2026-07-17/strictly-avoid.md` (superseded on 2026-07-17 as part of Plan-18).
- Memory: `mem://index.md` Core + `.lovable/memory/constraints/`.

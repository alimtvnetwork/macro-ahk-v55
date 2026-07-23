# Audit of error sites (step 1 deliverable)

Parent: 26-professional-diagnostic-errors-20-step
Status: completed
Created: 2026-07-19
Source scan: `rg -n "throw new Error\(|Logger\.error\(|toast(\.|\()error|console\.error|showToast\(.*error" standalone-scripts/macro-controller/src --glob '!**/__tests__/**'`

## Totals (production sources only, tests excluded)

- Total error sites: 151
- By kind:
  - `throw new Error(...)`: 68
  - `toast.error(...)` / `showToast(...error...)`: 74
  - `console.error(...)`: 8
  - `Logger.error(...)`: 1  ← proves the current namespace-logger contract is barely used; this is a root symptom
- Raw table: `./audit-raw.txt` (file:line:snippet, 151 rows)

## Root observation (one sentence)

Errors across the extension are emitted as ad-hoc `new Error(...)` throws and `toast.error(freeform string)` calls with zero unique code and almost no `Logger.error` structured logging, so identical messages ("HTTP <status>", "SdkNotReady", "marco.api...unavailable") appear from many files and no context object is captured for triage.

## Hotspots (top files needing migration)

| Sites | File | Notes |
|------|------|-------|
| 10 | `ws-members-mutations.ts` | Duplicated `HTTP <status>` and required-arg throws; no context object |
| 8  | `ui/chip-gear-menu.ts` | Repair action + gear routing; user-facing toasts |
| 7  | `ws-move.ts` | Post-move refresh failures |
| 7  | `ui/prompt-io-zip-reader.ts` | ZIP parse errors, generic messages |
| 7  | `credit-fetch.ts` | `SdkNotReady:` string prefix used as pseudo-code (not registry-backed) |
| 6  | `ui/prompt-editor.ts` | Plan/Next validation; user-facing |
| 6  | `ui/hot-reload-section.ts` | Dev tooling toasts |
| 6  | `remix-fetch.ts` | HTTP + SDK errors |
| 5  | `ws-context-menu.ts` | |
| 5  | `ui/prompt-io-sqlite-reader.ts` | |
| 5+ | see raw file for the rest | |

## Duplicate-message evidence (grep-visible)

- `throw new Error('HTTP ' + resp.status ...)` appears in: `ws-members-mutations.ts` (x3), `credit-fetch.ts` (x2), `remix-fetch.ts` (x2), `remix-bulk.ts`, `ws-adjacent.ts`, `gitsync/progress-probe.ts`, `rename-api.ts` — 11+ throw sites with the SAME message shape and no code.
- `throw new Error('SdkNotReady: ...')` appears in: `credit-fetch.ts` (x3), `loop-cycle-fallback.ts`, `ws-adjacent.ts` — 5 sites, pseudo-coded via string prefix (not enforced, not unique).
- `marco.api... is not available` / `unavailable` appears in: `ws-members-mutations.ts`, `ws-members-fetch.ts`, `remix-fetch.ts` (x2), `remix-bulk.ts`, `pro-zero/pro-zero-sdk-adapter.ts` — 6+ sites.

## Missing variables (categories)

Across the 151 sites the following context fields are almost never captured:
- HTTP throws: missing `{ url, method, wsId, projectId, requestId, bodyPreview }` (only status is included).
- SDK-not-ready throws: missing `{ readinessStage, elapsedMs, expectedApi }`.
- Prompt validation throws: missing `{ role, slug, ruleId, expected, actual, tokensFound }` (partially present in a few sites, inconsistent).
- User-facing `toast.error(...)`: 74/74 sites pass a bare string with no code and no context — nothing lands in the diagnostics ZIP.

## Slot allocation (feeds SS-02 taxonomy)

- `HTTP_E001..` — every `HTTP ' + status` throw (11+ callsites collapse into one code family, differentiated by `context.url` + `context.op`).
- `SDK_NOT_READY_E001..` — SDK-unavailable throws (5).
- `PROMPT_VALIDATE_E001..` — prompt-editor / prompt-utils / prompt-injection validation.
- `PROMPT_EDIT_E001..` — editor open/save/reset action failures.
- `PROMPT_IO_E001..` — import/export/zip/sqlite readers.
- `SEED_E001..` / `HEALTH_E001..` / `REPAIR_E001..` — seeding + health + repair.
- `HISTORY_E001..` — history panel slug resolution.
- `DB_E001..` — SQLite adapter errors.
- `WS_MEMBERS_E001..`, `WS_MOVE_E001..`, `WS_CONTEXT_E001..` — workspace ops.
- `REMIX_E001..`, `RENAME_E001..`, `GITSYNC_E001..`, `CREDIT_E001..`, `PROZERO_E001..`, `SETTINGS_E001..`, `SPLITTER_E001..`.

## Blocks / unblocks

- Blocks: steps 8–13 (per-area migrations), step 14 (CI uniqueness check needs the code registry seeded from these slots), step 15 (ESLint ban on bare `new Error`).
- Unblocks: step 2 (taxonomy) can now be finalized with real slot counts; step 3 (registry file scaffold) can list the areas above.

## Verification

- Raw scan reproducible with the single `rg` command above.
- Count re-checked: `wc -l audit-raw.txt` = 151.
- `Logger.error(` appears exactly 1x in production code → confirms structured-logging gap.

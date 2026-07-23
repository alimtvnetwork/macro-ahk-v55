
## Goal

Three tightly related fixes, all rooted in the rawSql v2 contract regression:

1. Add a **Diagnostics Export** that captures the rawSql method the bridge is using and the exact failing-contract shape for `PROMPT_LOAD_E001` and `SEED_RESEED_E001`.
2. Add an **end-to-end test** for loading Plan prompts at `stage=post-seed-list` with `seedAttempted=true` and `role=plan`.
3. Repair the **Next button** so clicking it does not surface `PROMPT_LOAD_E001` / `PROMPT_EDIT_E005`.

## Current state (verified this turn)

- `db/sql-bridge.ts` classifies SQL into SELECT / WRITE / ALTER buckets and caches the accepted method in a module-local `winning` map. It already exposes test hooks (`__resetWinning`, `__snapshotWinning`) but has no public read for production/UI code.
- `ui/seed-diagnostics-panel.ts` already offers a "Download E005 diagnostics ZIP" button. It bundles `entries.json`, `toast-trace.json`, `seed-snapshot.json`, but does not include `PROMPT_LOAD_E001`, `SEED_RESEED_E001`, or the bridge-method state.
- `errors/error-codes.ts` defines `PROMPT_LOAD_E001` and `SEED_RESEED_E001` with structured context keys that already include `stage`, `role`, `seedAttempted`, `reason` (for load) and `force`, `reason` (for reseed) — we can key the export off those.
- `ui/next-inline-ui.ts` mounts the Next inline strip. Its click path resolves prompts via `getPromptsConfig()` → prompt-loader/prompt-db, which still hits the sql-bridge; when the WRITE bucket cache is poisoned by an earlier failure (auto-seed insert-or-ignore), subsequent Next clicks report `PROMPT_LOAD_E001`.

## Deliverables

### 1. Bridge introspection API

- In `db/sql-bridge.ts`, add a public `getSqlBridgeState()` returning `{ winning: Record<Bucket,string|null>, lastError: { bucket, method, message, at } | null, candidates: typeof CANDIDATES }`.
- Record `lastError` whenever every candidate in a bucket is rejected (contract error) so diagnostics can prove which methods the backend rejected in this session.
- Keep `__resetWinning` / `__snapshotWinning` for tests; new API wraps the same state.

### 2. Diagnostics export (widen the existing E005 ZIP)

- Rename the button in `ui/seed-diagnostics-panel.ts` to "⬇ Download prompt diagnostics ZIP" (test id stays `marco-download-e005-zip` to avoid churn) and extend the archive to include:
  - `sql-bridge.json` — output of `getSqlBridgeState()`.
  - `prompt-load-e001.json` — every `PROMPT_LOAD_E001` toast from the trace with full context (stage, role, roleLabel, seedAttempted, reason).
  - `seed-reseed-e001.json` — same for `SEED_RESEED_E001` (force, reason).
  - `contract.md` — one-page dump of the current rawSql v2 contract (methods allowed per bucket, and any observed rejections) so the user can paste it into a report.
- Add `PROMPT_LOAD_E001` / `SEED_RESEED_E001` sections (mirrors of the E005 section) to the panel so the same data is visible in-app.
- Extend `RELEVANT_CODES` if any new codes are introduced (none planned).

### 3. End-to-end test

- New file: `standalone-scripts/macro-controller/src/db/__tests__/prompt-load-plan-post-seed-list.e2e.test.ts`.
- Wire the real `prompt-db`, `sql-bridge`, and the background `project-api-handler` in-process (the handler already runs under Node in existing regression tests) so the test exercises the full stack.
- Steps:
  1. Reset bridge cache.
  2. Seed the `prompt-macro` DB with the plan-role schema.
  3. Call `loadPromptsByRole('plan')` and assert it reaches `stage=post-seed-list` with `seedAttempted=true` and returns the seeded plan rows.
  4. Force the background to reject `QUERY` (simulating the reported regression) and assert the bridge falls through to `SELECT`/`EXEC` without surfacing `PROMPT_LOAD_E001`.
  5. Force every SELECT candidate to fail and assert the raised error carries `code=PROMPT_LOAD_E001` with `stage=post-seed-list`, `seedAttempted=true`, `role=plan`.

### 4. Next-button repair

Root cause hypothesis to verify inside the fix:
- The Next click path calls `getPromptsConfig()` which lazily loads Next-role prompts via the same bridge. When an earlier boot-time auto-seed insert-or-ignore hit the "only ALTER TABLE" backend response, the WRITE bucket was left uncached AND a stale error propagated, so the follow-up SELECT for Next never ran.
- Fix in three parts:
  1. In `sql-bridge.ts`, isolate bucket failure: a failed WRITE probe must not shortcut a subsequent SELECT probe. Track `lastError` per bucket, never globally.
  2. In `ui/next-inline-ui.ts`, wrap the click handler so any prompt-load rejection re-runs a one-shot bridge re-probe (`__resetWinning('SELECT')`) and retries once before surfacing the diagnostic toast. If retry succeeds, log a warn-level breadcrumb; do not toast.
  3. In `db/prompt-db.ts` `loadPromptsByRole`, ensure the `stage=post-seed-list` branch always attempts a fresh SELECT after auto-seed, even when auto-seed reported failure — the seeded rows may have landed from a concurrent boot.
- Add a focused test in `ui/__tests__/next-inline-ui-retry.test.ts` covering the retry-once-on-contract-error behavior.

## Non-goals

- No changes to the backend project-api-handler beyond what already shipped last turn.
- No UI restyle, no new prompts, no version bump beyond what release process requires.

## Verification

- `bunx vitest run standalone-scripts/macro-controller/src/db/__tests__/prompt-load-plan-post-seed-list.e2e.test.ts standalone-scripts/macro-controller/src/ui/__tests__/next-inline-ui-retry.test.ts standalone-scripts/macro-controller/src/db/__tests__/sql-bridge.test.ts`
- `tsgo -p standalone-scripts/macro-controller`
- Manual: open the diagnostics panel, click download, inspect ZIP for `sql-bridge.json` + `prompt-load-e001.json` + `seed-reseed-e001.json`.

## Technical notes (for the implementer)

- `getSqlBridgeState` must be pure and synchronous; UI reads it at click time.
- `lastError` should be capped to the last N=10 rejections per bucket to prevent unbounded growth.
- The e2e test should NOT touch `chrome.*` globals; use the existing in-process `sendToExtension` mock pattern from `sql-bridge.test.ts`.
- Next-button retry must not loop: exactly one retry, guarded by a `retriedOnce` local.

## Files touched

- `standalone-scripts/macro-controller/src/db/sql-bridge.ts` (add public state API, per-bucket lastError)
- `standalone-scripts/macro-controller/src/ui/seed-diagnostics-panel.ts` (widen export, add sections)
- `standalone-scripts/macro-controller/src/ui/next-inline-ui.ts` (retry-once wrapper on prompt-load)
- `standalone-scripts/macro-controller/src/db/prompt-db.ts` (post-seed-list fresh-SELECT guarantee)
- `standalone-scripts/macro-controller/src/db/__tests__/prompt-load-plan-post-seed-list.e2e.test.ts` (new)
- `standalone-scripts/macro-controller/src/ui/__tests__/next-inline-ui-retry.test.ts` (new)
- `.lovable/memory/features/sql-bridge-adaptive-rawsql.md` (append: state API + retry semantics)
- `.lovable/memory/index.md` (touch if new memory file added; none planned)

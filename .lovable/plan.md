# Restore prompt library + sequence pending backlog

## Root cause (verified)

The extension's SQLite bridge (`sendToExtension('n', { project, method, endpoint: 'rawSql', params: { sql } })`) now hits a stricter backend:

- `method: 'QUERY'` returns `Unsupported method: QUERY`
- `method: 'SCHEMA'` rejects anything that is not `ALTER TABLE`, returning `only ALTER TABLE statements are allowed`

Confirmed in `seed/seed-plan-next.ts`, `db/prompt-db.ts`, `db/prompt-role-db.ts`, `db/macro-db.ts`, `db/project-chat-submit-db.ts`, `db/prompt-revision-db.ts`, `db/migrate-legacy-read-memory.ts`, `db/validate-read-memory-duplicates.ts`, `ui/database-json-migrate.ts`, `ui/read-memory-admin-modal.ts`, `seed/reseed-command.ts`. Every `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, `CREATE INDEX`, `BEGIN`/`COMMIT` funneled through `rawSql` is currently a runtime failure. This produces the two toasts in the report and blocks Repair prompts, Re-seed defaults, prompt editing, and by extension the minus/hide toggle path that reads persisted UI state.

## Phase 1 (this session): unblock the prompt library

1. Add a spec at `standalone-scripts/macro-controller/spec/db-bridge/01-rawsql-contract-v2.md` capturing the new backend contract (allowed methods, allowed statement shapes, error strings) with the raw evidence from the report.
2. Introduce `db/sql-bridge.ts` that wraps `sendToExtension('n', ...)` and routes by statement kind:
   - `SELECT` -> new `method: 'SELECT'` endpoint (verify name against SDK; fall back to `EXEC` if `SELECT` unsupported).
   - `INSERT` / `UPDATE` / `DELETE` / `INSERT OR IGNORE` -> `method: 'EXEC'` (write path).
   - `CREATE TABLE` / `CREATE INDEX` / `BEGIN` / `COMMIT` -> keep on `SCHEMA` but split so only `ALTER TABLE` uses it directly; use `EXEC` for the rest, or migrate table creation into a first-boot migration file if the backend truly refuses.
   - All wrappers return the same `{ isOk, rows, errorMessage }` shape callers expect.
3. Replace every direct `sendToExtension('n', { ... endpoint: 'rawSql' ... })` call site with the bridge. No behavioral change beyond routing.
4. Add a `PENDING-VERIFY` note next to the bridge until the first live call confirms the correct method names, mirroring the workspace-move v2 pattern.
5. Update Repair prompts and Re-seed defaults so they surface the bridge's error string verbatim instead of the generic `PROMPT_EDIT_E005` toast when the underlying failure is a bridge-contract error.
6. Add a vitest that stubs `sendToExtension` and asserts each SQL kind is routed to the expected method, so a future contract drift trips CI.

## Phase 2 (next session, tracked as separate plan file): minus / hide controller

Investigate `ui/panel-layout.ts` + `ui/panel-builder.ts` collapse path. The failure is almost certainly downstream of Phase 1 because the persisted collapse state lives in the same SQLite bridge. Re-test after Phase 1 lands; only open a dedicated fix if it still misbehaves.

## Phase 3: pending backlog sequencing

The user listed plans 11, 13, 22, 23, 24, 25, 29, 31. Execute in this order, one plan per session, each landing as its own PR-sized change:

1. `29-version-json-single-source-of-truth` (touches release infra; do first so later plans don't fight version drift).
2. `11-prompts-import-export-section` (feature).
3. `13-per-project-chat-submit-tracker` (feature, depends on healthy prompt DB from Phase 1).
4. `23-prompt-library-relocate-and-light-mode` (UI move + theming).
5. `22-prompt-library-test-coverage-50` (tests, done after 23 so new UI is covered).
6. `24-eslint-warnings-cleanup-30`, then `25-eslint-cleanup-continuation-30`, then `31-lint-cleanup-ctx-denylist-and-15-line-cap` (mechanical, batched last).

Each phase-3 plan is picked up only after Phase 1 is verified green in the live extension.

## Deliverables this session

- `spec/db-bridge/01-rawsql-contract-v2.md`
- `src/db/sql-bridge.ts` + tests
- Refactor of the 10 call-site files listed above
- Memory note at `.lovable/memory/features/sql-bridge-rawsql-contract-v2.md`
- Plan file at `.lovable/plans/pending/34-sql-bridge-rawsql-contract-v2.md` moved to `live-lovable/` on completion

## Out of scope

- Any change to backend behavior (we adapt the client).
- Workspace-move v2 verification (still `PENDING-VERIFY` from last session; separate turn).
- The minus/hide button unless it survives Phase 1.

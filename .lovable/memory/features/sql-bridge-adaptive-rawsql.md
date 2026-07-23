---
name: SQL bridge adaptive rawSql
description: Runtime bridge and background rawSql contract for prompt CRUD, seeding, repair, and edit flows
type: feature
---

The v5.5.0 prompt library failed because `rawSql` traffic was routed through the generic background method dispatcher. `method: 'QUERY'` was rejected with `Unsupported method: QUERY`, and non-ALTER writes using `method: 'SCHEMA'` failed with `rawSql: only ALTER TABLE statements are allowed`. This broke prompt loading, edit default, edit specific, next-button edit, repair, and re-seed flows.

Fix, client side: `standalone-scripts/macro-controller/src/db/sql-bridge.ts` is the single choke point for rawSql traffic in macro-controller code. It classifies each SQL string into one of three buckets (SELECT, WRITE=INSERT/UPDATE/DELETE, ALTER) and probes candidate method names in order until one succeeds, then caches the winner per bucket for the session.

Fix, background side: `src/background/handlers/project-api-handler.ts` handles `endpoint: 'rawSql'` before the standard CRUD dispatcher. The rawSql handler accepts read methods (`QUERY`, `SELECT`, `READ`) and write methods (`SCHEMA`, `EXEC`, `RUN`, `WRITE`, `MUTATE`), classifies statements, rejects unsupported SQL such as `DROP TABLE`, executes multi-statement schema/write blocks with `db.exec`, and marks the DB dirty after writes.

Buckets and probe order:
- SELECT: `SELECT`, `EXEC`, `RUN`, `QUERY` (QUERY kept last as legacy fallback)
- WRITE: `EXEC`, `RUN`, `WRITE`, `QUERY`
- ALTER: `SCHEMA` only (backend contract)

Import path (important): the bridge imports `sendToExtension` from `../ui/prompt-loader` (which re-exports it from `../ui/extension-relay`). This preserves compatibility with the many existing Vitest suites that stub `ui/prompt-loader` via the shared `prompt-loader-mock.ts` helper. Do NOT switch to a direct `ui/extension-relay` import: it will silently bypass every test mock.

Refactored call sites:
- `src/db/prompt-db.ts`
- `src/db/prompt-revision-db.ts`
- `src/db/prompt-role-db.ts`
- `src/db/macro-db.ts`
- `src/db/project-chat-submit-db.ts`
- `src/db/migrate-legacy-read-memory.ts`
- `src/db/validate-read-memory-duplicates.ts`
- `src/seed/seed-plan-next.ts`
- `src/seed/reseed-command.ts`
- `src/ui/read-memory-admin-modal.ts`
- `src/ui/database-json-migrate.ts`

Spec: `standalone-scripts/macro-controller/spec/db-bridge/01-rawsql-contract-v2.md`
Tests: `src/db/__tests__/sql-bridge.test.ts` (probe/cache), `src/test/regression/project-api-rawsql.test.ts` (background contract). Focused regression suite: 98 tests green across rawSql, prompt DB, seed, migration, and handler guards. Typecheck is clean.

Related error codes cleared: `PROMPT_LOAD_E001`, `PROMPT_EDIT_E005`, `SEED_RESEED_E001` (when caused by method-name rejection).
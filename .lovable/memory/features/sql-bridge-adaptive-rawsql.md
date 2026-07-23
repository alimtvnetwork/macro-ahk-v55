---
name: SQL bridge adaptive rawSql
description: Runtime probe/cache wrapper for backend rawSql method-name churn (QUERY dead, SCHEMA=ALTER-only)
type: feature
---

Backend `rawSql` no longer accepts `method: 'QUERY'` and now restricts `method: 'SCHEMA'` to `ALTER TABLE` statements only. Every prompt-library DB call (seeding, CRUD, repair, revision history, role enforcement) previously failed with `Unsupported method: QUERY` or `rawSql: only ALTER TABLE statements are allowed`.

Fix: `standalone-scripts/macro-controller/src/db/sql-bridge.ts` is now the single choke point for rawSql traffic. It classifies each SQL string into one of three buckets (SELECT, WRITE=INSERT/UPDATE/DELETE, ALTER) and probes candidate method names in order until one succeeds, then caches the winner per bucket for the session.

Buckets and probe order:
- SELECT: `SELECT`, `EXEC`, `RUN`, `QUERY` (QUERY kept last as legacy fallback)
- WRITE: `EXEC`, `RUN`, `WRITE`, `QUERY`
- ALTER: `SCHEMA` only (backend contract)

Import path (important): the bridge imports `sendToExtension` from `../ui/prompt-loader` (which re-exports it from `../ui/extension-relay`). This preserves compatibility with the many existing Vitest suites that stub `ui/prompt-loader` via the shared `prompt-loader-mock.ts` helper. Do NOT switch to a direct `ui/extension-relay` import: it will silently bypass every test mock.

Refactored call sites:
- `src/db/prompt-db.ts`
- `src/db/prompt-revision-db.ts`
- `src/db/prompt-role-db.ts`
- `src/seed/seed-plan-next.ts`
- `src/seed/reseed-command.ts`

Spec: `standalone-scripts/macro-controller/spec/db-bridge/01-rawsql-contract-v2.md`
Tests: `src/db/__tests__/sql-bridge.test.ts` (probe/cache); 337 tests green across `src/db` and `src/seed`.

Related error codes cleared: `PROMPT_LOAD_E001`, `PROMPT_EDIT_E005`, `SEED_RESEED_E001` (when caused by method-name rejection).
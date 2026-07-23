## Fix plan

### Verified issue

The prompt UI is failing because `PROJECT_API` still rejects the SQL methods used by prompt editing:

- `src/background/handlers/project-api-handler.ts` only dispatches `GET`, `POST`, `PUT`, `DELETE`, and `SCHEMA`.
- Its `rawSql` handler only accepts `SCHEMA + ALTER TABLE`.
- The client bridge now probes `QUERY`, `SELECT`, `EXEC`, etc., but the background handler does not implement those methods, so Edit default, Edit specific, Re-seed defaults, Plan edit, and Next edit can still fail with `Unsupported method: QUERY` or `rawSql: only ALTER TABLE statements are allowed`.

### Changes to make

1. **Repair the background `PROJECT_API rawSql` contract**
   - Update `src/background/handlers/project-api-handler.ts` so `endpoint: 'rawSql'` is handled before normal table CRUD dispatch.
   - Support the methods the client bridge probes:
     - `QUERY`, `SELECT`, `READ`: read-only SQL returning `rows`.
     - `EXEC`, `RUN`, `WRITE`, `MUTATE`: mutating SQL returning `executed`, `lastInsertId`, and `changes` when available.
     - `SCHEMA`: keep `ALTER TABLE`, and allow safe internal DDL needed by existing migrations such as `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
   - Mark and flush the project DB only after mutating statements.

2. **Add a statement safety classifier**
   - Classify SQL by first statement keyword.
   - Allow only the project-internal statement classes already used by this repository: `SELECT`, `PRAGMA table_info`, `INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, `BEGIN`, `COMMIT`, `ROLLBACK`.
   - Reject unrelated SQL with a clear error so the API does not become an unrestricted SQL console.

3. **Normalize raw SQL response shape**
   - `SELECT` responses must return `{ isOk: true, rows: [...] }` because `listPromptsByRole`, `getDefaultPromptForRole`, and Edit Specific depend on that.
   - Write responses must return `{ isOk: true, executed: true, lastInsertId, changes }` where possible.
   - Errors should keep the exact backend reason in `errorMessage` so future toasts are diagnostic.

4. **Finish routing remaining direct rawSql call sites through the bridge**
   - Refactor the remaining direct `sendToExtension('PROJECT_API', { endpoint: 'rawSql' ... })` call sites found in:
     - `db/macro-db.ts`
     - `db/project-chat-submit-db.ts`
     - `db/migrate-legacy-read-memory.ts`
     - `db/validate-read-memory-duplicates.ts`
     - `ui/database-json-migrate.ts`
     - `ui/read-memory-admin-modal.ts`
     - `ui/database-modal-data.ts`
     - `ui/database-schema-tab.ts`
   - This prevents the same rawSql failure from reappearing outside prompt editing.

5. **Regression tests**
   - Add or update background handler tests proving:
     - `QUERY + rawSql + SELECT` returns rows.
     - `EXEC + rawSql + INSERT/UPDATE` succeeds and flushes.
     - `SCHEMA + rawSql + non-ALTER` no longer breaks safe internal `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
     - unsafe SQL is rejected.
   - Keep existing `sql-bridge` tests green.

6. **Verify the user-facing flows**
   - Run focused tests for background handler, `src/db`, `src/seed`, and prompt UI paths.
   - Typecheck the extension packages.
   - Confirm the live bundle no longer produces `PROMPT_LOAD_E001`, `PROMPT_EDIT_E005`, or `SEED_RESEED_E001` for Plan and Next prompt actions.

7. **Release readiness**
   - The codebase currently shows root `version.json` at `5.8.0`, while the screenshot is running `v5.5.0`.
   - After the fix is green, follow `.lovable/how-to-release.md`: release flow uses root `version.json` as the single source of truth, and the extension build syncs manifest version from it.

### Out of scope for this fix

- Workspace move v2 verification.
- The larger backlog items 11, 13, 22, 23, 24, 25, 29, and 31, except where direct rawSql routing must be fixed to unblock prompt import/export and chat submit later.
- Minus/hide controller behavior unless it still fails after the shared DB contract is fixed.
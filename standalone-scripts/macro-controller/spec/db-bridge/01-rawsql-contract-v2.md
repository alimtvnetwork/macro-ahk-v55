# SQL bridge contract v2

## Symptom (2026-07-23, v5.5.0)

Prompt library toasts:

```
PROMPT_EDIT_E005: Default prompt repair failed. Use More > Re-seed defaults, then edit again.
PROMPT_LOAD_E001: db=Unsupported method: QUERY | initial-list=Unsupported method: QUERY
                  | auto-seed=insert-or-ignore failed: rawSql: only ALTER TABLE statements are allowed.
```

## Legacy contract (v1)

```ts
sendToExtension('PROJECT_API', {
  project: DB_NAME,
  method: 'QUERY' | 'SCHEMA',
  endpoint: 'rawSql',
  params: { sql },
})
```

- `QUERY` used for `SELECT`.
- `SCHEMA` used for `INSERT` / `UPDATE` / `DELETE` / `INSERT OR IGNORE` / `CREATE TABLE` / `CREATE INDEX` / `BEGIN` / `COMMIT` / `ALTER TABLE`.

## Observed v2 restrictions

- `method: 'QUERY'` -> hard reject with `Unsupported method: QUERY`.
- `method: 'SCHEMA'` -> accepted only when the SQL body is an `ALTER TABLE` statement, otherwise rejected with `only ALTER TABLE statements are allowed`.

## Fixed contract

The extension background handler must handle `endpoint: 'rawSql'` before the
standard CRUD dispatcher. This prevents `QUERY` from being rejected by the
generic method allow-list and prevents prompt CRUD from being routed through the
ALTER-only schema path.

Accepted rawSql methods:

- Read methods: `QUERY`, `SELECT`, `READ`.
- Write methods: `SCHEMA`, `EXEC`, `RUN`, `WRITE`, `MUTATE`.

Accepted SQL statements:

- Read: `SELECT`, `PRAGMA table_info(...)`.
- Write: `INSERT`, `UPDATE`, `DELETE`.
- Schema: `CREATE TABLE`, `CREATE INDEX`, `CREATE UNIQUE INDEX`, `CREATE VIEW`, `DROP VIEW`, `ALTER TABLE`.
- Transaction wrappers: `BEGIN`, `COMMIT`, `ROLLBACK`.

Unsupported SQL, including `DROP TABLE`, is rejected before execution.

## Client strategy: adaptive probe

`db/sql-bridge.ts` sends the caller's SQL under a sequence of candidate method
names, in order, and caches the first name the backend does NOT reject with a
contract error. Three independent caches:

- `SELECT` cache: `['QUERY', 'SELECT', 'READ', 'EXEC', 'RUN']`
- `WRITE` cache (non-ALTER DML/DDL): `['SCHEMA', 'EXEC', 'RUN', 'WRITE', 'MUTATE', 'QUERY']`
- `ALTER` cache: fixed at `'SCHEMA'`.

Contract errors that trigger a fallback:

- Exact prefix `Unsupported method:`
- Substring `only ALTER TABLE statements are allowed` (only for the WRITE cache when the SQL is NOT an `ALTER TABLE`).

Any other error (SQL syntax, no rows, permission) is returned as-is; the bridge
does NOT retry those.

The cache is process-local; a fresh page load re-probes so a backend rollback
heals automatically.

## Verification checklist

- `src/test/regression/project-api-rawsql.test.ts` verifies `QUERY` reads,
  `EXEC` writes, `SCHEMA` DDL, write metadata, dirty marking, and unsupported
  SQL rejection.
- `standalone-scripts/macro-controller/src/db/__tests__/sql-bridge.test.ts`
  verifies the adaptive probe/cache behavior for bundled background mismatch.
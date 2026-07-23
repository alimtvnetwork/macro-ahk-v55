# SQL bridge contract v2 (PENDING-VERIFY)

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

## Unknown

The backend has NOT documented what replaces `QUERY` for `SELECT` and what replaces
`SCHEMA` for `INSERT`/`UPDATE`/`DELETE`/`CREATE`. The user does not have a captured
request/response pair to lock the contract.

## Strategy: adaptive probe

`db/sql-bridge.ts` sends the caller's SQL under a sequence of candidate method
names, in order, and caches the first name the backend does NOT reject with a
contract error. Two independent caches:

- `SELECT` cache: `['QUERY', 'SELECT', 'READ', 'EXEC', 'RUN']`
- `WRITE` cache (non-ALTER DML/DDL): `['SCHEMA', 'EXEC', 'RUN', 'WRITE', 'MUTATE', 'QUERY']`
- `ALTER` cache: fixed at `'SCHEMA'` (the one shape still confirmed working).

Contract errors that trigger a fallback:

- Exact prefix `Unsupported method:`
- Substring `only ALTER TABLE statements are allowed` (only for the WRITE cache when the SQL is NOT an `ALTER TABLE`).

Any other error (SQL syntax, no rows, permission) is returned as-is; the bridge
does NOT retry those.

The cache is process-local; a fresh page load re-probes so a backend rollback
heals automatically.

## Verification checklist

Delete PENDING-VERIFY once the live extension logs confirm which method names
the backend actually accepts. Update the candidate order so the winning name is
first, to skip the probe entirely on cold boot.
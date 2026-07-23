---
Slug: schema-migration
Status: pending
Created: 2026-07-18
Parent: 14-editable-plan-next-prompt-library
---

# SS-02 — SQLite schema migration for `Role` + `IsDefault`

Goal: extend the `Prompt` table without breaking existing rows or requiring a version bump gate.

## Approach

The macro-controller uses idempotent `CREATE TABLE IF NOT EXISTS` inside `initMacroDb`. `ALTER TABLE ... ADD COLUMN` is idempotent-safe only when guarded, because SQLite errors on duplicate columns. Use:

```ts
const cols = db.exec(`PRAGMA table_info('Prompt')`)[0]?.values ?? [];
const names = new Set(cols.map((r) => String(r[1])));
if (!names.has('Role')) {
  db.run(`ALTER TABLE Prompt ADD COLUMN Role TEXT NOT NULL DEFAULT 'generic'`);
}
if (!names.has('IsDefault')) {
  db.run(`ALTER TABLE Prompt ADD COLUMN IsDefault INTEGER NOT NULL DEFAULT 0`);
}
db.run(`CREATE INDEX IF NOT EXISTS idx_prompt_role_default ON Prompt(Role, IsDefault)`);
```

## Backfill

For any row whose `Slug` matches `plan-default` or `next-default` (seed rows produced in step 8), set `Role` accordingly and `IsDefault = 1`. All other pre-existing rows remain `Role='generic'`, `IsDefault=0`.

## Tests

- Fresh DB: columns created, index present.
- Existing DB with 20 rows: rerun `initMacroDb`, all rows preserved, seed rows correctly tagged.
- Double-run: no error, no duplicate columns.

## Rollback

Migration is additive only; no destructive change. Rollback = ignore new columns (older code paths keep working because `Role` and `IsDefault` are optional in the read layer until step 5 lands).

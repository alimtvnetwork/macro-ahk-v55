# Fixing TableName/Columns/SQL Guards in project-api-handler

**Target:** `src/background/handlers/project-api-handler.ts`
**Rule:** Rule 3

## Violations

- **L228:** `if (!tableName)` — extract `const isTableNameMissing = !tableName;`
- **L233:** `if (!columns || columns.length === 0)` — extract `const isColumnsAbsent = !columns || columns.length === 0;`
- **L245:** `if (!tableName)` (repeated) — reuse `isTableNameMissing`
- **L277:** `if (!sql)` — extract `const isSqlMissing = !sql;`

## Instructions

Apply fixes, run `pnpm run lint`, commit:

```
fix(guidelines): extract table/column/sql guards in project-api-handler
```

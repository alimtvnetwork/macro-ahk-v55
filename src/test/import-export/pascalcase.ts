/**
 * PascalCase validation helpers for the bundle schema audit.
 * Spec: spec/30-import-export/03-test-plan.md §3 file #2.
 */

import type { Database } from "sql.js";

const PASCAL_RE = /^[A-Z][A-Za-z0-9]*$/;

export function isPascalCase(name: string): boolean {
  if (typeof name !== "string" || name.length === 0) {
    return false;
  }
  if (name.includes("_") || name.includes("-")) {
    return false;
  }
  return PASCAL_RE.test(name);
}

export interface SchemaViolation {
  table: string;
  column?: string;
  reason: string;
}

/**
 * Walk sqlite_master and PRAGMA table_info() for every user table,
 * collecting any table or column name that is NOT PascalCase.
 */
export function findSchemaViolations(db: Database): SchemaViolation[] {
  const violations: SchemaViolation[] = [];

  const tablesRes = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  const tables: string[] = tablesRes[0]?.values.map((row) => String(row[0])) ?? [];

  for (const table of tables) {
    if (!isPascalCase(table)) {
      violations.push({ table, reason: `table name '${table}' is not PascalCase` });
    }
    const cols = db.exec(`PRAGMA table_info('${table.replace(/'/g, "''")}')`);
    const colNames: string[] = cols[0]?.values.map((row) => String(row[1])) ?? [];
    for (const col of colNames) {
      if (!isPascalCase(col)) {
        violations.push({ table, column: col, reason: `column '${table}.${col}' is not PascalCase` });
      }
    }
  }

  return violations;
}

export function assertSchemaPascalCase(db: Database): void {
  const violations = findSchemaViolations(db);
  if (violations.length > 0) {
    const lines = violations.map((v) => `  - ${v.reason}`);
    throw new Error(`Schema has ${violations.length} non-PascalCase identifier(s):\n${lines.join("\n")}`);
  }
}

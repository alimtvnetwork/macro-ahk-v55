/**
 * E2E #2 — Schema is PascalCase.
 * Spec: spec/30-import-export/03-test-plan.md §3 row 2.
 */
import { describe, it, expect } from "vitest";
import { openCachedDb } from "./setup-helpers";
import { findSchemaViolations, isPascalCase } from "./pascalcase";
import { REQUIRED_TABLES } from "./enums";

describe("schema-pascalcase", () => {
  it("every user table is PascalCase", async () => {
    const db = await openCachedDb();
    try {
      const res = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      );
      const tables = res[0]?.values.map((r) => String(r[0])) ?? [];
      for (const t of tables) {
        expect(isPascalCase(t), `table '${t}' not PascalCase`).toBe(true);
      }
    } finally {
      db.close();
    }
  });

  it("every column in every table is PascalCase", async () => {
    const db = await openCachedDb();
    try {
      const violations = findSchemaViolations(db);
      expect(violations, JSON.stringify(violations, null, 2)).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it("no snake_case identifiers exist anywhere", async () => {
    const db = await openCachedDb();
    try {
      const tables = db
        .exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0]
        ?.values.map((r) => String(r[0])) ?? [];
      for (const t of tables) {
        expect(t).not.toMatch(/_/);
        const cols = db.exec(`PRAGMA table_info('${t}')`)[0]?.values.map((r) => String(r[1])) ?? [];
        for (const c of cols) {
          expect(c, `column '${t}.${c}' contains underscore`).not.toMatch(/_/);
        }
      }
    } finally {
      db.close();
    }
  });

  it("no camelCase (lowercase-leading) identifiers exist anywhere", async () => {
    const db = await openCachedDb();
    try {
      const tables = db
        .exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0]
        ?.values.map((r) => String(r[0])) ?? [];
      for (const t of tables) {
        expect(t[0]).toMatch(/[A-Z]/);
        const cols = db.exec(`PRAGMA table_info('${t}')`)[0]?.values.map((r) => String(r[1])) ?? [];
        for (const c of cols) {
          expect(c[0], `column '${t}.${c}' starts lowercase`).toMatch(/[A-Z]/);
        }
      }
    } finally {
      db.close();
    }
  });

  it("Meta.format_version is the canonical Key/Value row and >= '4'", async () => {
    const db = await openCachedDb();
    try {
      const res = db.exec("SELECT Value FROM Meta WHERE Key = 'format_version'");
      const v = res[0]?.values[0]?.[0];
      expect(typeof v).toBe("string");
      expect(parseInt(String(v), 10)).toBeGreaterThanOrEqual(4);
    } finally {
      db.close();
    }
  });

  it("all required tables exist", async () => {
    const db = await openCachedDb();
    try {
      const tables = new Set(
        db
          .exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0]
          ?.values.map((r) => String(r[0])) ?? [],
      );
      for (const required of REQUIRED_TABLES) {
        expect(tables.has(required), `missing table '${required}'`).toBe(true);
      }
    } finally {
      db.close();
    }
  });
});

/**
 * E2E #5 — Configs round-trip.
 * Spec: spec/30-import-export/03-test-plan.md §3 row 5.
 */
import { describe, it, expect } from "vitest";
import { openCachedDb, loadCachedBundle } from "./setup-helpers";

describe("configs-roundtrip", () => {
  it("library config ExternalCfg1 is present in the Configs table", async () => {
    const db = await openCachedDb();
    try {
      const res = db.exec("SELECT Name, Json FROM Configs WHERE Name = 'ExternalCfg1'");
      expect(res[0]?.values.length).toBe(1);
    } finally {
      db.close();
    }
  });

  it("Json column is byte-equal to the source fixture json", async () => {
    const { fixture } = await loadCachedBundle();
    const db = await openCachedDb();
    try {
      const res = db.exec("SELECT Json FROM Configs WHERE Name = 'ExternalCfg1'");
      expect(String(res[0].values[0][0])).toBe(fixture.configs[0].json);
    } finally {
      db.close();
    }
  });

  it("Uid preserves the original library config id", async () => {
    const { fixture } = await loadCachedBundle();
    const db = await openCachedDb();
    try {
      const res = db.exec("SELECT Uid FROM Configs WHERE Name = ?", [fixture.configs[0].name]);
      expect(String(res[0]?.values[0]?.[0])).toBe(fixture.configs[0].id);
    } finally {
      db.close();
    }
  });
});

/**
 * E2E — v6 PromptsCategory + PromptsToCategory tables preserve
 * multi-category prompt linkage on round-trip.
 *
 * Spec: plan.md §"Follow-ups" item 3 (multi-category linkage).
 */
import { describe, it, expect } from "vitest";
import { openCachedDb } from "./setup-helpers";

describe("v6-prompt-categories", () => {
  it("PromptsCategory table is present with PascalCase columns", async () => {
    const db = await openCachedDb();
    try {
      const res = db.exec("PRAGMA table_info(\"PromptsCategory\")");
      const cols = (res[0]?.values ?? []).map((r) => String(r[1]));
      expect(cols).toContain("Name");
      expect(cols).toContain("SortOrder");
      expect(cols).toContain("CreatedAt");
    } finally {
      db.close();
    }
  });

  it("PromptsToCategory table is present and references Prompts via Uid", async () => {
    const db = await openCachedDb();
    try {
      const res = db.exec("PRAGMA table_info(\"PromptsToCategory\")");
      const cols = (res[0]?.values ?? []).map((r) => String(r[1]));
      expect(cols).toContain("PromptUid");
      expect(cols).toContain("CategoryName");
    } finally {
      db.close();
    }
  });

  it("every distinct fixture category appears in PromptsCategory exactly once", async () => {
    const db = await openCachedDb();
    try {
      // Fixture uses 'Default' (×1) and 'Workflow' (×2) — see build-fixture.
      const res = db.exec(
        "SELECT Name FROM PromptsCategory ORDER BY SortOrder ASC",
      );
      const names = (res[0]?.values ?? []).map((r) => String(r[0]));
      expect(names).toEqual(["Default", "Workflow"]);
    } finally {
      db.close();
    }
  });

  it("PromptsToCategory has one junction row per fixture prompt-category pair", async () => {
    const db = await openCachedDb();
    try {
      const res = db.exec(
        "SELECT COUNT(*) FROM PromptsToCategory",
      );
      const count = Number(res[0].values[0][0]);
      // Fixture: prompt 1 → Default, prompt 2 → Workflow, prompt 3 → Workflow.
      expect(count).toBe(3);
    } finally {
      db.close();
    }
  });

  it("Prompts.Category column is still emitted for v4/v5 backward compat", async () => {
    const db = await openCachedDb();
    try {
      const res = db.exec(
        "SELECT Category FROM Prompts WHERE Uid = 'prompt-fixture-uid-0001'",
      );
      expect(String(res[0].values[0][0])).toBe("Default");
    } finally {
      db.close();
    }
  });
});

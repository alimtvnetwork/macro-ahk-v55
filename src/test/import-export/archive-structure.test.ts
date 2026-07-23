/**
 * E2E #1 — Archive structure.
 * Spec: spec/30-import-export/03-test-plan.md §3 row 1.
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { loadCachedBundle } from "./setup-helpers";
import { BUNDLE_ENTRY_NAME, SQLITE_MAGIC } from "./enums";

describe("archive-structure", () => {
  it("zip contains exactly one entry", async () => {
    const { zipBytes } = await loadCachedBundle();
    const zip = await JSZip.loadAsync(zipBytes);
    const entries = Object.keys(zip.files);
    expect(entries).toHaveLength(1);
  });

  it(`entry is named ${BUNDLE_ENTRY_NAME}`, async () => {
    const { zipBytes } = await loadCachedBundle();
    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files)[0]).toBe(BUNDLE_ENTRY_NAME);
  });

  it("entry is a valid SQLite file (magic bytes)", async () => {
    const { dbBytes } = await loadCachedBundle();
    const head = new TextDecoder("latin1").decode(dbBytes.slice(0, 16));
    expect(head).toBe(SQLITE_MAGIC);
  });

  it("zip bytes are non-empty and inflate cleanly", async () => {
    const { zipBytes, dbBytes } = await loadCachedBundle();
    expect(zipBytes.length).toBeGreaterThan(0);
    expect(dbBytes.length).toBeGreaterThan(0);
  });
});

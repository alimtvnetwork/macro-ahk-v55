/**
 * Hard runtime guard: Phase 2c-storage v2 (PascalCase rewrite of
 * StoredProject payloads in chrome.storage.local) is permanently banned.
 *
 * See mem://constraints/no-storage-pascalcase-migration.
 */
import { describe, it, expect } from "vitest";
import {
    assertNoPascalCaseStorageMigration,
    MAX_ALLOWED_STORAGE_SCHEMA_VERSION,
    CURRENT_STORAGE_SCHEMA_VERSION,
} from "../storage-migration";

describe("storage-migration PascalCase guard", () => {
    it("ceiling matches current camelCase baseline", () => {
        expect(MAX_ALLOWED_STORAGE_SCHEMA_VERSION).toBe(1);
        expect(CURRENT_STORAGE_SCHEMA_VERSION).toBeLessThanOrEqual(
            MAX_ALLOWED_STORAGE_SCHEMA_VERSION,
        );
    });

    it("assertNoPascalCaseStorageMigration always throws", () => {
        expect(() =>
            assertNoPascalCaseStorageMigration("unit-test"),
        ).toThrowError(/BLOCKED: Storage PascalCase migration/);
    });
});

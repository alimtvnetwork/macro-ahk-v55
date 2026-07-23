/**
 * Regression tests, PROJECT_API rawSql bridge contract.
 *
 * Locks the prompt-library fix that made rawSql methods accepted by the
 * background handler again. Prompt edit, Edit Specific, Next edit, and
 * re-seed depend on these exact response shapes.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database as SqlJsDatabase } from "sql.js";

const execMock = vi.fn();
const markDirtyMock = vi.fn();

vi.mock("@/background/project-db-manager", () => ({
    hasProjectDb: vi.fn(() => true),
    getProjectDb: vi.fn(() => ({
        exec: execMock,
        getRowsModified: () => 3,
    } as unknown as SqlJsDatabase)),
    initProjectDb: vi.fn(async () => ({ markDirty: markDirtyMock })),
}));

import { handleProjectApi } from "@/background/handlers/project-api-handler";

beforeEach(() => {
    execMock.mockReset();
    markDirtyMock.mockReset();
    execMock.mockImplementation((sql: string) => {
        if (/last_insert_rowid/i.test(sql)) {
            return [{ columns: ["lastInsertId"], values: [[42]] }];
        }
        if (/^\s*(select|pragma)/i.test(sql)) {
            return [{ columns: ["Id", "Slug"], values: [[1, "plan-default"]] }];
        }
        return [];
    });
});

describe("PROJECT_API rawSql contract", () => {
    it("QUERY rawSql SELECT returns rows", async () => {
        const result = await handleProjectApi({
            type: "PROJECT_API",
            project: "prompts.macro",
            method: "QUERY",
            endpoint: "rawSql",
            params: { sql: "SELECT Id, Slug FROM Prompt" },
        });

        expect(result.isOk).toBe(true);
        expect(result.rows).toEqual([{ Id: 1, Slug: "plan-default" }]);
        expect(execMock).toHaveBeenCalledWith("SELECT Id, Slug FROM Prompt");
        expect(markDirtyMock).not.toHaveBeenCalled();
    });

    it("EXEC rawSql INSERT succeeds, returns write metadata, and marks dirty", async () => {
        const result = await handleProjectApi({
            type: "PROJECT_API",
            project: "prompts.macro",
            method: "EXEC",
            endpoint: "rawSql",
            params: { sql: "INSERT INTO Prompt (Slug) VALUES ('x')" },
        });
        await Promise.resolve();

        expect(result.isOk).toBe(true);
        expect(result.executed).toBe(true);
        expect(result.lastInsertId).toBe(42);
        expect(result.changes).toBe(3);
        expect(execMock).toHaveBeenCalledWith("INSERT INTO Prompt (Slug) VALUES ('x')");
        expect(markDirtyMock).toHaveBeenCalledOnce();
    });

    it("SCHEMA rawSql accepts safe CREATE TABLE and CREATE INDEX DDL", async () => {
        const result = await handleProjectApi({
            type: "PROJECT_API",
            project: "prompts.macro",
            method: "SCHEMA",
            endpoint: "rawSql",
            params: {
                sql: "CREATE TABLE IF NOT EXISTS Prompt (Id INTEGER); CREATE INDEX IF NOT EXISTS idx_prompt_id ON Prompt (Id);",
            },
        });
        await Promise.resolve();

        expect(result.isOk).toBe(true);
        expect(result.executed).toBe(true);
        expect(markDirtyMock).toHaveBeenCalledOnce();
    });

    it("rejects unsupported SQL instead of exposing an unrestricted console", async () => {
        const result = await handleProjectApi({
            type: "PROJECT_API",
            project: "prompts.macro",
            method: "EXEC",
            endpoint: "rawSql",
            params: { sql: "DROP TABLE Prompt" },
        });

        expect(result.isOk).toBe(false);
        expect(String(result.errorMessage)).toContain("rawSql: unsupported statement");
        expect(execMock).not.toHaveBeenCalled();
    });
});
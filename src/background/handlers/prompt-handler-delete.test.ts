import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { bindPromptDbManager, handleDeletePrompt, handleSavePrompt } from "./prompt-handler";

let db: SqlJsDatabase;
let markDirty: Mock;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    markDirty = vi.fn();
    bindPromptDbManager({ getLogsDb: () => db, markDirty });
    stubChromeStorage();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([]) }));
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

function stubChromeStorage(): void {
    vi.stubGlobal("chrome", { storage: { local: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined), remove: vi.fn().mockResolvedValue(undefined) } }, runtime: { getURL: () => "" } });
}

async function createCustomPromptId(): Promise<string> {
    const result = await handleSavePrompt({ prompt: { name: "Delete me", text: "body", order: 1 } });
    return result.prompt.id;
}

function createDefaultPrompt(): string {
    db.run("INSERT INTO Prompts (Name, Text, IsDefault, CreatedAt, UpdatedAt) VALUES (?, ?, 1, ?, ?)", ["Default", "body", "now", "now"]);
    const result = db.exec("SELECT last_insert_rowid()");
    return String(result[0]?.values[0]?.[0] ?? "");
}

describe("handleDeletePrompt", () => {
    it("deletes custom prompts and marks the DB dirty", async () => {
        const promptId = await createCustomPromptId();
        expect(await handleDeletePrompt({ promptId })).toEqual({ isOk: true });
        expect(db.exec("SELECT Id FROM Prompts WHERE Id = ?", [Number(promptId)]).length).toBe(0);
        expect(markDirty).toHaveBeenCalled();
    });

    it("rejects missing prompt ids instead of returning success", async () => {
        const result = await handleDeletePrompt({ promptId: "999999" });
        expect(result.isOk).toBe(false);
        expect("errorMessage" in result ? result.errorMessage : "").toContain("not found");
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("DB_WRITE_E004"));
    });

    it("rejects default prompt deletion instead of silently no-oping", async () => {
        await handleSavePrompt({ prompt: { name: "Schema", text: "seed" } });
        const promptId = createDefaultPrompt();
        const result = await handleDeletePrompt({ promptId });
        expect(result.isOk).toBe(false);
        expect("errorMessage" in result ? result.errorMessage : "").toContain("default prompts cannot be deleted");
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("DB_WRITE_E004"));
    });
});
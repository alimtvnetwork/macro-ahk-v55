/* eslint-disable sonarjs/no-duplicate-string -- prompt seed data repeats timestamps and fields */
/**
 * Marco Extension — Prompt CRUD Handler (Spec 15 T-10)
 *
 * Manages custom prompts in SQLite (logs.db).
 * Automatically migrates existing prompts from chrome.storage.local on first load.
 * Seeds default prompts into the Prompts table so they are always visible.
 *
 * Categories are stored in PromptsCategory with a many-to-many junction
 * table PromptsToCategory. All relational reads use the PromptsDetails view.
 *
 * All column names use PascalCase per database naming convention.
 *
 * @see spec/05-chrome-extension/45-prompt-manager-crud.md — Prompt manager CRUD
 * @see spec/05-chrome-extension/52-prompt-caching-indexeddb.md — Prompt caching
 */

import type { Database as SqlJsDatabase } from "sql.js";
import type { DbManager } from "../db-manager";
import { logBgError, logCaughtError, logSampledDebug, BgLogTag} from "../bg-logger";
import { bindOpt, missingFieldError, requireField, type HandlerErrorResponse } from "./handler-guards";
import bundledPromptBundle from "../../../chrome-extension/prompts/macro-prompts.json";

const LEGACY_STORAGE_KEY = "marco_custom_prompts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PromptEntry {
    id: string;
    slug?: string;
    name: string;
    text: string;
    version?: string;
    order: number;
    isDefault?: boolean;
    isFavorite?: boolean;
    category?: string;
    categories?: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

interface DeletePromptCandidate {
    name: string;
    isDefault: boolean;
}

/* ------------------------------------------------------------------ */
/*  DbManager binding                                                  */
/* ------------------------------------------------------------------ */

let dbManager: DbManager | null = null;
let migrationDone = false;

export function bindPromptDbManager(manager: DbManager): void {
    dbManager = manager;
    migrationDone = false;
}

function getDb(): SqlJsDatabase {
    if (!dbManager) {
        throw new Error("[prompts] DbManager not bound. Call bindPromptDbManager() first.");
    }
    return dbManager.getLogsDb();
}

function markDirty(): void {
    dbManager?.markDirty();
}

/* ------------------------------------------------------------------ */
/*  SQLite helpers                                                     */
/* ------------------------------------------------------------------ */

function runOptionalSchemaUpdate(db: SqlJsDatabase, sql: string, message: string): void {
    try {
        db.run(sql);
    } catch (error) {
        console.debug(message, error);
    }
}

function ensurePromptCoreTables(db: SqlJsDatabase): void {
    db.run(`
        CREATE TABLE IF NOT EXISTS Prompts (
            Id         INTEGER PRIMARY KEY AUTOINCREMENT,
            Slug       TEXT UNIQUE,
            Name       TEXT NOT NULL,
            Text       TEXT NOT NULL,
            Version    TEXT DEFAULT '1.0.0',
            SortOrder  INTEGER DEFAULT 0,
            IsDefault  INTEGER DEFAULT 0,
            IsFavorite INTEGER DEFAULT 0,
            CreatedAt  TEXT NOT NULL,
            UpdatedAt  TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS PromptsCategory (
            Id        INTEGER PRIMARY KEY AUTOINCREMENT,
            Name      TEXT NOT NULL UNIQUE,
            SortOrder INTEGER DEFAULT 0,
            CreatedAt TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS PromptsToCategory (
            Id         INTEGER PRIMARY KEY AUTOINCREMENT,
            PromptId   INTEGER NOT NULL,
            CategoryId INTEGER NOT NULL,
            FOREIGN KEY (PromptId) REFERENCES Prompts(Id) ON DELETE CASCADE,
            FOREIGN KEY (CategoryId) REFERENCES PromptsCategory(Id) ON DELETE CASCADE,
            UNIQUE (PromptId, CategoryId)
        )
    `);
}

function createPromptsDetailsView(db: SqlJsDatabase): void {
    db.run(`CREATE VIEW IF NOT EXISTS PromptsDetails AS
        SELECT
            p.Id AS PromptId, p.Slug AS Slug, p.Name AS Title, p.Text AS Content,
            p.Version AS Version, p.SortOrder AS SortOrder,
            p.IsDefault AS IsDefault, p.IsFavorite AS IsFavorite,
            p.Tags AS Tags, p.CreatedAt AS CreatedAt, p.UpdatedAt AS UpdatedAt,
            COALESCE(GROUP_CONCAT(pc.Name, ', '), '') AS Categories
        FROM Prompts p
        LEFT JOIN PromptsToCategory ptc ON ptc.PromptId = p.Id
        LEFT JOIN PromptsCategory pc ON pc.Id = ptc.CategoryId
        GROUP BY p.Id`);
}

function ensurePromptSchemaMigrations(db: SqlJsDatabase): void {
    runOptionalSchemaUpdate(db, "ALTER TABLE Prompts ADD COLUMN Version TEXT DEFAULT '1.0.0'", "[prompts] ALTER ADD Version skipped:");
    runOptionalSchemaUpdate(db, "ALTER TABLE Prompts ADD COLUMN Slug TEXT", "[prompts] ALTER ADD Slug skipped:");
    runOptionalSchemaUpdate(db, "ALTER TABLE Prompts ADD COLUMN Tags TEXT DEFAULT ''", "[prompts] ALTER ADD Tags skipped:");
    runOptionalSchemaUpdate(db, "CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_slug ON Prompts(Slug)", "[prompts] CREATE INDEX idx_prompts_slug skipped:");
}

function recreatePromptsDetailsView(db: SqlJsDatabase): void {
    try {
        db.run("DROP VIEW IF EXISTS PromptsDetails");
        createPromptsDetailsView(db);
    } catch (error) {
        console.debug("[prompts] recreate PromptsDetails view skipped:", error);
    }
}

function ensurePromptsTable(): void {
    const db = getDb();
    ensurePromptCoreTables(db);
    ensurePromptSchemaMigrations(db);
    recreatePromptsDetailsView(db);
}

/** Ensures a category exists and returns its ID (INTEGER AUTOINCREMENT). */
function ensureCategoryId(categoryName: string): string {
    const db = getDb();
    const trimmed = categoryName.trim();
    if (!trimmed) return "";

    const existing = db.exec("SELECT Id FROM PromptsCategory WHERE Name = ?", [trimmed]);
    if (existing.length > 0 && existing[0].values.length > 0) {
        return String(existing[0].values[0][0]);
    }

    const now = new Date().toISOString();
    db.run(
        "INSERT INTO PromptsCategory (Name, SortOrder, CreatedAt) VALUES (?, 0, ?)",
        [trimmed, now],
    );
    const result = db.exec("SELECT last_insert_rowid()");
    return String(result[0].values[0][0]);
}

function findExistingDefaultPromptId(slug: string | undefined, legacySlug: string | undefined): number | null {
    const candidates = [slug, legacySlug].filter((value): value is string => typeof value === "string" && value.length > 0);
    if (candidates.length === 0) return null;
    const marks = candidates.map(() => "?").join(", ");
    const result = getDb().exec(`SELECT Id FROM Prompts WHERE Slug IN (${marks}) ORDER BY Id ASC LIMIT 1`, candidates);
    const value = result[0]?.values[0]?.[0];
    return typeof value === "number" ? value : null;
}

/** Links a prompt to a category via the junction table. */
function linkPromptToCategory(promptId: string, categoryId: string): void {
    if (!categoryId) return;
    const db = getDb();
    try {
        db.run(
            "INSERT OR IGNORE INTO PromptsToCategory (PromptId, CategoryId) VALUES (?, ?)",
            [Number(promptId), Number(categoryId)],
        );
    } catch (linkErr) {
        // Already linked — INSERT OR IGNORE should prevent this, but log debug
        // so unexpected SQL failures (FK violation, schema drift) are recoverable.
        console.debug(`[prompts] linkPromptToCategory(${promptId} → ${categoryId}) skipped:`, linkErr);
    }
}

function parseTagsField(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.map(String).map(t => t.trim()).filter(Boolean);
    if (typeof raw === "string" && raw.trim().length > 0) {
        return raw.split(",").map(t => t.trim()).filter(Boolean);
    }
    return [];
}

function rowToPrompt(row: Record<string, unknown>): PromptEntry {
    const tags = parseTagsField(row.Tags ?? row.tags);
    return {
        id: String(row.Id ?? row.PromptId ?? row.id ?? row.promptId ?? ""),
        name: String(row.Name ?? row.Title ?? row.name ?? row.title ?? ""),
        text: String(row.Text ?? row.Content ?? row.text ?? row.content ?? ""),
        version: String(row.Version ?? row.version ?? "1.0.0"),
        order: Number(row.SortOrder ?? row.sortOrder ?? row.sort_order ?? 0),
        isDefault: (row.IsDefault ?? row.isDefault ?? row.is_default) === 1,
        isFavorite: (row.IsFavorite ?? row.isFavorite ?? row.is_favorite) === 1,
        category: row.Categories ? String(row.Categories) : (row.categories ? String(row.categories) : undefined),
        categories: row.Categories ? String(row.Categories) : (row.categories ? String(row.categories) : undefined),
        tags: tags.length > 0 ? tags : undefined,
        slug: row.Slug ? String(row.Slug) : (row.slug ? String(row.slug) : undefined),
        createdAt: String(row.CreatedAt ?? row.createdAt ?? row.created_at ?? ""),
        updatedAt: String(row.UpdatedAt ?? row.updatedAt ?? row.updated_at ?? ""),
    };
}

/** Reads all prompts using the PromptsDetails view for joined data. */
function queryAllPromptsViaView(): PromptEntry[] {
    const db = getDb();
    try {
        const stmt = db.prepare("SELECT * FROM PromptsDetails ORDER BY SortOrder ASC");
        const results: PromptEntry[] = [];
        while (stmt.step()) {
            results.push(rowToPrompt(stmt.getAsObject()));
        }
        stmt.free();
        return results;
    } catch (viewErr) {
        // View may not exist yet — fall back to direct query
        logSampledDebug(
            BgLogTag.PROMPTS,
            "queryAllPromptsViaView",
            "PromptsDetails view missing — falling back to direct Prompts table query",
            viewErr instanceof Error ? viewErr : String(viewErr),
        );
        return queryAllPromptsDirect();
    }
}

function queryAllPromptsDirect(): PromptEntry[] {
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM Prompts ORDER BY SortOrder ASC");
    const results: PromptEntry[] = [];
    while (stmt.step()) {
        results.push(rowToPrompt(stmt.getAsObject()));
    }
    stmt.free();
    return results;
}

function queryAllCustomPrompts(): PromptEntry[] {
    const db = getDb();
    const stmt = db.prepare("SELECT * FROM Prompts WHERE IsDefault = 0 ORDER BY SortOrder ASC");
    const results: PromptEntry[] = [];
    while (stmt.step()) {
        results.push(rowToPrompt(stmt.getAsObject()));
    }
    stmt.free();
    return results;
}

/* ------------------------------------------------------------------ */
/*  Migration: chrome.storage.local → SQLite                           */
/* ------------------------------------------------------------------ */

async function migrateFromStorageIfNeeded(): Promise<void> {
    if (migrationDone) return;
    migrationDone = true;

    try {
        ensurePromptsTable();
        await seedDefaultPromptsIfEmpty();

        const db = getDb();
        const countResult = db.exec("SELECT COUNT(*) as cnt FROM Prompts WHERE IsDefault = 0");
        const existingCount = countResult.length > 0 ? Number(countResult[0].values[0][0]) : 0;
        if (existingCount > 0) return;

        const localResult = await chrome.storage.local.get(LEGACY_STORAGE_KEY);
        const legacyPrompts = localResult[LEGACY_STORAGE_KEY];
        if (!Array.isArray(legacyPrompts) || legacyPrompts.length === 0) return;

        try {
            const syncResult = await chrome.storage.sync.get(LEGACY_STORAGE_KEY);
            const syncData = syncResult[LEGACY_STORAGE_KEY];
            if (Array.isArray(syncData) && syncData.length > 0 && legacyPrompts.length === 0) {
                for (const prompt of syncData) {
                    insertPromptRow(prompt as PromptEntry);
                }
                await chrome.storage.sync.remove(LEGACY_STORAGE_KEY);
                console.log(`[prompts] Migrated ${syncData.length} prompts from sync → SQLite`);
                markDirty();
                return;
            }
        } catch (syncErr) {
            // chrome.storage.sync may be unavailable (rare in MV3, but possible
            // when sync is disabled at the browser level). Migration falls through.
            console.debug("[prompts] chrome.storage.sync legacy migration unavailable:", syncErr);
        }

        for (const prompt of legacyPrompts) {
            insertPromptRow(prompt as PromptEntry);
        }

        console.log(`[prompts] Migrated ${legacyPrompts.length} prompts from storage.local → SQLite`);
        markDirty();
        await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
    } catch (err) {
        logCaughtError(BgLogTag.PROMPTS, "Migration error", err);
    }
}

// eslint-disable-next-line max-lines-per-function, sonarjs/cognitive-complexity
function insertPromptRow(prompt: PromptEntry): void {
    const db = getDb();
    const now = new Date().toISOString();
    const slug = prompt.slug || prompt.id || undefined;
    const legacySlug = prompt.id && prompt.id !== slug ? prompt.id : undefined;

    // Check if a prompt with this slug already exists (for seeding dedup)
    const existingId = findExistingDefaultPromptId(slug, legacySlug);
    if (existingId !== null) {
            // Already seeded — update instead
            db.run(
                `UPDATE Prompts SET Slug = ?, Name = ?, Text = ?, Version = ?, SortOrder = ?, IsDefault = ?, IsFavorite = ?, UpdatedAt = ? WHERE Id = ?`,
                [bindOpt(slug), bindOpt(prompt.name) ?? "Untitled", bindOpt(prompt.text) ?? "", bindOpt(prompt.version) ?? "1.0.0", prompt.order ?? 0, prompt.isDefault ? 1 : 0, prompt.isFavorite ? 1 : 0, bindOpt(prompt.updatedAt) ?? now, existingId],
            );
            const promptId = String(existingId);
            const category = prompt.category || "";
            if (category) {
                const categoryId = ensureCategoryId(category);
                linkPromptToCategory(promptId, categoryId);
            }
            return;
    }

    db.run(
        `INSERT INTO Prompts (Slug, Name, Text, Version, SortOrder, IsDefault, IsFavorite, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            bindOpt(slug),
            bindOpt(prompt.name) ?? "Untitled",
            bindOpt(prompt.text) ?? "",
            bindOpt(prompt.version) ?? "1.0.0",
            prompt.order ?? 0,
            prompt.isDefault ? 1 : 0,
            prompt.isFavorite ? 1 : 0,
            bindOpt(prompt.createdAt) ?? now,
            bindOpt(prompt.updatedAt) ?? now,
        ],
    );

    const result = db.exec("SELECT last_insert_rowid()");
    const promptId = String(result[0].values[0][0]);

    // Handle category via junction table
    const category = prompt.category || "";
    if (category) {
        const categoryId = ensureCategoryId(category);
        linkPromptToCategory(promptId, categoryId);
    }
}

/* ------------------------------------------------------------------ */
/*  Default prompts seeding                                            */
/* ------------------------------------------------------------------ */

const PROMPTS_SEED_VERSION_KEY = "marco_prompts_seed_version";

/**
 * Seeds default prompts into the Prompts table if:
 * 1. The table is empty (first run), OR
 * 2. The bundled prompts version has changed since last seed.
 *
 * Version is derived from the count + hash of bundled prompt names.
 * This ensures re-seeding happens on extension updates that add/change prompts,
 * but NOT on every startup.
 */
async function seedDefaultPromptsIfEmpty(): Promise<void> {
    const db = getDb();
    const countResult = db.exec("SELECT COUNT(*) FROM Prompts");
    const count = countResult.length > 0 ? Number(countResult[0].values[0][0]) : 0;

    const defaults = (await loadBundledDefaultPrompts()) ?? getFallbackDefaultPrompts();
    const bundledVersion = computeBundledVersion(defaults);

    if (count === 0) {
        // First run — seed everything
        console.log("[prompts] Prompts table empty — seeding defaults...");
        for (const prompt of defaults) {
            insertPromptRow(prompt);
        }
        markDirty();
        await chrome.storage.local.set({ [PROMPTS_SEED_VERSION_KEY]: bundledVersion });
        console.log(`[prompts] Seeded ${defaults.length} default prompts (version: ${bundledVersion})`);
        return;
    }

    // Check if bundled version changed
    const stored = await chrome.storage.local.get(PROMPTS_SEED_VERSION_KEY);
    const storedVersion = stored[PROMPTS_SEED_VERSION_KEY] as string | undefined;

    if (storedVersion === bundledVersion) {
        return; // No change — skip re-seeding
    }

    console.log(`[prompts] Bundled prompts version changed (${storedVersion ?? "none"} → ${bundledVersion}) — re-seeding defaults...`);

    // Re-seed: upsert defaults (insertPromptRow handles slug-based dedup)
    for (const prompt of defaults) {
        insertPromptRow(prompt);
    }
    markDirty();
    await chrome.storage.local.set({ [PROMPTS_SEED_VERSION_KEY]: bundledVersion });
    console.log(`[prompts] Re-seeded ${defaults.length} default prompts (version: ${bundledVersion})`);
}

/** Compute a version string from bundled prompts for change detection.
 *  Includes text length in the signature so text-only changes trigger re-seeding. */
function computeBundledVersion(prompts: PromptEntry[]): string {
    const signature = prompts
        .map((p) => `${p.id ?? ""}:${p.name}:${p.version ?? "1.0.0"}:${(p.text ?? "").length}`)
        .join("|");
    // Simple hash
    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
        hash = ((hash << 5) - hash + signature.charCodeAt(i)) | 0;
    }
    return `${prompts.length}-${(hash >>> 0).toString(36)}`;
}

function getFallbackDefaultPrompts(): PromptEntry[] {
    const now = new Date().toISOString();
    return getBundledFallbackEntries()
        .map((entry, index) => mapRawToPromptEntry(entry, index, now))
        .filter((entry): entry is PromptEntry => entry !== null);
}
let bundledDefaultsCache: PromptEntry[] | null = null;

interface RawDefaultPromptEntry {
    id?: string;
    slug?: string;
    name?: string;
    text?: string;
    version?: string;
    order?: number;
    isDefault?: boolean;
    isFavorite?: boolean;
    category?: string;
}

function getBundledFallbackEntries(): RawDefaultPromptEntry[] {
    const bundle = bundledPromptBundle as { prompts?: RawDefaultPromptEntry[] };
    return Array.isArray(bundle.prompts) ? bundle.prompts : [];
}

function mapRawToPromptEntry(entry: RawDefaultPromptEntry, index: number, now: string): PromptEntry | null {
    const name = typeof entry.name === "string" ? entry.name : "";
    const text = typeof entry.text === "string" ? entry.text : "";
    if (!name || !text) return null;
    const fallbackSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const rawSlug = typeof entry.slug === "string" && entry.slug ? entry.slug : fallbackSlug;
    const id = typeof entry.id === "string" && entry.id ? entry.id : `default-${rawSlug || index}`;
    const category = typeof entry.category === "string" && entry.category ? entry.category : undefined;
    const prompt: PromptEntry = {
        id,
        name,
        text,
        order: typeof entry.order === "number" ? entry.order : index,
        isDefault: entry.isDefault !== false,
        isFavorite: entry.isFavorite === true,
        createdAt: now,
        updatedAt: now,
    };
    if (rawSlug) prompt.slug = rawSlug;
    if (typeof entry.version === "string" && entry.version) prompt.version = entry.version;
    if (category) prompt.category = category;
    return prompt;
}

export async function loadBundledDefaultPrompts(): Promise<PromptEntry[] | null> {
    if (bundledDefaultsCache !== null) return bundledDefaultsCache;

    try {
        const url = chrome.runtime.getURL("prompts/macro-prompts.json");
        const response = await fetch(url);
        if (!response.ok) {
            // HEFF: bundled asset missing/mis-served. No retry; log and return null.
            logSampledDebug(
                BgLogTag.PROMPTS,
                "loadBundledDefaults",
                `HEFF: HTTP ${response.status} on GET ${url} — bundled prompts missing. Loop halted.`,
            );
            return mapBundledFallbackDefaults();
        }

        const parsed = await response.json() as { prompts?: RawDefaultPromptEntry[] } | RawDefaultPromptEntry[];
        const rawEntries: RawDefaultPromptEntry[] = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed.prompts) ? parsed.prompts : []);

        const now = new Date().toISOString();
        const defaults = rawEntries
            .map((entry, index) => mapRawToPromptEntry(entry, index, now))
            .filter((entry): entry is PromptEntry => entry !== null);

        if (defaults.length === 0) return mapBundledFallbackDefaults();
        bundledDefaultsCache = defaults;
        return defaults;
    } catch (defaultsErr) {
        logSampledDebug(
            BgLogTag.PROMPTS,
            "loadBundledDefaults",
            "Failed to load bundled default prompts JSON — caller will fall back to seeded DB rows",
            defaultsErr instanceof Error ? defaultsErr : String(defaultsErr),
        );
        return mapBundledFallbackDefaults();
    }
}

function mapBundledFallbackDefaults(): PromptEntry[] | null {
    const now = new Date().toISOString();
    const defaults = getBundledFallbackEntries()
        .map((entry, index) => mapRawToPromptEntry(entry, index, now))
        .filter((entry): entry is PromptEntry => entry !== null);
    bundledDefaultsCache = defaults.length > 0 ? defaults : null;
    return bundledDefaultsCache;
}

export async function handleGetPrompts(): Promise<{ prompts: PromptEntry[] }> {
    await migrateFromStorageIfNeeded();

    // All prompts (defaults + custom) are now in the DB — read via view
    const prompts = queryAllPromptsViaView();
    return { prompts };
}

// eslint-disable-next-line max-lines-per-function, sonarjs/cognitive-complexity
export async function handleSavePrompt(payload: { prompt: Partial<PromptEntry> }): Promise<{ isOk: true; prompt: PromptEntry }> {
    await migrateFromStorageIfNeeded();

    const input = payload;
    const now = new Date().toISOString();
    const db = getDb();

    // Check if updating an existing prompt (id is an integer string)
    let promptId = input.prompt.id;
    let exists = false;
    if (promptId) {
        const existingResult = db.exec("SELECT Id FROM Prompts WHERE Id = ?", [Number(promptId)]);
        exists = existingResult.length > 0 && existingResult[0].values.length > 0;
    }

    if (exists && promptId) {
        const setClauses: string[] = [];
        const values: (string | number)[] = [];

        if (input.prompt.name !== undefined) { setClauses.push("Name = ?"); values.push(input.prompt.name); }
        if (input.prompt.text !== undefined) { setClauses.push("Text = ?"); values.push(input.prompt.text); }
        if (input.prompt.order !== undefined) { setClauses.push("SortOrder = ?"); values.push(input.prompt.order); }
        if (input.prompt.isFavorite !== undefined) { setClauses.push("IsFavorite = ?"); values.push(input.prompt.isFavorite ? 1 : 0); }
        if (input.prompt.tags !== undefined) { setClauses.push("Tags = ?"); values.push(parseTagsField(input.prompt.tags).join(", ")); }
        setClauses.push("UpdatedAt = ?"); values.push(now);
        values.push(Number(promptId));

        db.run(`UPDATE Prompts SET ${setClauses.join(", ")} WHERE Id = ?`, values);

        // Update category via junction table if provided
        if (input.prompt.category !== undefined) {
            db.run("DELETE FROM PromptsToCategory WHERE PromptId = ?", [Number(promptId)]);
            if (input.prompt.category) {
                const categoryId = ensureCategoryId(input.prompt.category);
                linkPromptToCategory(promptId, categoryId);
            }
        }
    } else {
        db.run(
            `INSERT INTO Prompts (Name, Text, Version, SortOrder, IsDefault, IsFavorite, Tags, CreatedAt, UpdatedAt)
             VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
            [
                bindOpt(input.prompt.name) ?? "Untitled Prompt",
                bindOpt(input.prompt.text) ?? "",
                bindOpt(input.prompt.version) ?? "1.0.0",
                input.prompt.order ?? 0,
                input.prompt.isFavorite ? 1 : 0,
                parseTagsField(input.prompt.tags).join(", "),
                now,
                now,
            ],
        );

        const result = db.exec("SELECT last_insert_rowid()");
        promptId = String(result[0].values[0][0]);

        // Link category
        if (input.prompt.category) {
            const categoryId = ensureCategoryId(input.prompt.category);
            linkPromptToCategory(promptId, categoryId);
        }
    }

    markDirty();

    const saved = db.exec("SELECT * FROM Prompts WHERE Id = ?", [Number(promptId)]);
    const row = saved.length > 0 && saved[0].values.length > 0
        ? Object.fromEntries(saved[0].columns.map((col, i) => [col, saved[0].values[0][i]]))
        : { Id: Number(promptId), Name: input.prompt.name ?? "Untitled", Text: input.prompt.text ?? "", SortOrder: 0, IsDefault: 0, IsFavorite: 0, CreatedAt: now, UpdatedAt: now };

    return { isOk: true, prompt: rowToPrompt(row) };
}

export async function handleDeletePrompt(payload: { promptId: string }): Promise<{ isOk: true } | HandlerErrorResponse> {
    await migrateFromStorageIfNeeded();

    const promptIdStr = requireField(payload?.promptId);
    if (promptIdStr === null) return missingFieldError("promptId", "DELETE_PROMPT");

    const numId = Number(promptIdStr);
    if (!Number.isFinite(numId)) return missingFieldError("promptId (numeric)", "DELETE_PROMPT");

    const candidate = getDeletePromptCandidate(numId);
    if (candidate === null) return promptDeleteError(numId, "not found");
    if (candidate.isDefault) return promptDeleteError(numId, "default prompts cannot be deleted", candidate.name);

    const db = getDb();
    db.run("DELETE FROM PromptsToCategory WHERE PromptId = ?", [numId]);
    db.run("DELETE FROM Prompts WHERE Id = ?", [numId]);
    if (db.getRowsModified() < 1) return promptDeleteError(numId, "no rows deleted", candidate.name);
    markDirty();
    return { isOk: true };
}

function getDeletePromptCandidate(promptId: number): DeletePromptCandidate | null {
    const result = getDb().exec("SELECT Name, IsDefault FROM Prompts WHERE Id = ?", [promptId]);
    const firstResult = result[0];
    const firstRow = firstResult?.values[0];
    if (firstRow === undefined) return null;
    return { name: String(firstRow[0] ?? ""), isDefault: Number(firstRow[1] ?? 0) === 1 };
}

function promptDeleteError(promptId: number, reason: string, name = ""): HandlerErrorResponse {
    const message = `[DB_WRITE_E004][DELETE_PROMPT] Delete failed for prompt id=${promptId} name="${name}": ${reason}`;
    logBgError(BgLogTag.PROMPTS, "DB_WRITE_E004", message, undefined, { contextDetail: message });
    return { isOk: false, errorMessage: message };
}

export async function handleReorderPrompts(payload: { promptIds: string[] }): Promise<{ isOk: true } | HandlerErrorResponse> {
    await migrateFromStorageIfNeeded();

    const promptIds = Array.isArray(payload?.promptIds) ? payload.promptIds : null;
    if (promptIds === null) return missingFieldError("promptIds (array)", "REORDER_PROMPTS");

    const db = getDb();

    for (let i = 0; i < promptIds.length; i++) {
        const id = requireField(promptIds[i]);
        if (id === null) continue; // skip invalid entries instead of crashing
        const numId = Number(id);
        if (!Number.isFinite(numId)) continue;
        db.run("UPDATE Prompts SET SortOrder = ? WHERE Id = ?", [i, numId]);
    }

    markDirty();
    return { isOk: true };
}

/** Reseed prompts: clears all and re-inserts defaults. Updates version key. */
export async function reseedPrompts(): Promise<void> {
    ensurePromptsTable();
    const db = getDb();
    db.run("DELETE FROM PromptsToCategory");
    db.run("DELETE FROM Prompts");
    db.run("DELETE FROM PromptsCategory");

    bundledDefaultsCache = null;
    const defaults = (await loadBundledDefaultPrompts()) ?? getFallbackDefaultPrompts();
    for (const prompt of defaults) {
        insertPromptRow(prompt);
    }
    markDirty();

    // Update seed version so version-based seeding won't re-trigger
    const bundledVersion = computeBundledVersion(defaults);
    await chrome.storage.local.set({ [PROMPTS_SEED_VERSION_KEY]: bundledVersion });

    console.log(`[prompts] Reseeded ${defaults.length} default prompts (version: ${bundledVersion})`);
}

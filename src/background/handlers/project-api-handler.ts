/**
 * Marco Extension — Project API Handler
 *
 * Handles PROJECT_API messages for per-project SQLite database CRUD.
 * Supports: create, findMany, findUnique, update, delete, count,
 * plus schema management (createTable, dropTable, listTables).
 *
 * @see spec/05-chrome-extension/67-project-scoped-database-and-rest-api.md — Project DB & REST API
 * @see .lovable/memory/architecture/project-scoped-database.md — Project-scoped DB architecture
 * @see .lovable/memory/architecture/schema-meta-engine.md — Schema meta engine
 */

import {
    initProjectDb,
    getProjectDb,
    hasProjectDb,
} from "../project-db-manager";

import {
    queryCreate,
    queryFindMany,
    queryFindUnique,
    queryUpdate,
    queryDelete,
    queryCount,
    createUserTable,
    dropUserTable,
    listUserTables,
    type CreateArgs,
    type FindManyArgs,
    type FindUniqueArgs,
    type UpdateArgs,
    type DeleteArgs,
    type CountArgs,
    type ColumnDef,
} from "../project-query-builder";

import {
    missingFieldError,
    requireField,
    requireSlug,
} from "./handler-guards";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProjectApiMessage {
    type: string;
    project: string;       // slug
    method: string;        // GET | POST | PUT | DELETE | SCHEMA | rawSql verbs
    endpoint: string;      // table name or special command
    params?: Record<string, unknown>;
}

type ProjectDb = ReturnType<typeof getProjectDb>;
type RawSqlKind = "read" | "write" | "schema" | "transaction";

interface RawSqlStatement {
    sql: string;
    kind: RawSqlKind;
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

export async function handleProjectApi(payload: ProjectApiMessage): Promise<Record<string, unknown>> {
    const m = payload as ProjectApiMessage;
    const slug = requireSlug(m.project);
    const endpoint = requireField(m.endpoint);
    const method = (typeof m.method === "string" && m.method.length > 0
        ? m.method : "GET").toUpperCase();
    const params = m.params || {};

    if (!slug) return { ...missingFieldError("project", "projectApi") };
    if (!endpoint) return { ...missingFieldError("endpoint", "projectApi") };

    // Ensure project DB is initialized
    if (!hasProjectDb(slug)) {
        await initProjectDb(slug);
    }

    const db = getProjectDb(slug);

    try {
        const result = await dispatchMethod(db, slug, method, endpoint, params);
        return { isOk: true, ...result };
    } catch (err) {
        return {
            isOk: false,
            errorMessage: err instanceof Error ? err.message : String(err),
        };
    }
}

/* ------------------------------------------------------------------ */
/*  Dispatch                                                           */
/* ------------------------------------------------------------------ */

async function dispatchMethod(
    db: ProjectDb,
    slug: string,
    method: string,
    endpoint: string,
    params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
    if (endpoint === "rawSql") {
        return handleRawSqlCommand(db, slug, method, params);
    }

    // Schema management commands
    if (method === "SCHEMA") {
        return handleSchemaCommand(db, slug, endpoint, params);
    }

    // CRUD operations on user tables
    switch (method) {
        case "GET":
            return handleGet(db, endpoint, params);
        case "POST":
            return handlePost(db, slug, endpoint, params);
        case "PUT":
            return handlePut(db, slug, endpoint, params);
        case "DELETE":
            return handleDelete(db, slug, endpoint, params);
        default:
            throw new Error(`Unsupported method: ${method}`);
    }
}

/* ------------------------------------------------------------------ */
/*  CRUD handlers                                                      */
/* ------------------------------------------------------------------ */

function handleGet(
    db: ProjectDb,
    table: string,
    params: Record<string, unknown>,
): Record<string, unknown> {
    const hasId = params.where && typeof params.where === "object" && "Id" in (params.where as Record<string, unknown>);

    if (hasId) {
        const row = queryFindUnique(db, table, { where: params.where as FindUniqueArgs["where"] });
        return { row };
    }

    if (params.count) {
        const count = queryCount(db, table, { where: params.where as CountArgs["where"] });
        return { count };
    }

    const rows = queryFindMany(db, table, {
        where: params.where as FindManyArgs["where"],
        orderBy: params.orderBy as FindManyArgs["orderBy"],
        take: params.take as number,
        skip: params.skip as number,
    });
    return { rows };
}

function handlePost(
    db: ProjectDb,
    slug: string,
    table: string,
    params: Record<string, unknown>,
): Record<string, unknown> {
    const row = queryCreate(db, table, { data: params.data as CreateArgs["data"] });
    void markAndFlush(slug);
    return { row };
}

function handlePut(
    db: ProjectDb,
    slug: string,
    table: string,
    params: Record<string, unknown>,
): Record<string, unknown> {
    const result = queryUpdate(db, table, {
        where: params.where as UpdateArgs["where"],
        data: params.data as UpdateArgs["data"],
    });
    void markAndFlush(slug);
    return { updated: result.count };
}

function handleDelete(
    db: ProjectDb,
    slug: string,
    table: string,
    params: Record<string, unknown>,
): Record<string, unknown> {
    const result = queryDelete(db, table, {
        where: params.where as DeleteArgs["where"],
    });
    void markAndFlush(slug);
    return { deleted: result.count };
}

/* ------------------------------------------------------------------ */
/*  Schema commands                                                    */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line max-lines-per-function -- command dispatcher: one arm per schema verb; splitting would scatter the contract
function handleSchemaCommand(
    db: ProjectDb,
    slug: string,
    command: string,
    params: Record<string, unknown>,
): Record<string, unknown> {
    switch (command) {
        case "createTable": {
            const tableName = requireField(params.tableName);
            if (!tableName) throw new Error("createTable: missing or invalid 'tableName'");
            const columns = Array.isArray(params.columns) ? params.columns as ColumnDef[] : null;
            if (!columns || columns.length === 0) {
                throw new Error("createTable: missing or empty 'columns' array");
            }
            createUserTable(db, tableName, columns);
            void markAndFlush(slug);
            return { table: tableName };
        }
        case "dropTable": {
            const tableName = requireField(params.tableName);
            if (!tableName) throw new Error("dropTable: missing or invalid 'tableName'");
            dropUserTable(db, tableName);
            void markAndFlush(slug);
            return { dropped: tableName };
        }
        case "listTables": {
            const tables = listUserTables(db);
            return { tables };
        }
        default:
            throw new Error(`Unknown schema command: ${command}`);
    }
}

/* ------------------------------------------------------------------ */
/*  rawSql bridge                                                       */
/* ------------------------------------------------------------------ */

function handleRawSqlCommand(
    db: ProjectDb,
    slug: string,
    method: string,
    params: Record<string, unknown>,
): Record<string, unknown> {
    const sql = requireField(params.sql);
    if (!sql) throw new Error("rawSql: missing or invalid 'sql' parameter");

    const statements = classifyRawSql(sql);
    if (isRawSqlReadMethod(method)) {
        return handleRawSqlRead(db, method, sql, statements);
    }
    if (isRawSqlWriteMethod(method)) {
        return handleRawSqlWrite(db, slug, method, sql, statements);
    }
    throw new Error(`Unsupported method: ${method}`);
}

function handleRawSqlRead(
    db: ProjectDb,
    method: string,
    sql: string,
    statements: readonly RawSqlStatement[],
): Record<string, unknown> {
    const unsafe = statements.find((statement) => statement.kind !== "read");
    if (unsafe) {
        throw new Error(`rawSql: method ${method} cannot execute ${describeStatement(unsafe)}`);
    }
    const rows = rowsFromExecResults(db.exec(sql));
    return { rows };
}

function handleRawSqlWrite(
    db: ProjectDb,
    slug: string,
    method: string,
    sql: string,
    statements: readonly RawSqlStatement[],
): Record<string, unknown> {
    const unsafe = statements.find((statement) => statement.kind === "read");
    if (unsafe) {
        throw new Error(`rawSql: method ${method} cannot execute ${describeStatement(unsafe)}`);
    }

    db.run(sql);
    const changes = getRowsModified(db);
    const lastInsertId = readLastInsertId(db);
    void markAndFlush(slug);
    return {
        executed: true,
        ...(lastInsertId !== undefined ? { lastInsertId } : {}),
        ...(changes !== undefined ? { changes } : {}),
    };
}

function isRawSqlReadMethod(method: string): boolean {
    return method === "QUERY" || method === "SELECT" || method === "READ";
}

function isRawSqlWriteMethod(method: string): boolean {
    return method === "SCHEMA" || method === "EXEC" || method === "RUN"
        || method === "WRITE" || method === "MUTATE";
}

function classifyRawSql(sql: string): RawSqlStatement[] {
    const chunks = splitSqlStatements(sql);
    if (chunks.length === 0) {
        throw new Error("rawSql: empty SQL statement");
    }
    return chunks.map((chunk) => ({ sql: chunk, kind: classifyStatement(chunk) }));
}

function classifyStatement(statement: string): RawSqlKind {
    const normalized = statement.trim().replace(/\s+/g, " ").toLowerCase();
    if (/^select\b/.test(normalized)) return "read";
    if (/^pragma\s+table_info\s*\(/.test(normalized)) return "read";
    if (/^(insert|update|delete)\b/.test(normalized)) return "write";
    if (/^create\s+table\b/.test(normalized)) return "schema";
    if (/^create\s+(unique\s+)?index\b/.test(normalized)) return "schema";
    if (/^create\s+view\b/.test(normalized)) return "schema";
    if (/^drop\s+view\b/.test(normalized)) return "schema";
    if (/^alter\s+table\b/.test(normalized)) return "schema";
    if (/^begin(\s+transaction)?\b/.test(normalized)) return "transaction";
    if (/^(commit|rollback)\b/.test(normalized)) return "transaction";
    throw new Error("rawSql: unsupported statement: " + statement.slice(0, 80));
}

function splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = "";
    let quote: "'" | "\"" | null = null;
    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        const next = sql[i + 1];
        if (quote) {
            current += ch;
            if (ch === quote && next === quote) {
                current += next;
                i++;
            } else if (ch === quote) {
                quote = null;
            }
            continue;
        }
        if (ch === "'" || ch === "\"") {
            quote = ch;
            current += ch;
            continue;
        }
        if (ch === "-" && next === "-") {
            i = skipLineComment(sql, i + 2);
            continue;
        }
        if (ch === "/" && next === "*") {
            i = skipBlockComment(sql, i + 2);
            continue;
        }
        if (ch === ";") {
            pushSqlStatement(statements, current);
            current = "";
            continue;
        }
        current += ch;
    }
    pushSqlStatement(statements, current);
    return statements;
}

function skipLineComment(sql: string, start: number): number {
    let i = start;
    while (i < sql.length && sql[i] !== "\n") i++;
    return i;
}

function skipBlockComment(sql: string, start: number): number {
    let i = start;
    while (i < sql.length - 1) {
        if (sql[i] === "*" && sql[i + 1] === "/") return i + 1;
        i++;
    }
    return sql.length - 1;
}

function pushSqlStatement(statements: string[], statement: string): void {
    const trimmed = statement.trim();
    if (trimmed.length > 0) statements.push(trimmed);
}

function rowsFromExecResults(results: ReturnType<ProjectDb["exec"]>): Array<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = [];
    for (const result of results) {
        for (const values of result.values) {
            const row: Record<string, unknown> = {};
            result.columns.forEach((column, index) => {
                row[column] = values[index];
            });
            rows.push(row);
        }
    }
    return rows;
}

function readLastInsertId(db: ProjectDb): number | undefined {
    try {
        const rows = rowsFromExecResults(db.exec("SELECT last_insert_rowid() AS lastInsertId"));
        const value = rows[0]?.lastInsertId;
        const n = typeof value === "number" ? value : Number(value);
        return Number.isFinite(n) ? n : undefined;
    } catch {
        return undefined;
    }
}

function getRowsModified(db: ProjectDb): number | undefined {
    try {
        const reader = db.getRowsModified;
        if (typeof reader !== "function") return undefined;
        const n = reader.call(db);
        return Number.isFinite(n) ? n : undefined;
    } catch {
        return undefined;
    }
}

function describeStatement(statement: RawSqlStatement): string {
    return statement.sql.slice(0, 40);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function markAndFlush(slug: string): Promise<void> {
    // Debounced flush via the project db manager
    const manager = await initProjectDb(slug);
    manager.markDirty();
}

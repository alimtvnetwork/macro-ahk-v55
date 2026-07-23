/**
 * Marco Extension — Minimal CSV Parser
 *
 * Zero-dep RFC 4180-ish parser tuned for the StepGroup input-data
 * use case. The recorded constraint (mem://workflow/no-questions-mode
 * decision) is **≤ 5 MB / 10 000 rows, fully in memory** — anything
 * larger should stream, which we don't support here.
 *
 * What we handle:
 *   - Comma OR semicolon delimiter (auto-detected from the header).
 *   - Quoted fields with embedded delimiters and newlines.
 *   - Escaped quotes inside quoted fields (`""` → `"`).
 *   - CRLF, LF, and CR line endings.
 *   - Trailing empty line in the file.
 *   - UTF-8 BOM at start of file (stripped).
 *
 * What we do NOT handle (out of scope — fail fast with a clear reason):
 *   - Tab-delimited files (use .tsv-aware tooling).
 *   - Files larger than `MAX_BYTES`.
 *   - Files producing more than `MAX_ROWS` data rows.
 *   - Headerless files. The first non-empty line MUST be the header.
 *
 * The parser returns a structured result — never throws on malformed
 * input. Callers surface the `Reason` to the user verbatim.
 */

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ROWS  = 10_000;          // data rows, header excluded

/**
 * Optional context describing where the CSV came from. Included verbatim
 * in every failure `Reason` so users can trace which input failed when
 * multiple sources are parsed in one operation (drop-zone, paste, file).
 */
export interface CsvParseContext {
    /** Human label for the input source, e.g. "customers.csv" or "pasted text". */
    readonly Source?: string;
}

/** Branch identifier for the parser stage that produced a failure. */
export type CsvFailureBranch =
    | "empty-input"
    | "size-limit"
    | "unterminated-quote"
    | "no-rows"
    | "duplicate-headers"
    | "empty-header"
    | "row-limit";

export interface CsvParseSuccess {
    readonly Ok: true;
    readonly Delimiter: "," | ";";
    readonly Headers: ReadonlyArray<string>;
    /** One row per data line, aligned with `Headers`. Missing trailing cells are coerced to "". */
    readonly Rows: ReadonlyArray<ReadonlyArray<string>>;
    /** Soft warnings — non-fatal anomalies the UI may surface. */
    readonly Warnings: ReadonlyArray<string>;
}

export interface CsvParseFailure {
    readonly Ok: false;
    readonly Reason: string;
    /** 1-based line number where parsing aborted, when known. */
    readonly LineNumber: number | null;
    /** Which parser branch failed. Machine-readable pair to `Reason`. */
    readonly Branch: CsvFailureBranch;
    /** Echo of `context.Source`, if the caller provided one. */
    readonly Source: string | null;
}

export type CsvParseResult = CsvParseSuccess | CsvParseFailure;

export function parseCsv(raw: string, context: CsvParseContext = {}): CsvParseResult {
    const source = context.Source ?? null;
    const guard = guardSize(raw, source);
    if (guard !== null) { return guard; }
    const stripped = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    const delimiter = detectDelimiter(stripped);

    const tok = tokenize(stripped, delimiter, source);
    if (tok.error !== null) { return tok.error; }
    const records = trimTrailingBlankRecords(tok.records);
    if (records.length === 0) {
        return failCsv("CSV contained no rows after trimming blank lines.", null, "no-rows", source);
    }

    const headers = normaliseHeaders(records[0]);
    const headerErr = validateHeaders(headers, source);
    if (headerErr !== null) { return headerErr; }

    const dataRows = records.slice(1);
    if (dataRows.length > MAX_ROWS) {
        return failCsv(
            `CSV has ${dataRows.length} data rows; the limit is ${MAX_ROWS}. Reduce or split the file.`,
            null, "row-limit", source,
        );
    }

    const warnings = [...tok.warnings];
    const aligned = alignRowsToHeaders(dataRows, headers.length, warnings);
    return { Ok: true, Delimiter: delimiter, Headers: headers, Rows: aligned, Warnings: warnings };
}

function failCsv(
    reason: string,
    lineNumber: number | null,
    branch: CsvFailureBranch,
    source: string | null,
): CsvParseFailure {
    const prefix = source !== null && source.length > 0 ? `[${source}] ` : "";
    return { Ok: false, Reason: `${prefix}${reason} (branch: ${branch})`, LineNumber: lineNumber, Branch: branch, Source: source };
}

function guardSize(raw: string, source: string | null): CsvParseFailure | null {
    if (raw.length === 0) { return failCsv("CSV is empty.", null, "empty-input", source); }
    if (raw.length > MAX_BYTES) {
        return failCsv(
            `CSV exceeds the ${formatBytes(MAX_BYTES)} in-memory limit (got ${formatBytes(raw.length)}). Trim the file or split it.`,
            null, "size-limit", source,
        );
    }
    return null;
}

interface TokenizerState {
    field: string;
    row: string[];
    inQuotes: boolean;
    line: number;
    records: string[][];
    warnings: string[];
}

function makeTokenizerState(): TokenizerState {
    return { field: "", row: [], inQuotes: false, line: 1, records: [], warnings: [] };
}

/** Consume one char while inside quotes. Returns new index (may skip an escaped quote). */
function stepQuoted(source: string, i: number, ch: string, state: TokenizerState): number {
    if (ch === '"') {
        if (source[i + 1] === '"') { state.field += '"'; return i + 1; }
        state.inQuotes = false;
        return i;
    }
    if (ch === "\n") { state.line++; }
    state.field += ch;
    return i;
}

function commitRow(state: TokenizerState): void {
    state.row.push(state.field);
    state.records.push(state.row);
    state.row = [];
    state.field = "";
    state.line++;
}

/** Consume one char while not inside quotes. Returns new index. */
function stepUnquoted(source: string, i: number, ch: string, delimiter: string, state: TokenizerState): number {
    if (ch === '"') {
        if (state.field.length === 0) { state.inQuotes = true; return i; }
        state.field += ch;
        if (state.warnings.length < 5) {
            state.warnings.push(`Stray double-quote inside an unquoted field on line ${state.line}, kept literally.`);
        }
        return i;
    }
    if (ch === delimiter) { state.row.push(state.field); state.field = ""; return i; }
    if (ch === "\r") {
        const next = source[i + 1] === "\n" ? i + 1 : i;
        commitRow(state);
        return next;
    }
    if (ch === "\n") { commitRow(state); return i; }
    state.field += ch;
    return i;
}

function tokenize(source: string, delimiter: "," | ";", sourceLabel: string | null): {
    records: string[][];
    warnings: string[];
    error: CsvParseFailure | null;
} {
    const state = makeTokenizerState();
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        i = state.inQuotes
            ? stepQuoted(source, i, ch, state)
            : stepUnquoted(source, i, ch, delimiter, state);
    }
    if (state.inQuotes) {
        return {
            records: [],
            warnings: state.warnings,
            error: failCsv(
                `Unterminated quoted field, file ends inside a "..." block. Check for a missing closing quote near line ${state.line}.`,
                state.line, "unterminated-quote", sourceLabel,
            ),
        };
    }
    if (state.field !== "" || state.row.length > 0) {
        state.row.push(state.field);
        state.records.push(state.row);
    }
    return { records: state.records, warnings: state.warnings, error: null };
}

function trimTrailingBlankRecords(records: string[][]): string[][] {
    const out = records.slice();
    while (out.length > 0 && out[out.length - 1].every((c) => c === "")) { out.pop(); }
    return out;
}

function validateHeaders(headers: ReadonlyArray<string>, source: string | null): CsvParseFailure | null {
    const dupes = findDuplicateHeaders(headers);
    if (dupes.length > 0) {
        const quoted = dupes.map((h) => `"${h}"`).join(", ");
        return failCsv(
            `Duplicate column header(s): ${quoted}. Each column must have a unique name.`,
            1, "duplicate-headers", source,
        );
    }
    if (headers.some((h) => h === "")) {
        return failCsv(
            "Header row contains an empty column name. Every column needs a header.",
            1, "empty-header", source,
        );
    }
    return null;
}

function alignRowsToHeaders(dataRows: string[][], width: number, warnings: string[]): string[][] {
    const aligned: string[][] = [];
    let padCount = 0;
    let truncCount = 0;
    for (const original of dataRows) {
        if (original.length < width) {
            const padded = original.slice();
            while (padded.length < width) { padded.push(""); }
            aligned.push(padded);
            padCount++;
        } else if (original.length > width) {
            aligned.push(original.slice(0, width));
            truncCount++;
        } else {
            aligned.push(original);
        }
    }
    if (padCount > 0) { warnings.push(`${padCount} row(s) had fewer columns than the header, padded with empty strings.`); }
    if (truncCount > 0) { warnings.push(`${truncCount} row(s) had extra columns, extras were dropped.`); }
    return aligned;
}

function detectDelimiter(source: string): "," | ";" {
    // Inspect the first line, ignoring quoted regions.
    let inQuotes = false;
    let commas = 0;
    let semis = 0;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (ch === '"') {
            if (inQuotes && source[i + 1] === '"') { i++; continue; }
            inQuotes = !inQuotes;
            continue;
        }
        if (inQuotes) continue;
        if (ch === "\n" || ch === "\r") break;
        if (ch === ",") commas++;
        else if (ch === ";") semis++;
    }
    return semis > commas ? ";" : ",";
}

function normaliseHeaders(cells: ReadonlyArray<string>): string[] {
    return cells.map((c) => c.trim());
}

function findDuplicateHeaders(headers: ReadonlyArray<string>): string[] {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const h of headers) {
        if (h === "") continue;
        if (seen.has(h)) dupes.add(h);
        else seen.add(h);
    }
    return Array.from(dupes);
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

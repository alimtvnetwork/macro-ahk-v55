/**
 * Prompt table configurable-token defaults (plan-15 tasks 1-2).
 *
 * Extracted into their own module per coding-guidelines rule #9 so
 * seeder, CRUD, UI, and schema migration all reference the same source.
 * These defaults keep cold-boot behaviour byte-identical to plan-14
 * (hardcoded `{{n}}` + chip set 1,2,3,5,8) while unlocking per-row
 * customization in later tasks.
 */

/** Default placeholder token key. Body substitution matches `{{n}}` / `${n}`. */
export const REPLACE_KEY_DEFAULT = 'n';

/** Default N-option chip values, JSON-encoded for SQLite TEXT storage. */
export const REPLACE_VALUES_DEFAULT_JSON = '["1","2","3","5","8"]';

/** Runtime array form of the default N-option chips. */
export const REPLACE_VALUES_DEFAULT: readonly string[] = ['1', '2', '3', '5', '8'];

/** Column names for the two plan-15 migration steps. */
export const PROMPT_REPLACE_KEY_COLUMN = 'ReplaceKey';
export const PROMPT_REPLACE_VALUES_COLUMN = 'ReplaceValues';

/**
 * Accepted syntax for a replace-token key: leading letter/underscore, then
 * up to 31 word chars. Matches identifier shape of the runtime substitution
 * helpers (both `{{key}}` and `${key}` forms).
 */
export const REPLACE_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;

/** Validate a candidate replace-token key. Returns null on success or an error message. */
export function validateReplaceKey(key: string): string | null {
    if (typeof key !== 'string') return 'replaceKey must be a string';
    if (!REPLACE_KEY_RE.test(key)) return 'replaceKey must match ' + REPLACE_KEY_RE.source;
    return null;
}

/**
 * Normalize a replace-values list: trim, drop empties, dedupe preserving
 * order. Returns null when the resulting list is empty (invalid input).
 */
export function normalizeReplaceValues(input: readonly unknown[]): string[] | null {
    if (!Array.isArray(input)) return null;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of input) {
        if (typeof raw !== 'string') continue;
        const trimmed = raw.trim();
        if (trimmed === '' || seen.has(trimmed)) continue;
        seen.add(trimmed);
        out.push(trimmed);
    }
    return out.length > 0 ? out : null;
}

/** Encode replace-values array to SQLite TEXT JSON storage form. */
export function encodeReplaceValues(values: readonly string[]): string {
    return JSON.stringify(values);
}

/** Decode SQLite TEXT storage back to array, falling back to defaults on any parse error. */
export function decodeReplaceValues(raw: unknown): string[] {
    if (typeof raw !== 'string' || raw.trim() === '') return [...REPLACE_VALUES_DEFAULT];
    try {
        const parsed = JSON.parse(raw);
        const normalized = normalizeReplaceValues(Array.isArray(parsed) ? parsed : []);
        return normalized ?? [...REPLACE_VALUES_DEFAULT];
    } catch {
        return [...REPLACE_VALUES_DEFAULT];
    }
}

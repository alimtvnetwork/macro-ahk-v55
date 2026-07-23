/**
 * Plan-15 Task 9: Resolve the chip-value list for a given prompt role from
 * the database (`Prompt.ReplaceValues`), falling back to the caller-supplied
 * legacy list on any miss.
 *
 * The DB column stores JSON-encoded strings; chips are numeric N-selectors,
 * so entries that fail to parse as positive integers are dropped.
 *
 * If the DB is unavailable, the row missing, or every entry non-numeric,
 * the fallback array is returned unchanged so cold-boot behavior is
 * identical to plan-14.
 */

import { logError } from '../error-utils';
import { decodeReplaceValues, REPLACE_VALUES_DEFAULT } from '../db/prompt-defaults';

/** Parse a JSON-encoded/persisted values list into positive integers. */
export function parseNumericValues(raw: readonly string[]): number[] {
    const out: number[] = [];
    const seen = new Set<number>();
    for (const s of raw) {
        const n = Number.parseInt(s, 10);
        if (!Number.isFinite(n) || n < 1 || seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}

/**
 * Read the default row for a role and return its numeric chip values.
 * Returns `fallback` when the row is missing OR contains no numeric entries
 * OR the DB read fails. Non-numeric entries are dropped silently — chips
 * are number-only surfaces (v4.74.0).
 */
export async function resolveConfiguredChipValues(
    role: 'plan' | 'next' | 'generic',
    fallback: readonly number[],
): Promise<number[]> {
    try {
        const mod = await import('../db/prompt-db');
        const result = await mod.getDefaultPromptForRole(role);
        if (!result.ok || !result.value) return [...fallback];
        const raw = decodeReplaceValues((result.value as { ReplaceValues?: unknown }).ReplaceValues);
        // Only override the fallback if the row diverges from the plan-14
        // default set — otherwise we would replace tuned legacy chip lists
        // (e.g. Plan preset ramp 5..200) with the seed default ["1","2","3","5","8"].
        const isDefault = raw.length === REPLACE_VALUES_DEFAULT.length
            && raw.every((v, i) => v === REPLACE_VALUES_DEFAULT[i]);
        if (isDefault) return [...fallback];
        const numeric = parseNumericValues(raw);
        return numeric.length > 0 ? numeric : [...fallback];
    } catch (err) {
        logError('ConfiguredChipValues', 'resolve failed for role=' + role, err);
        return [...fallback];
    }
}

/**
 * Rule-0 validator — "Step count is law".
 *
 * The Plan prompt's Rule 0 states: the number of steps in a written plan MUST
 * equal the injected `{{n}}` value exactly (no `n-1`, no `n+1`, no padding).
 * This module is the runtime guard that blocks saving any plan body that
 * violates that contract before it reaches the DB.
 *
 * Two modes:
 *
 *   1. Template mode (declared count still uses the `{{n}}` placeholder):
 *      the concrete step count is unknowable at save-time, so validation is
 *      a no-op and the guard passes. Byte-preserving edits of the canonical
 *      template stay allowed.
 *
 *   2. Concrete mode (declared count is a literal integer, e.g. from a
 *      `Steps: 5` frontmatter line or a `<n> steps Plan` header): count the
 *      top-level numbered items under `## Steps` (falling back to the whole
 *      document, ignoring fenced code blocks) and require the count to equal
 *      the declared integer. Any mismatch is a Rule-0 violation and the
 *      save is refused with a human-readable reason.
 *
 * Contract:
 *   - Never throws. Every parse/scan error resolves to a structured result.
 *   - Never mutates the input body.
 *   - Only inspects the body string; no I/O, no DB, no globals.
 */

export interface RuleZeroCheck {
    /** `true` = save is allowed (template mode, or count matches declared N). */
    ok: boolean;
    /**
     * Declared step count parsed from the body, or `null` when the declared
     * value is `{{n}}` (template mode) or no declaration was found.
     */
    expectedN: number | null;
    /**
     * Count of top-level numbered steps found in the body, or `null` when
     * the body has no numbered list (nothing to compare against).
     */
    actualN: number | null;
    /** Human-readable reason. Non-empty on both pass and fail for logging. */
    reason: string;
    /**
     * Stable machine code. Callers switch on this instead of parsing `reason`.
     * `'template'`, `'match'`, `'no-declaration'`, `'no-steps'`, `'mismatch'`.
     */
    code: RuleZeroCode;
}

export type RuleZeroCode =
    | 'template'
    | 'match'
    | 'no-declaration'
    | 'no-steps'
    | 'mismatch';

const RE_FENCE = /^\s*```/;
const RE_STEPS_HEADING = /^#{1,6}\s+steps\s*$/i;
const RE_NEXT_HEADING = /^#{1,6}\s+\S+/;
const RE_TOP_LEVEL_NUMBERED = /^(\d+)\.\s+\S/;

/** Frontmatter line: `Steps: 5` or `Steps: {{n}}`. First match wins. */
const RE_FRONTMATTER_STEPS = /^\s*steps\s*:\s*(\S.*?)\s*$/im;

/** Prose declarations: `EXACTLY 5 steps`, `# 5 steps Plan`. */
const RE_EXACTLY_STEPS = /exactly\s+(\{\{n\}\}|\d+)\s+steps?/i;
const RE_HEADER_STEPS = /(?:^|\n)#\s*(\{\{n\}\}|\d+)\s+steps?\s+plan\b/i;

/**
 * Extract the declared step count from `body`.
 *
 * Returns:
 *   - `{ kind: 'literal', value: N }` when a literal integer was found.
 *   - `{ kind: 'template' }` when the declaration references `{{n}}`.
 *   - `{ kind: 'none' }` when no declaration was found.
 *
 * Precedence (first hit wins so the frontmatter always trumps loose prose):
 *   1. Frontmatter `Steps: …` (top of file).
 *   2. `EXACTLY … steps` phrase.
 *   3. `# <N> steps Plan` header.
 */
export function parseDeclaredStepCount(body: string):
    | { kind: 'literal'; value: number }
    | { kind: 'template' }
    | { kind: 'none' } {
    const candidates: Array<RegExpMatchArray | null> = [
        body.match(RE_FRONTMATTER_STEPS),
        body.match(RE_EXACTLY_STEPS),
        body.match(RE_HEADER_STEPS),
    ];
    for (const m of candidates) {
        if (!m) continue;
        const raw = (m[1] ?? '').trim();
        if (raw === '{{n}}') return { kind: 'template' };
        if (/^\d+$/.test(raw)) {
            const n = Number(raw);
            if (Number.isInteger(n) && n >= 0) return { kind: 'literal', value: n };
        }
    }
    return { kind: 'none' };
}

/**
 * Count top-level numbered steps in `body`, ignoring content inside fenced
 * code blocks. When a `## Steps` (or other-level) heading exists we count
 * only within that section (up to the next heading). Otherwise we count
 * every top-level `N.` bullet in the document.
 *
 * "Top-level" here means the line starts at column 0 with `N. `; nested /
 * indented enumerations are ignored so sub-lists don't inflate the count.
 */
export function countTopLevelSteps(body: string): number {
    const lines = body.split(/\r?\n/);
    let inFence = false;
    let inStepsSection = false;
    let sawStepsHeading = false;
    let count = 0;
    let fallbackCount = 0;

    for (const line of lines) {
        if (RE_FENCE.test(line)) { inFence = !inFence; continue; }
        if (inFence) continue;

        if (RE_STEPS_HEADING.test(line)) {
            sawStepsHeading = true;
            inStepsSection = true;
            count = 0;
            continue;
        }
        if (inStepsSection && RE_NEXT_HEADING.test(line) && !RE_STEPS_HEADING.test(line)) {
            inStepsSection = false;
        }

        const m = line.match(RE_TOP_LEVEL_NUMBERED);
        if (!m) continue;
        if (inStepsSection) count += 1;
        fallbackCount += 1;
    }

    return sawStepsHeading ? count : fallbackCount;
}

/**
 * Validate `body` against Rule 0.
 *
 * @param body The plan prompt / plan document text being saved.
 */
export function validateRuleZero(body: string): RuleZeroCheck {
    if (typeof body !== 'string' || body.length === 0) {
        return {
            ok: true, expectedN: null, actualN: null, code: 'no-declaration',
            reason: 'Rule 0: empty body, nothing to validate',
        };
    }

    const decl = parseDeclaredStepCount(body);
    if (decl.kind === 'template') {
        return {
            ok: true, expectedN: null, actualN: null, code: 'template',
            reason: 'Rule 0: template mode ({{n}} placeholder, deferred to inject-time)',
        };
    }
    if (decl.kind === 'none') {
        return {
            ok: true, expectedN: null, actualN: null, code: 'no-declaration',
            reason: 'Rule 0: no declared step count, nothing to enforce',
        };
    }

    const expected = decl.value;
    const actual = countTopLevelSteps(body);
    if (actual === 0) {
        return {
            ok: false, expectedN: expected, actualN: 0, code: 'no-steps',
            reason: 'Rule 0 violated: declared Steps=' + expected
                + ' but body has no numbered steps (expected exactly '
                + expected + ')',
        };
    }
    if (actual !== expected) {
        return {
            ok: false, expectedN: expected, actualN: actual, code: 'mismatch',
            reason: 'Rule 0 violated: declared Steps=' + expected
                + ' but body has ' + actual + ' numbered step(s). '
                + 'Step count is law — write EXACTLY ' + expected + ' steps.',
        };
    }
    return {
        ok: true, expectedN: expected, actualN: actual, code: 'match',
        reason: 'Rule 0: step count matches declared N=' + expected,
    };
}

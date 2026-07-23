/**
 * End-to-end regression: the shipped Plan prompt body (canonical +
 * mirror) MUST substitute `{{n}}` with the caller-supplied number via
 * the same `substituteToken` helper the chip uses at paste time. If
 * anyone edits the prompt and drops `{{n}}`, or renames `ReplaceKey`
 * away from `"n"`, or reintroduces the old `${N}` syntax without the
 * two-shape helper, this test fails loudly before it can reach users.
 *
 * Verifies:
 *   1. Canonical and mirror bodies are byte-identical.
 *   2. Both contain at least one `{{n}}` occurrence.
 *   3. `info.json.ReplaceKey` matches the literal token in the body.
 *   4. Substituting `{{n}}` with an integer removes every occurrence
 *      and injects the numeric string in its place, for a matrix of
 *      values including the info.json `ReplaceValues`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { substituteToken } from '../../standalone-scripts/macro-controller/src/utils/token-substitute';

const ROOT = resolve(__dirname, '..', '..');
const CANONICAL = resolve(ROOT, 'standalone-scripts/prompts/14-plan-steps/prompt.md');
const MIRROR = resolve(ROOT, '.lovable/prompts/13-plan-steps-v7.md');
const INFO = resolve(ROOT, 'standalone-scripts/prompts/14-plan-steps/info.json');

const canonicalBody = readFileSync(CANONICAL, 'utf-8');
const mirrorBody = readFileSync(MIRROR, 'utf-8');
const info = JSON.parse(readFileSync(INFO, 'utf-8')) as {
    ReplaceKey: string;
    ReplaceValues: string[];
};

describe('plan-steps prompt: {{n}} substitution end-to-end', () => {
    it('canonical and mirror bodies are byte-identical', () => {
        expect(mirrorBody).toBe(canonicalBody);
    });

    it('canonical body contains {{n}} at least once', () => {
        expect(canonicalBody).toMatch(/\{\{\s*n\s*\}\}/);
        const count = (canonicalBody.match(/\{\{\s*n\s*\}\}/g) ?? []).length;
        expect(count).toBeGreaterThan(1);
    });

    it('info.json ReplaceKey is "n" and matches the token in the body', () => {
        expect(info.ReplaceKey).toBe('n');
    });

    it.each([1, 5, 10, 20, 100])(
        'substituting {{n}} with %i replaces every occurrence with the number',
        (n) => {
            const rendered = substituteToken(canonicalBody, info.ReplaceKey, n);
            expect(rendered).not.toMatch(/\{\{\s*n\s*\}\}/);
            expect(rendered).toContain(String(n));
            // Guard: no un-substituted ${n} either (belt + suspenders).
            expect(rendered).not.toMatch(/\$\{\s*n\s*\}/);
        },
    );

    it('every info.json ReplaceValue substitutes cleanly', () => {
        for (const raw of info.ReplaceValues) {
            const rendered = substituteToken(canonicalBody, info.ReplaceKey, raw);
            expect(rendered, `value ${raw} left un-substituted tokens`).not.toMatch(
                /\{\{\s*n\s*\}\}/,
            );
            expect(rendered).toContain(raw);
        }
    });
});

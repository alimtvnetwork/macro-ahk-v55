/**
 * End-to-end regression: the shipped Next-{{n}}-tasks prompt body
 * (canonical + mirror) MUST substitute `{{n}}` with the caller-supplied
 * number via the same `substituteToken` helper the chip uses at paste
 * time. If anyone edits the prompt and drops `{{n}}`, renames
 * `ReplaceKey` away from `"n"`, or reintroduces the old `${N}` syntax
 * without the two-shape helper, this test fails loudly before it can
 * reach users.
 *
 * Verifies:
 *   1. Canonical (standalone-scripts/prompts/13-next-tasks/prompt.md)
 *      and mirror (.lovable/prompts/12-next-steps-v7.md) are
 *      byte-identical.
 *   2. Body contains multiple `{{n}}` occurrences (RULE 0 anchor plus
 *      body references).
 *   3. `info.json.ReplaceKey === "n"` and Version >= 2.0.0.
 *   4. Substituting `{{n}}` with an integer removes every occurrence
 *      and injects the numeric string in its place, across a matrix
 *      of values including every info.json `ReplaceValue`.
 *   5. Legacy `${N}` syntax has been fully purged from the body.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { substituteToken } from '../../standalone-scripts/macro-controller/src/utils/token-substitute';

const ROOT = resolve(__dirname, '..', '..');
const CANONICAL = resolve(ROOT, 'standalone-scripts/prompts/13-next-tasks/prompt.md');
const MIRROR = resolve(ROOT, '.lovable/prompts/12-next-steps-v7.md');
const INFO = resolve(ROOT, 'standalone-scripts/prompts/13-next-tasks/info.json');

const canonicalBody = readFileSync(CANONICAL, 'utf-8');
const mirrorBody = readFileSync(MIRROR, 'utf-8');
const info = JSON.parse(readFileSync(INFO, 'utf-8')) as {
    Version: string;
    ReplaceKey: string;
    ReplaceValues: string[];
};

describe('next-tasks prompt: {{n}} substitution end-to-end', () => {
    it('canonical and mirror bodies are byte-identical', () => {
        expect(mirrorBody).toBe(canonicalBody);
    });

    it('canonical body contains {{n}} more than once', () => {
        const count = (canonicalBody.match(/\{\{\s*n\s*\}\}/g) ?? []).length;
        expect(count).toBeGreaterThan(1);
    });

    it('legacy ${N} syntax has been fully purged', () => {
        expect(canonicalBody).not.toMatch(/\$\{\s*N\s*\}/);
        expect(canonicalBody).not.toMatch(/\$\{\s*n\s*\}/);
    });

    it('info.json ReplaceKey is "n" and Version is >= 2.0.0', () => {
        expect(info.ReplaceKey).toBe('n');
        const [major] = info.Version.split('.').map(Number);
        expect(major).toBeGreaterThanOrEqual(2);
    });

    it.each([1, 2, 5, 8, 20, 100])(
        'substituting {{n}} with %i replaces every occurrence with the number',
        (n) => {
            const rendered = substituteToken(canonicalBody, info.ReplaceKey, n);
            expect(rendered).not.toMatch(/\{\{\s*n\s*\}\}/);
            expect(rendered).toContain(String(n));
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

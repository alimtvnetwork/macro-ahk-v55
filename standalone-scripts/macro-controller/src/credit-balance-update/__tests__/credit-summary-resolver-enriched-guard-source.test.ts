/**
 * Static regression guard for the v4.19–4.22 unified-billing fix chain.
 *
 * Root cause anchor: `inlineTotal()` in `credit-summary-resolver.ts` MUST
 * short-circuit and return `ws.totalCredits` when `ws.enriched === true`.
 * Removing that guard reintroduces the ktlo_2 wrong-total regression
 * because `calcTotalCredits` pulls the stale sub-bucket `ws.limit` back
 * into the display total.
 *
 * The behavioural sibling test (`credit-summary-resolver-enriched-bypass`)
 * proves the guard works when reached; this test proves the guard still
 * exists in source, so no future refactor can silently delete it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RESOLVER_PATH = join(
    __dirname,
    '..',
    'credit-summary-resolver.ts',
);

describe('credit-summary-resolver enriched-bypass source guard', () => {
    const source = readFileSync(RESOLVER_PATH, 'utf-8');

    it('contains the ws.enriched === true short-circuit in inlineTotal', () => {
        const hasGuard = /ws\.enriched\s*===\s*true/.test(source);
        expect(hasGuard, 'inlineTotal must keep the `ws.enriched === true` bypass — see v4.19–4.22 ktlo_2 fix chain').toBe(true);
    });

    it('returns ws.totalCredits inside the enriched branch (no fallback to calcTotalCredits)', () => {
        // Match the guard block and assert it returns from ws.totalCredits
        // BEFORE any calcTotalCredits call site.
        const guardBlock = source.match(/if\s*\(\s*ws\.enriched\s*===\s*true\s*\)\s*\{[\s\S]*?\}/);
        expect(guardBlock, 'enriched guard block must exist').not.toBeNull();
        const body = guardBlock![0];
        expect(body).toMatch(/return[\s\S]*ws\.totalCredits/);
        expect(body).not.toMatch(/calcTotalCredits/);
    });
});

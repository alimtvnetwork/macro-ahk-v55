/**
 * Regression — v3.55.x 💰 Credits button fan-out for Free / Lite / Cancelled / pro_0.
 *
 * Root cause (RCA 2026-06-06 #4):
 * `batchRefreshProOneCreditBalances` only covers pro_1. Workspaces on free /
 * ktlo / cancelled / pro_0 without inline credits never receive their
 * `/credit-balance` follow-up, so their bars stay at the skeleton dash even
 * after the user clicks 💰 Credits.
 *
 * Static guard: `executeCreditFetch` MUST delegate enrichment to the capped
 * fan-out helper and only clear loading once the pro_1 batch and enrichment
 * fan-out have both settled.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(__dirname, '..', 'ui', 'panel-controls.ts');
const SOURCE = readFileSync(SRC, 'utf8');

function getExecuteCreditFetchBody(): string {
    const start = SOURCE.indexOf('function executeCreditFetch');
    expect(start, 'executeCreditFetch must exist').toBeGreaterThan(-1);
    const rest = SOURCE.slice(start);
    const endRel = rest.indexOf('\n}\n');
    return endRel === -1 ? rest : rest.slice(0, endRel + 2);
}

describe('💰 Credits button — enrichment fan-out contract', () => {
    const body = getExecuteCreditFetchBody();

    it('imports the capped credit-enrichment fan-out helper', () => {
        expect(SOURCE).toMatch(
            /import\s*\{[^}]*\bfanOutCreditEnrichment\b[^}]*\}\s*from\s*['"]\.\.\/credit-balance-update\/credit-enrichment-fanout['"]/,
        );
    });

    it('passes all parsed workspaces to the fan-out helper', () => {
        expect(body).toMatch(/fanOutCreditEnrichment\s*\(\s*loopCreditState\.perWorkspace\s*\|\|\s*\[\]\s*\)/);
    });

    it('only clears loading after BOTH pro_1 batch AND fan-out settle', () => {
        expect(body).toMatch(/Promise\.allSettled\(\s*\[\s*proOneRefresh\s*,\s*enrichmentFanOut\s*\]\s*\)\.finally\(/);
        expect(body).toMatch(/setCreditBtnLoading\s*\(\s*\w+\.creditBtn\s*,\s*false\s*\)/);
    });
});

/**
 * G1: buildPlanTaskPrompt direct unit sweep.
 *
 * Locks:
 *  - Body contains N in header, slug line, "exactly N items" line, checklist echo.
 *  - Determinism across a wide N range (boundaries + defaults).
 *  - `{{n}}` sentinel parity: replacing N in the seed template reproduces
 *    buildPlanTaskPrompt(n) byte-for-byte (proves no drift for the seeder).
 */
import { describe, it, expect } from 'vitest';
import { buildPlanTaskPrompt } from '../ui/plan-task-ui';
import { PLAN_DEFAULT_BODY } from '../seed/plan-next-prompts';

const renderPlanBodyTemplate = (n: string): string =>
    PLAN_DEFAULT_BODY.split('{{n}}').join(n);

describe('buildPlanTaskPrompt: boundary sweep', () => {
    const cases = [1, 2, 3, 5, 10, 20, 50, 100, 150, 200, 999];

    it.each(cases)('N=%i, N is substituted into the header and step-count locations', (n) => {
        const body = buildPlanTaskPrompt(n);
        // v4.187.0: assert invariants (N-substitution) rather than exact
        // header strings, so cosmetic body edits do not break the sweep.
        // Header line MUST start with `# ` and MUST contain the exact N as
        // a whole token (surrounded by non-digit boundaries).
        const firstLine = body.split('\n')[0] ?? '';
        expect(firstLine.startsWith('# ')).toBe(true);
        const wholeNumberRe = new RegExp('(^|\\D)' + String(n) + '(\\D|$)');
        expect(wholeNumberRe.test(firstLine)).toBe(true);
        // The "exactly N steps" contract from Rule 0 MUST cite N literally.
        expect(body).toContain('`' + String(n) + '`');
        // No leftover template sentinels.
        expect(body.includes('{{n}}')).toBe(false);
    });

    it.each(cases)('N=%i, deterministic across repeated calls', (n) => {
        expect(buildPlanTaskPrompt(n)).toBe(buildPlanTaskPrompt(n));
    });

    it('never emits the literal "{{n}}" (sentinel is seed-only)', () => {
        for (const n of cases) {
            expect(buildPlanTaskPrompt(n).includes('{{n}}')).toBe(false);
        }
    });

    it('{{n}} template parity: renderPlanBodyTemplate(n) equals buildPlanTaskPrompt(n)', () => {
        for (const n of cases) {
            expect(renderPlanBodyTemplate(String(n))).toBe(buildPlanTaskPrompt(n));
        }
    });

    it('N=0 still round-trips through the {{n}} template', () => {
        expect(renderPlanBodyTemplate('0')).toBe(buildPlanTaskPrompt(0));
    });
});

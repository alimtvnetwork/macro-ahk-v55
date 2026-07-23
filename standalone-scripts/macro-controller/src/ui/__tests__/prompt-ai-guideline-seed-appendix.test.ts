/**
 * Plan-23 remaining-item #4: AI guideline export includes the shipped seed
 * body as a "Canonical default" appendix so an external AI editor can diff
 * against the byte-exact original before proposing edits.
 *
 * Contract:
 *   - When `seedBody` is provided: guideline contains a "Canonical default"
 *     heading, a fenced ```text block, and the exact seed body verbatim.
 *   - When `seedBody` is omitted OR empty: no such heading/fence is emitted
 *     (user-authored rows have no canonical default to diff against).
 *   - Multi-line seed bodies survive round-trip untouched.
 */
import { describe, it, expect } from 'vitest';
import { buildAiGuidelineMarkdown } from '../prompt-ai-guideline';
import { PLAN_DEFAULT_BODY } from '../../seed/plan-next-prompts';

describe('buildAiGuidelineMarkdown — Canonical default appendix', () => {
    it('appends the seed body inside a ```text fence when seedBody is provided', () => {
        const md = buildAiGuidelineMarkdown({
            roleLabel: 'Plan',
            requiredTokens: ['n'],
            seedBody: PLAN_DEFAULT_BODY,
        });
        expect(md).toContain('## Canonical default (shipped body for this slug)');
        expect(md).toContain('```text\n' + PLAN_DEFAULT_BODY + '\n```');
    });

    it('omits the appendix entirely when seedBody is undefined', () => {
        const md = buildAiGuidelineMarkdown({
            roleLabel: 'Generic',
            requiredTokens: [],
        });
        expect(md).not.toContain('Canonical default');
        expect(md).not.toContain('```text');
    });

    it('omits the appendix when seedBody is an empty string (defensive)', () => {
        const md = buildAiGuidelineMarkdown({
            roleLabel: 'Plan',
            requiredTokens: ['n'],
            seedBody: '',
        });
        expect(md).not.toContain('Canonical default');
    });

    it('preserves multi-line seed bodies verbatim (no trimming, no escaping)', () => {
        const body = 'Line 1\nLine 2 with {{n}}\n\nLine 4';
        const md = buildAiGuidelineMarkdown({
            roleLabel: 'Next',
            requiredTokens: ['n'],
            seedBody: body,
        });
        const fenceStart = md.indexOf('```text\n');
        const fenceEnd = md.indexOf('\n```', fenceStart);
        expect(fenceStart).toBeGreaterThan(-1);
        expect(fenceEnd).toBeGreaterThan(fenceStart);
        expect(md.slice(fenceStart + '```text\n'.length, fenceEnd)).toBe(body);
    });
});

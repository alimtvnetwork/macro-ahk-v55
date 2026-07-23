import { describe, it, expect } from 'vitest';
import { buildAiGuidelineMarkdown } from '../prompt-ai-guideline';

describe('buildAiGuidelineMarkdown', () => {
    it('includes every required token verbatim in backticked form', () => {
        const md = buildAiGuidelineMarkdown({ roleLabel: 'Plan', requiredTokens: ['n', 'plan.count'] });
        expect(md).toContain('# Marco Prompt Editing Guideline (Plan)');
        expect(md).toContain('`{{n}}`');
        expect(md).toContain('`{{plan.count}}`');
        expect(md).toContain('Preserve every required token verbatim');
    });

    it('renders a "(none)" hint for roles without required tokens', () => {
        const md = buildAiGuidelineMarkdown({ roleLabel: 'Generic', requiredTokens: [] });
        expect(md).toContain('(none — this role has no required tokens)');
    });

    it('includes an ISO timestamp so downloaded copies are traceable', () => {
        const md = buildAiGuidelineMarkdown({ roleLabel: 'Next', requiredTokens: ['n'] });
        expect(md).toMatch(/\*\*Generated:\*\* \d{4}-\d{2}-\d{2}T/);
    });
});

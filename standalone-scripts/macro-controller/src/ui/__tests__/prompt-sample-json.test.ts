import { describe, it, expect } from 'vitest';
import { buildSamplePromptsJson } from '../prompt-sample-json';
import { parsePromptsText } from '../prompt-io';

describe('prompt sample JSON', () => {
    it('produces a valid PromptsBundleV1 that round-trips through parsePromptsText', () => {
        const json = buildSamplePromptsJson('2026-07-18T00:00:00.000Z');
        const { valid, errors } = parsePromptsText(json);
        expect(errors).toEqual([]);
        expect(valid).toHaveLength(3);
        const roles = valid.map((e) => e.role);
        expect(roles).toContain('plan');
        expect(roles).toContain('next');
        expect(roles).toContain('generic');
    });

    it('includes {{n}} tokens for plan and next samples so drift guard passes', () => {
        const json = buildSamplePromptsJson();
        const parsed = JSON.parse(json) as { entries: Array<{ category: string; text: string }> };
        const plan = parsed.entries.find((e) => e.category === 'plan');
        const next = parsed.entries.find((e) => e.category === 'next');
        expect(plan?.text).toContain('{{n}}');
        expect(next?.text).toContain('{{n}}');
    });
});

describe('parsePromptsText JSON-pointer errors', () => {
    it('reports /entries/{i}/name for envelope entries missing name', () => {
        const bundle = {
            schema: 'prompts-bundle',
            schemaVersion: 1,
            exportedAt: '2026-07-18T00:00:00.000Z',
            exporterVersion: '4.143.0',
            entryCount: 1,
            entries: [{ text: 'body only, no name' }],
        };
        const { valid, errors } = parsePromptsText(JSON.stringify(bundle));
        expect(valid).toEqual([]);
        expect(errors[0]).toContain('/entries/0/name');
        expect(errors[0]).toContain('missing or empty string');
    });

    it('reports /entries/{i}/text for envelope entries missing text', () => {
        const bundle = {
            schema: 'prompts-bundle',
            schemaVersion: 1,
            exportedAt: '2026-07-18T00:00:00.000Z',
            exporterVersion: '4.143.0',
            entryCount: 1,
            entries: [{ name: 'Named but bodyless' }],
        };
        const { errors } = parsePromptsText(JSON.stringify(bundle));
        expect(errors[0]).toContain('/entries/0/text');
    });

    it('reports pointer for legacy bare-array entries', () => {
        const bare = [{ name: 'ok', text: 'ok' }, { text: 'no name' }];
        const { valid, errors } = parsePromptsText(JSON.stringify(bare));
        expect(valid).toHaveLength(1);
        expect(errors[0]).toContain('/1/name');
    });
});

/**
 * Tests for prompt-token-guard.ts (plan-14, step 6).
 */
import { describe, it, expect } from 'vitest';
import {
    assertParamTokensUnchanged,
    extractParamTokens,
    ParamTokenMismatch,
} from '../prompt-token-guard';

describe('extractParamTokens', () => {
    it('extracts every {{token}} in order, allowing dots/colons/hyphens/underscores/digits', () => {
        const body = 'a {{one}} b {{two}} c {{one}} d {{plan.count}} e {{v-2}} f {{ns:key_1}}';
        expect(extractParamTokens(body)).toEqual(['one', 'two', 'one', 'plan.count', 'v-2', 'ns:key_1']);
    });

    it('normalizes internal whitespace: {{ x }} and {{x}} are the same token', () => {
        expect(extractParamTokens('a {{ x }} b {{x}}')).toEqual(['x', 'x']);
    });

    it('returns empty when no tokens', () => {
        expect(extractParamTokens('plain text with no braces')).toEqual([]);
    });
});

describe('assertParamTokensUnchanged', () => {
    it('accepts identical multisets (reorder allowed)', () => {
        expect(() => assertParamTokensUnchanged(
            'A {{one}} B {{two}} C {{one}}',
            'C {{one}} A {{two}} B {{one}}',
        )).not.toThrow();
    });

    it('accepts whitespace/casing tolerance inside braces (whitespace only)', () => {
        expect(() => assertParamTokensUnchanged('x {{n}} y', 'x {{ n }} y')).not.toThrow();
    });

    it('rejects a renamed token (removed + added)', () => {
        try {
            assertParamTokensUnchanged('hi {{count}}', 'hi {{n}}');
            throw new Error('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(ParamTokenMismatch);
            const err = e as ParamTokenMismatch;
            expect(err.added).toEqual(['n']);
            expect(err.removed).toEqual(['count']);
        }
    });

    it('rejects a dropped token', () => {
        expect(() => assertParamTokensUnchanged('{{a}} {{b}}', '{{a}}')).toThrow(ParamTokenMismatch);
    });

    it('rejects an added token', () => {
        expect(() => assertParamTokensUnchanged('{{a}}', '{{a}} {{new}}')).toThrow(/added: \{\{new\}\}/);
    });

    it('rejects a duplicated-count change: 2x vs 3x', () => {
        expect(() => assertParamTokensUnchanged('{{n}} {{n}}', '{{n}} {{n}} {{n}}')).toThrow(ParamTokenMismatch);
    });

    it('empty-to-empty is a no-op', () => {
        expect(() => assertParamTokensUnchanged('no tokens here', 'still no tokens')).not.toThrow();
    });

    describe('replace-key rename (plan-15)', () => {
        it('accepts renaming every occurrence of oldKey → newKey when counts match', () => {
            expect(() => assertParamTokensUnchanged(
                'Do {{n}} things, exactly {{n}}.',
                'Do {{count}} things, exactly {{count}}.',
                { oldKey: 'n', newKey: 'count' },
            )).not.toThrow();
        });

        it('accepts rename that mixes {{k}} and ${k} shapes in old body', () => {
            expect(() => assertParamTokensUnchanged(
                'x {{n}} y ${n}',
                'x {{count}} y ${count}',
                { oldKey: 'n', newKey: 'count' },
            )).not.toThrow();
        });

        it('rejects a count mismatch on the renamed key', () => {
            expect(() => assertParamTokensUnchanged(
                '{{n}} {{n}}',
                '{{count}} {{count}} {{count}}',
                { oldKey: 'n', newKey: 'count' },
            )).toThrow(ParamTokenMismatch);
        });

        it('rejects drift on an unrelated token even during a rename', () => {
            expect(() => assertParamTokensUnchanged(
                '{{n}} {{other}}',
                '{{count}} {{different}}',
                { oldKey: 'n', newKey: 'count' },
            )).toThrow(ParamTokenMismatch);
        });

        it('is a no-op when oldKey === newKey (identity rename)', () => {
            expect(() => assertParamTokensUnchanged(
                '{{n}} hi',
                '{{n}} hi',
                { oldKey: 'n', newKey: 'n' },
            )).not.toThrow();
        });

        it('ignores options when oldKey/newKey are omitted (back-compat)', () => {
            expect(() => assertParamTokensUnchanged('{{n}}', '{{count}}'))
                .toThrow(ParamTokenMismatch);
        });
    });
});


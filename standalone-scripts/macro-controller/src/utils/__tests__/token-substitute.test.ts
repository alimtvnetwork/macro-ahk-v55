/**
 * Tests for token-substitute.ts (plan-15 step 7).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { substituteToken } from '../token-substitute';

vi.mock('../../error-utils', () => ({
    logError: vi.fn(),
}));

import { logError } from '../../error-utils';

describe('substituteToken', () => {
    beforeEach(() => {
        (logError as unknown as Mock).mockClear();
    });

    it('replaces every {{key}} occurrence', () => {
        expect(substituteToken('do {{n}} things, exactly {{n}}', 'n', 3))
            .toBe('do 3 things, exactly 3');
    });

    it('replaces every ${key} occurrence', () => {
        expect(substituteToken('do ${n} things', 'n', 5)).toBe('do 5 things');
    });

    it('replaces mixed {{k}} and ${k} in the same body', () => {
        expect(substituteToken('x {{n}} y ${n} z', 'n', 7))
            .toBe('x 7 y 7 z');
    });

    it('tolerates whitespace inside braces', () => {
        expect(substituteToken('a {{ n }} b ${ n } c', 'n', 2))
            .toBe('a 2 b 2 c');
    });

    it('honors the caller-supplied key (custom rename)', () => {
        expect(substituteToken('give me {{count}} items', 'count', 10))
            .toBe('give me 10 items');
    });

    it('leaves unrelated tokens untouched', () => {
        expect(substituteToken('{{n}} and {{other}}', 'n', 1))
            .toBe('1 and {{other}}');
    });

    it('handles numeric values via String() coercion', () => {
        expect(substituteToken('${n}', 'n', 42)).toBe('42');
    });

    it('returns body unchanged and logs when key is empty', () => {
        expect(substituteToken('{{n}}', '', 1)).toBe('{{n}}');
        expect(logError).toHaveBeenCalledTimes(1);
    });

    it('returns body unchanged and logs when key contains invalid chars', () => {
        expect(substituteToken('{{n}}', 'bad key!', 1)).toBe('{{n}}');
        expect(logError).toHaveBeenCalledTimes(1);
    });

    it('returns empty for empty body without logging', () => {
        expect(substituteToken('', 'n', 1)).toBe('');
        expect(logError).not.toHaveBeenCalled();
    });

    it('does not match different keys (n vs count)', () => {
        expect(substituteToken('{{count}}', 'n', 3)).toBe('{{count}}');
    });

    it('replaces legacy uppercase N when the persisted key is lowercase n', () => {
        expect(substituteToken('{{n}} and {{N}} and ${N}', 'n', 6))
            .toBe('6 and 6 and 6');
    });

    it('replaces current lowercase n when the persisted key is legacy uppercase N', () => {
        expect(substituteToken('# Next {{n}} steps and ${n}', 'N', 2))
            .toBe('# Next 2 steps and 2');
    });

    it('is regex-safe for keys with allowed dots/colons/hyphens', () => {
        expect(substituteToken('{{plan.count}} ${plan.count}', 'plan.count', 4))
            .toBe('4 4');
    });
});

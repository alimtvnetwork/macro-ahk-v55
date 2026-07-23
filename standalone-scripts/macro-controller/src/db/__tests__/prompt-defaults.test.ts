/**
 * Positive + negative coverage for `db/prompt-defaults.ts` (Plan-22 steps 24-31).
 *
 * Locks the configurable-token defaults and the four helpers that seeder,
 * CRUD, UI, and schema migration all depend on. If any helper silently
 * accepts garbage input, the seeder would corrupt the ReplaceValues
 * column and the chip renderer would render `{{n}}` untouched.
 */
import { describe, it, expect } from 'vitest';
import {
    REPLACE_KEY_DEFAULT,
    REPLACE_VALUES_DEFAULT,
    REPLACE_VALUES_DEFAULT_JSON,
    REPLACE_KEY_RE,
    validateReplaceKey,
    normalizeReplaceValues,
    encodeReplaceValues,
    decodeReplaceValues,
} from '../prompt-defaults';
import { substituteToken } from '../../utils/token-substitute';

describe('prompt-defaults constants', () => {
    it('exposes the plan-14 cold-boot defaults byte-for-byte', () => {
        expect(REPLACE_KEY_DEFAULT).toBe('n');
        expect(REPLACE_VALUES_DEFAULT).toEqual(['1', '2', '3', '5', '8']);
        expect(REPLACE_VALUES_DEFAULT_JSON).toBe('["1","2","3","5","8"]');
        expect(JSON.parse(REPLACE_VALUES_DEFAULT_JSON)).toEqual([...REPLACE_VALUES_DEFAULT]);
    });

    it('REPLACE_KEY_RE matches identifier shape only', () => {
        expect(REPLACE_KEY_RE.test('n')).toBe(true);
        expect(REPLACE_KEY_RE.test('_count')).toBe(true);
        expect(REPLACE_KEY_RE.test('count32')).toBe(true);
        expect(REPLACE_KEY_RE.test('9lead')).toBe(false);
        expect(REPLACE_KEY_RE.test('has space')).toBe(false);
        expect(REPLACE_KEY_RE.test('a'.repeat(33))).toBe(false);
    });
});

describe('validateReplaceKey', () => {
    it('returns null for well-formed keys', () => {
        expect(validateReplaceKey('n')).toBeNull();
        expect(validateReplaceKey('count')).toBeNull();
        expect(validateReplaceKey('_x9')).toBeNull();
    });

    it('rejects empty, leading-digit, punctuation, whitespace, non-strings', () => {
        expect(validateReplaceKey('')).not.toBeNull();
        expect(validateReplaceKey('9n')).not.toBeNull();
        expect(validateReplaceKey('bad key')).not.toBeNull();
        expect(validateReplaceKey('bad-key')).not.toBeNull();
        expect(validateReplaceKey('a.b')).not.toBeNull();
        expect(validateReplaceKey(42 as unknown as string)).toBe('replaceKey must be a string');
    });
});

describe('normalizeReplaceValues', () => {
    it('trims, drops empties, and dedupes preserving first-seen order', () => {
        expect(normalizeReplaceValues([' 1 ', '2', '2', '', '  ', '3'])).toEqual(['1', '2', '3']);
    });

    it('skips non-string members without failing the whole list', () => {
        expect(normalizeReplaceValues(['1', 2, null, undefined, '3'] as unknown[])).toEqual(['1', '3']);
    });

    it('returns null for non-arrays and empty-after-normalize input', () => {
        expect(normalizeReplaceValues(null as unknown as unknown[])).toBeNull();
        expect(normalizeReplaceValues('nope' as unknown as unknown[])).toBeNull();
        expect(normalizeReplaceValues([])).toBeNull();
        expect(normalizeReplaceValues(['', '  ', ''])).toBeNull();
    });
});

describe('encode/decode ReplaceValues round-trip', () => {
    it('encodes to JSON and decodes back to the same array', () => {
        const enc = encodeReplaceValues(['1', '5', '10']);
        expect(enc).toBe('["1","5","10"]');
        expect(decodeReplaceValues(enc)).toEqual(['1', '5', '10']);
    });

    it('falls back to defaults on non-string, empty, malformed JSON, and non-array JSON', () => {
        expect(decodeReplaceValues(null)).toEqual([...REPLACE_VALUES_DEFAULT]);
        expect(decodeReplaceValues('')).toEqual([...REPLACE_VALUES_DEFAULT]);
        expect(decodeReplaceValues('   ')).toEqual([...REPLACE_VALUES_DEFAULT]);
        expect(decodeReplaceValues('{not json')).toEqual([...REPLACE_VALUES_DEFAULT]);
        expect(decodeReplaceValues('{"k":1}')).toEqual([...REPLACE_VALUES_DEFAULT]);
    });

    it('normalizes garbage inside a valid JSON array on decode', () => {
        expect(decodeReplaceValues('[" 1 ","1","", "2"]')).toEqual(['1', '2']);
    });
});

describe('integration: defaults drive substituteToken (Plan-22 step 28-31)', () => {
    it('substitutes every default chip value into the default body shape', () => {
        const body = 'do {{n}} things (${n} total)';
        for (const v of REPLACE_VALUES_DEFAULT) {
            expect(substituteToken(body, REPLACE_KEY_DEFAULT, v))
                .toBe('do ' + v + ' things (' + v + ' total)');
        }
    });

    it('renamed key: decoded values still substitute against the new key', () => {
        const key = 'count';
        expect(validateReplaceKey(key)).toBeNull();
        const values = decodeReplaceValues('["4","7"]');
        expect(values).toEqual(['4', '7']);
        const body = 'give me {{count}} items';
        expect(substituteToken(body, key, values[0])).toBe('give me 4 items');
        expect(substituteToken(body, key, values[1])).toBe('give me 7 items');
    });

    it('corrupt DB row: decode falls back to defaults so chip still renders', () => {
        const values = decodeReplaceValues('not-json');
        const body = 'x {{n}} y';
        // First default value is "1"; substitution must succeed byte-identically.
        expect(substituteToken(body, REPLACE_KEY_DEFAULT, values[0])).toBe('x 1 y');
    });
});

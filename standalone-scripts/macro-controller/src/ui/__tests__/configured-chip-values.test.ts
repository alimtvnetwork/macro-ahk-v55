/**
 * Plan-15 Task 15: vitest coverage for the DB-driven chip-value resolver.
 *
 * Locks the semantics of `resolveConfiguredChipValues`:
 *  - default-shaped DB row -> caller fallback preserved (plan/next legacy ramps).
 *  - customised numeric list -> DB wins.
 *  - empty / non-numeric / missing row / DB failure -> fallback.
 *  - `parseNumericValues` drops non-positive/non-integer/duplicate entries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../error-utils', () => ({ logError: vi.fn() }));

const getDefaultMock = vi.hoisted(() => vi.fn());
vi.mock('../../db/prompt-db', () => ({
    getDefaultPromptForRole: getDefaultMock,
}));

import { parseNumericValues, resolveConfiguredChipValues } from '../configured-chip-values';
import { REPLACE_VALUES_DEFAULT_JSON } from '../../db/prompt-defaults';

beforeEach(() => {
    getDefaultMock.mockReset();
});

describe('parseNumericValues', () => {
    it('keeps positive integers, order-preserving, deduped', () => {
        expect(parseNumericValues(['1', '2', '2', '5', '8'])).toEqual([1, 2, 5, 8]);
    });
    it('drops non-numeric, zero, negative, and NaN entries', () => {
        expect(parseNumericValues(['0', '-3', 'foo', '', '7'])).toEqual([7]);
    });
});

describe('resolveConfiguredChipValues', () => {
    const fallback = [5, 10, 20];

    it('returns fallback when DB row is missing', async () => {
        getDefaultMock.mockResolvedValueOnce({ ok: true, value: undefined });
        expect(await resolveConfiguredChipValues('plan', fallback)).toEqual(fallback);
    });

    it('returns fallback when getDefaultPromptForRole fails', async () => {
        getDefaultMock.mockResolvedValueOnce({ ok: false, error: 'boom' });
        expect(await resolveConfiguredChipValues('next', fallback)).toEqual(fallback);
    });

    it('returns fallback when DB row still holds the seed default set (never trample legacy ramps)', async () => {
        getDefaultMock.mockResolvedValueOnce({
            ok: true,
            value: { ReplaceValues: REPLACE_VALUES_DEFAULT_JSON },
        });
        expect(await resolveConfiguredChipValues('plan', fallback)).toEqual(fallback);
    });

    it('returns DB values when user customised the list', async () => {
        getDefaultMock.mockResolvedValueOnce({
            ok: true,
            value: { ReplaceValues: JSON.stringify(['3', '7', '11']) },
        });
        expect(await resolveConfiguredChipValues('plan', fallback)).toEqual([3, 7, 11]);
    });

    it('returns fallback when customised list has no numeric entries', async () => {
        getDefaultMock.mockResolvedValueOnce({
            ok: true,
            value: { ReplaceValues: JSON.stringify(['a', 'b']) },
        });
        expect(await resolveConfiguredChipValues('generic', fallback)).toEqual(fallback);
    });

    it('returns fallback when the resolver throws (never leaks errors to chip render)', async () => {
        getDefaultMock.mockRejectedValueOnce(new Error('idb down'));
        expect(await resolveConfiguredChipValues('next', fallback)).toEqual(fallback);
    });

    it('returns a fresh array (caller can mutate without corrupting fallback)', async () => {
        getDefaultMock.mockResolvedValueOnce({ ok: true, value: undefined });
        const out = await resolveConfiguredChipValues('plan', fallback);
        out.push(999);
        expect(fallback).toEqual([5, 10, 20]);
    });
});

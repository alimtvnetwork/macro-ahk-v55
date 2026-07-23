/**
 * Plan-15 Task 16: IO round-trip coverage for ReplaceKey / ReplaceValues.
 *
 * Locks the plan-15 task-13 wiring:
 *  - `collectDbEntriesForExport` populates `replaceKey` + `replaceValues`
 *    from `PromptRow` so export bundles retain per-row token config.
 *  - `commitDbEntries` forwards `replaceKey`, `replaceValues`, and the
 *    existing row's `ReplaceKey` as `previousReplaceKey` into
 *    `upsertPrompt` so a rename passes the drift guard on re-import.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));

const listMock = vi.hoisted(() => vi.fn());
const upsertMock = vi.hoisted(() => vi.fn());
vi.mock('../../db/prompt-db', () => ({
    listPromptsByRole: listMock,
    upsertPrompt: upsertMock,
}));

import {
    collectDbEntriesForExport,
    commitDbEntries,
} from '../prompt-io-db-bridge';
import type { CachedPromptEntry } from '../prompt-cache';

beforeEach(() => {
    listMock.mockReset();
    upsertMock.mockReset();
    upsertMock.mockImplementation(async () => ({ ok: true, value: 1 }));
});

describe('collectDbEntriesForExport: ReplaceKey/ReplaceValues round-trip', () => {
    it('carries replaceKey and cloned replaceValues from PromptRow into CachedPromptEntry', async () => {
        listMock.mockImplementation(async (role: string) => {
            if (role !== 'plan') return { ok: true, value: [] };
            return {
                ok: true,
                value: [{
                    Id: 1, Slug: 'plan-default', Name: 'Plan default',
                    Body: 'P {{count}}', Role: 'plan', IsDefault: 1,
                    ReplaceKey: 'count',
                    ReplaceValues: ['3', '7', '11'],
                    CreatedAt: 0, UpdatedAt: 0,
                }],
            };
        });
        const out = await collectDbEntriesForExport();
        const plan = out.find((e) => e.slug === 'plan-default')!;
        expect(plan.replaceKey).toBe('count');
        expect(plan.replaceValues).toEqual(['3', '7', '11']);
        // Cloned, not shared.
        plan.replaceValues!.push('99');
        const out2 = await collectDbEntriesForExport();
        expect(out2.find((e) => e.slug === 'plan-default')!.replaceValues).toEqual(['3', '7', '11']);
    });

    it('leaves replaceValues undefined when the row column is missing/non-array', async () => {
        listMock.mockImplementation(async (role: string) => {
            if (role !== 'next') return { ok: true, value: [] };
            return {
                ok: true,
                value: [{
                    Id: 2, Slug: 'next-default', Name: 'Next default',
                    Body: 'N {{n}}', Role: 'next', IsDefault: 1,
                    ReplaceKey: 'n',
                    // ReplaceValues intentionally absent
                    CreatedAt: 0, UpdatedAt: 0,
                }],
            };
        });
        const out = await collectDbEntriesForExport();
        const next = out.find((e) => e.slug === 'next-default')!;
        expect(next.replaceKey).toBe('n');
        expect(next.replaceValues).toBeUndefined();
    });
});

describe('commitDbEntries: forwards replaceKey/replaceValues/previousReplaceKey', () => {
    it('passes previousReplaceKey from the existing row so a rename passes the drift guard', async () => {
        listMock.mockImplementation(async (role: string) => {
            if (role !== 'plan') return { ok: true, value: [] };
            return {
                ok: true,
                value: [{
                    Id: 1, Slug: 'plan-default', Name: 'Plan default',
                    Body: 'P {{n}}', Role: 'plan', IsDefault: 1,
                    ReplaceKey: 'n',
                    ReplaceValues: ['1', '2', '3', '5', '8'],
                    CreatedAt: 0, UpdatedAt: 0,
                }],
            };
        });
        const entries: CachedPromptEntry[] = [{
            name: 'Plan default', text: 'P {{count}}', slug: 'plan-default', role: 'plan',
            replaceKey: 'count', replaceValues: ['3', '7', '11'],
        }];
        const result = await commitDbEntries(entries);
        expect(result.errors).toEqual([]);
        expect(result.upserted).toBe(1);
        expect(upsertMock).toHaveBeenCalledTimes(1);
        const arg = upsertMock.mock.calls[0][0] as {
            id?: number;
            replaceKey?: string;
            replaceValues?: string[];
            previousReplaceKey?: string;
            previousBody?: string;
        };
        expect(arg.id).toBe(1);
        expect(arg.replaceKey).toBe('count');
        expect(arg.replaceValues).toEqual(['3', '7', '11']);
        expect(arg.previousReplaceKey).toBe('n');
        expect(arg.previousBody).toBe('P {{n}}');
    });

    it('omits previousReplaceKey when inserting a brand-new slug', async () => {
        listMock.mockImplementation(async () => ({ ok: true, value: [] }));
        const entries: CachedPromptEntry[] = [{
            name: 'Custom', text: 'C {{n}}', slug: 'plan-custom', role: 'plan',
            replaceKey: 'n', replaceValues: ['2', '4', '6'],
        }];
        const result = await commitDbEntries(entries);
        expect(result.upserted).toBe(1);
        const arg = upsertMock.mock.calls[0][0] as {
            id?: number;
            replaceKey?: string;
            replaceValues?: string[];
            previousReplaceKey?: string;
        };
        expect(arg.id).toBeUndefined();
        expect(arg.previousReplaceKey).toBeUndefined();
        expect(arg.replaceKey).toBe('n');
        expect(arg.replaceValues).toEqual(['2', '4', '6']);
    });
});

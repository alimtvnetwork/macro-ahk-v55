/**
 * Plan 22 gap #10 (DB side): `commitDbEntries` end-to-end routing.
 *
 * Root cause pinned: `commitDbEntries` routes every role-tagged import
 * entry through `commitOneEntry` -> `findExistingRow` -> `upsertPrompt`,
 * and collates per-entry errors into a single `DbCommitResults`. That
 * end-to-end contract was only exercised via full modal tests (which
 * mock the bridge itself), so a silent regression that (a) counted
 * failed upserts as successes, (b) skipped the missing-slug guard, or
 * (c) treated an invalid role as a DB error instead of a pre-flight
 * rejection would ship with no CI signal.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const listPromptsByRoleMock = vi.fn();
const upsertPromptMock = vi.fn();

vi.mock('../../db/prompt-db', () => ({
    listPromptsByRole: (...args: unknown[]) => listPromptsByRoleMock(...args),
    upsertPrompt: (...args: unknown[]) => upsertPromptMock(...args),
}));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));
vi.mock('../../logging', () => ({ log: vi.fn() }));

import { commitDbEntries } from '../prompt-io-db-bridge';
import type { CachedPromptEntry } from '../prompt-cache';

beforeEach(() => {
    listPromptsByRoleMock.mockReset();
    upsertPromptMock.mockReset();
});

describe('commitDbEntries (Plan 22 gap #10 DB-side integration)', () => {
    it('C1: routes a valid plan entry to upsertPrompt with previousBody/replaceKey carried over', async () => {
        listPromptsByRoleMock.mockResolvedValue({
            ok: true, value: [{ Id: 5, Slug: 's1', Body: 'old {{n}}', ReplaceKey: 'n' }],
        });
        upsertPromptMock.mockResolvedValue({ ok: true, value: 5 });
        const entries: CachedPromptEntry[] = [
            { name: 'S1', text: 'new {{n}}', slug: 's1', role: 'plan', replaceKey: 'n' },
        ];
        const res = await commitDbEntries(entries);
        expect(res).toEqual({ upserted: 1, errors: [], defaultsProtected: 0 });
        expect(upsertPromptMock).toHaveBeenCalledTimes(1);
        const call = upsertPromptMock.mock.calls[0][0];
        expect(call.id).toBe(5);
        expect(call.previousBody).toBe('old {{n}}');
        expect(call.previousReplaceKey).toBe('n');
    });

    it('C2: entry with missing slug is rejected before DB read, no upsert issued', async () => {
        const entries: CachedPromptEntry[] = [
            { name: 'noslug', text: 'x', role: 'plan' },
        ];
        const res = await commitDbEntries(entries);
        expect(res.upserted).toBe(0);
        expect(res.errors[0]).toMatch(/missing slug/);
        expect(upsertPromptMock).not.toHaveBeenCalled();
        expect(listPromptsByRoleMock).not.toHaveBeenCalled();
    });

    it('C3: invalid role short-circuits with "missing role" without touching DB', async () => {
        const entries: CachedPromptEntry[] = [
            // @ts-expect-error - intentional invalid role
            { name: 'x', text: 'y', slug: 's', role: 'bogus' },
        ];
        const res = await commitDbEntries(entries);
        expect(res.upserted).toBe(0);
        expect(res.errors[0]).toMatch(/missing role/);
        expect(upsertPromptMock).not.toHaveBeenCalled();
    });

    it('C4: upsertPrompt failure surfaces per-entry with slug prefix', async () => {
        listPromptsByRoleMock.mockResolvedValue({ ok: true, value: [] });
        upsertPromptMock.mockResolvedValue({ ok: false, error: 'token drift' });
        const entries: CachedPromptEntry[] = [
            { name: 'A', text: 'no tokens', slug: 'plan-a', role: 'plan' },
        ];
        const res = await commitDbEntries(entries);
        expect(res.upserted).toBe(0);
        expect(res.errors).toEqual(['slug=plan-a: token drift']);
    });

    it('C5: mixed batch tallies successes and failures independently (no all-or-nothing)', async () => {
        // Two entries: first succeeds, second fails -> upserted=1, one error.
        listPromptsByRoleMock.mockResolvedValue({ ok: true, value: [] });
        upsertPromptMock
            .mockResolvedValueOnce({ ok: true, value: 10 })
            .mockResolvedValueOnce({ ok: false, error: 'body empty' });
        const entries: CachedPromptEntry[] = [
            { name: 'good', text: 'ok', slug: 'g', role: 'generic' },
            { name: 'bad', text: '', slug: 'b', role: 'generic' },
        ];
        const res = await commitDbEntries(entries);
        expect(res.upserted).toBe(1);
        expect(res.errors).toEqual(['slug=b: body empty']);
    });

    it('C6: creates new row when findExistingRow returns null (no id, no previousBody)', async () => {
        listPromptsByRoleMock.mockResolvedValue({ ok: true, value: [] });
        upsertPromptMock.mockResolvedValue({ ok: true, value: 99 });
        const entries: CachedPromptEntry[] = [
            { name: 'New', text: 'body', slug: 'new-slug', role: 'generic' },
        ];
        const res = await commitDbEntries(entries);
        expect(res).toEqual({ upserted: 1, errors: [], defaultsProtected: 0 });
        const call = upsertPromptMock.mock.calls[0][0];
        expect(call.id).toBeUndefined();
        expect(call.previousBody).toBeUndefined();
    });
});

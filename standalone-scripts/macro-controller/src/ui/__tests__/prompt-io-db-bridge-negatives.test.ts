/**
 * Negative coverage for prompt-io-db-bridge (Plan-22 steps 32-40).
 *
 * The happy paths (partition, merge, commit, drift error) live in
 * `prompt-io-db-bridge.test.ts`. This file locks the failure modes so
 * a silent regression cannot re-appear:
 *
 * 1. `commitDbEntries` must surface `missing role` when an entry has no role.
 * 2. `commitDbEntries` must surface `missing slug for role=...` on empty slug.
 * 3. `collectDbEntriesForExport` must NOT throw when `listPromptsByRole`
 *    returns `{ ok: false }` for a role: it must log via `logError` and
 *    continue with the remaining roles (no silent full-list failure).
 * 4. Empty `commitDbEntries([])` must return `{ upserted: 0, errors: [] }`
 *    and never touch the DB driver.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

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
import { logError } from '../../error-utils';
import type { CachedPromptEntry } from '../prompt-cache';

beforeEach(() => {
    listMock.mockReset();
    upsertMock.mockReset();
    (logError as unknown as Mock).mockClear();
});

describe('commitDbEntries — negative paths', () => {
    it('missing role: reports "missing role" and never calls upsert', async () => {
        const entries: CachedPromptEntry[] = [
            { name: 'X', text: 'x', slug: 'x-1' /* no role */ },
        ];
        const result = await commitDbEntries(entries);
        expect(result.upserted).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('missing role');
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it('empty slug: reports "missing slug for role=<role>" and never calls upsert', async () => {
        const entries: CachedPromptEntry[] = [
            { name: 'X', text: 'x', role: 'plan', slug: '   ' },
        ];
        listMock.mockResolvedValue({ ok: true, value: [] });
        const result = await commitDbEntries(entries);
        expect(result.upserted).toBe(0);
        expect(result.errors[0]).toContain('missing slug for role=plan');
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it('empty entries list: no-op result, no driver calls', async () => {
        const result = await commitDbEntries([]);
        expect(result).toEqual({ upserted: 0, errors: [], defaultsProtected: 0 });
        expect(listMock).not.toHaveBeenCalled();
        expect(upsertMock).not.toHaveBeenCalled();
    });
});

describe('collectDbEntriesForExport — driver failure per role', () => {
    it('logs and continues when listPromptsByRole fails for one role', async () => {
        listMock.mockImplementation(async (role: string) => {
            if (role === 'plan') return { ok: false, error: 'db locked' };
            if (role === 'next') return {
                ok: true,
                value: [{
                    Id: 3, Slug: 'next-default', Name: 'Next default',
                    Body: 'N {{n}}', Role: 'next', IsDefault: 1,
                    CreatedAt: 0, UpdatedAt: 0,
                }],
            };
            return { ok: true, value: [] };
        });

        const result = await collectDbEntriesForExport();
        // plan failed => skipped; next contributed one row; generic empty.
        expect(result).toHaveLength(1);
        expect(result[0].slug).toBe('next-default');
        expect(logError).toHaveBeenCalledWith(
            'PromptIoDbBridge',
            expect.stringContaining('readAllDbRows: listPromptsByRole failed for plan'),
            expect.objectContaining({ ok: false }),
        );
    });
});

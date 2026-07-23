/**
 * Tests for prompt-io-db-bridge (plan-14 steps 12 & 13).
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
    partitionByRole,
    mergeDbIntoExport,
    collectDbEntriesForExport,
    commitDbEntries,
} from '../prompt-io-db-bridge';
import type { CachedPromptEntry } from '../prompt-cache';

const seededRows: Record<string, unknown[]> = {
    plan: [
        { Id: 1, Slug: 'plan-default', Name: 'Plan default', Body: 'P {{n}}', Role: 'plan', IsDefault: 1, CreatedAt: 0, UpdatedAt: 0 },
    ],
    next: [
        { Id: 3, Slug: 'next-default', Name: 'Next default', Body: 'N {{n}}', Role: 'next', IsDefault: 1, CreatedAt: 0, UpdatedAt: 0 },
    ],
    generic: [],
};

beforeEach(() => {
    listMock.mockReset();
    upsertMock.mockReset();
    listMock.mockImplementation(async (role: string) => ({ ok: true, value: seededRows[role] ?? [] }));
    upsertMock.mockImplementation(async () => ({ ok: true, value: 1 }));
});

describe('partitionByRole', () => {
    it('splits role-tagged entries from cache entries', () => {
        const entries: CachedPromptEntry[] = [
            { name: 'A', text: 'a', role: 'plan', slug: 'plan-default' },
            { name: 'B', text: 'b' },
            { name: 'C', text: 'c', role: 'generic', slug: 'g-1' },
        ];
        const { dbEntries, cacheEntries } = partitionByRole(entries);
        expect(dbEntries.map((e) => e.name)).toEqual(['A', 'C']);
        expect(cacheEntries.map((e) => e.name)).toEqual(['B']);
    });
});

describe('collectDbEntriesForExport', () => {
    it('reads every role and maps rows to CachedPromptEntry', async () => {
        const result = await collectDbEntriesForExport();
        expect(result).toHaveLength(2);
        const plan = result.find((e) => e.slug === 'plan-default')!;
        expect(plan.role).toBe('plan');
        expect(plan.text).toBe('P {{n}}');
        expect(plan.isDefault).toBe(true);
    });
});

describe('mergeDbIntoExport', () => {
    it('lets DB rows win on slug collision', () => {
        const cache: CachedPromptEntry[] = [
            { name: 'Old plan', text: 'stale', slug: 'plan-default' },
            { name: 'Free', text: 'free', slug: 'freeform' },
        ];
        const db: CachedPromptEntry[] = [
            { name: 'Fresh plan', text: 'fresh', slug: 'plan-default', role: 'plan' },
        ];
        const merged = mergeDbIntoExport(cache, db);
        expect(merged.map((e) => e.name)).toEqual(['Fresh plan', 'Free']);
    });
});

describe('commitDbEntries', () => {
    it('routes plan entry through upsertPrompt with previousBody + existing id', async () => {
        const entries: CachedPromptEntry[] = [
            { name: 'Plan default', text: 'P {{n}} edited', slug: 'plan-default', role: 'plan' },
        ];
        const result = await commitDbEntries(entries);
        expect(result.upserted).toBe(1);
        expect(result.errors).toEqual([]);
        expect(upsertMock).toHaveBeenCalledTimes(1);
        const arg = upsertMock.mock.calls[0][0] as { id?: number; previousBody?: string; body: string; slug: string; role: string };
        expect(arg.id).toBe(1);
        expect(arg.previousBody).toBe('P {{n}}');
        expect(arg.body).toBe('P {{n}} edited');
        expect(arg.role).toBe('plan');
    });

    it('inserts a brand-new row when the slug is not in the DB', async () => {
        const entries: CachedPromptEntry[] = [
            { name: 'Custom', text: 'C {{n}}', slug: 'plan-custom', role: 'plan' },
        ];
        const result = await commitDbEntries(entries);
        expect(result.upserted).toBe(1);
        const arg = upsertMock.mock.calls[0][0] as { id?: number; previousBody?: string };
        expect(arg.id).toBeUndefined();
        expect(arg.previousBody).toBeUndefined();
    });

    it('captures upsert errors as per-entry error strings (no swallowing)', async () => {
        upsertMock.mockImplementationOnce(async () => ({ ok: false, error: 'token drift: {{n}} removed' }));
        const entries: CachedPromptEntry[] = [
            { name: 'Bad', text: 'no token here', slug: 'plan-default', role: 'plan' },
        ];
        const result = await commitDbEntries(entries);
        expect(result.upserted).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('plan-default');
        expect(result.errors[0]).toContain('token drift');
    });
});

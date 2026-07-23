/**
 * Plan 22 gap #11: `performPromptImport` revision round-trip.
 *
 * Locks the six branches of `commitRevisions` (prompt-io.ts:427-459):
 *  RR1: revisions inserted for every slug present in the committed entries.
 *  RR2: orphan revisions (slug NOT in committed entries) are filtered out
 *       and reported once via `results.errors`.
 *  RR3: `insertImportedRevisions` failure per slug is reported to
 *       `results.errors` without aborting the loop.
 *  RR4: progress emitter yields `entries` -> `revisions` (per group) -> `done`
 *       with monotonically increasing `insertedRevisions`/`groupsDone`.
 *  RR5: `results.revisionsImported` is set ONLY when at least one row was
 *       inserted (guards a silent "0" leaking into success toasts).
 *  RR6: when `options.revisions` is empty, `commitRevisions` is not entered
 *       and no `insertImportedRevisions` call fires; `phase: 'done'` still
 *       emits with `insertedRevisions: 0`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPromptLoaderMock } from './helpers/prompt-loader-mock';

vi.mock('../ui/prompt-cache', () => ({
    readJsonCopy: vi.fn(async () => ({ entries: [] })),
    writeJsonCopy: vi.fn(async () => undefined),
    clearPromptCache: vi.fn(async () => undefined),
}));
vi.mock('../ui/prompt-io-db-bridge', () => ({
    partitionByRole: vi.fn((entries: unknown[]) => ({ dbEntries: entries, cacheEntries: [] })),
    commitDbEntries: vi.fn(async (entries: { slug?: string }[]) => ({ upserted: entries.length, errors: [] })),
}));
vi.mock('../ui/prompt-loader', () => buildPromptLoaderMock({ invalidatePromptCache: vi.fn() }));
vi.mock('../toast', () => ({ showToast: vi.fn() }));
vi.mock('../logging', () => ({ log: vi.fn() }));
vi.mock('../shared-state', () => ({ VERSION: 'v0.test.0' }));

const insertImportedRevisions = vi.fn();
vi.mock('../db/prompt-revision-db', () => ({
    listPromptRevisions: vi.fn(async () => ({ ok: true, value: [] })),
    insertImportedRevisions: (...args: unknown[]) => insertImportedRevisions(...args),
}));

import { performPromptImport } from '../ui/prompt-io';
import type { BundleRevisionRow } from '../ui/prompt-bundle-types';

const entry = (slug: string, role: 'plan' | 'next' = 'plan') => ({
    id: slug, title: slug, body: 'x {{n}} y', role, slug, updatedAt: 1,
}) as unknown as Parameters<typeof performPromptImport>[0][number];

const rev = (slug: string, revisionId = 1): BundleRevisionRow => ({
    Slug: slug, RevisionId: revisionId, Body: 'body-' + revisionId, CreatedAt: 1,
} as unknown as BundleRevisionRow);

describe('performPromptImport: revision round-trip (Plan 22 gap #11)', () => {
    beforeEach(() => { insertImportedRevisions.mockReset(); });

    it('RR1+RR4+RR5: inserts revisions for committed slugs and emits progress', async () => {
        insertImportedRevisions.mockResolvedValue({ ok: true });
        const events: string[] = [];
        const res = await performPromptImport(
            [entry('alpha'), entry('beta')],
            {
                revisions: [rev('alpha', 1), rev('alpha', 2), rev('beta', 1)],
                onProgress: (p) => events.push(`${p.phase}:${p.insertedRevisions}/${p.totalRevisions}:${p.groupsDone}/${p.totalGroups}`),
            },
        );
        expect(insertImportedRevisions).toHaveBeenCalledTimes(2);
        expect(res.revisionsImported).toBe(3);
        expect(res.errors).toEqual([]);
        expect(events[0]).toMatch(/^entries:0\/3:0\/0$/);
        expect(events).toContain('done:3/3:0/0');
        const revEvents = events.filter((e) => e.startsWith('revisions:'));
        expect(revEvents.length).toBeGreaterThanOrEqual(2);
        expect(revEvents[revEvents.length - 1]).toBe('revisions:3/3:2/2');
    });

    it('RR2: orphan revisions (slug not in committed entries) are dropped and reported', async () => {
        insertImportedRevisions.mockResolvedValue({ ok: true });
        const res = await performPromptImport(
            [entry('alpha')],
            { revisions: [rev('alpha'), rev('ghost'), rev('ghost', 2)] },
        );
        expect(insertImportedRevisions).toHaveBeenCalledTimes(1);
        expect(insertImportedRevisions.mock.calls[0]![0]).toBe('alpha');
        expect(res.errors.some((e) => /2 revision rows dropped/.test(e))).toBe(true);
        expect(res.revisionsImported).toBe(1);
    });

    it('RR3: per-slug insertion failure is recorded but the loop continues', async () => {
        insertImportedRevisions.mockImplementation(async (slug: string) =>
            slug === 'alpha' ? { ok: false, error: 'DB_LOCKED' } : { ok: true },
        );
        const res = await performPromptImport(
            [entry('alpha'), entry('beta')],
            { revisions: [rev('alpha'), rev('beta')] },
        );
        expect(insertImportedRevisions).toHaveBeenCalledTimes(2);
        expect(res.errors.some((e) => e.includes('alpha') && e.includes('DB_LOCKED'))).toBe(true);
        expect(res.revisionsImported).toBe(1);
    });

    it('RR5: revisionsImported is undefined when zero rows insert', async () => {
        insertImportedRevisions.mockResolvedValue({ ok: false, error: 'x' });
        const res = await performPromptImport(
            [entry('alpha')],
            { revisions: [rev('alpha')] },
        );
        expect(res.revisionsImported).toBeUndefined();
    });

    it('RR6: no revisions option skips commitRevisions entirely', async () => {
        const events: string[] = [];
        const res = await performPromptImport(
            [entry('alpha')],
            { onProgress: (p) => events.push(p.phase) },
        );
        expect(insertImportedRevisions).not.toHaveBeenCalled();
        expect(res.revisionsImported).toBeUndefined();
        expect(events).toContain('done');
        expect(events).not.toContain('revisions');
    });
});

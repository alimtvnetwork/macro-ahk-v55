/**
 * v4.192.0 regression: `performPromptImport({ onProgress })` fires
 * observable progress events for the collection-level import so the
 * modal can render a live indicator.
 *
 * Contract asserted here:
 *   1. `entries` phase fires exactly once, after DB commit, with the
 *      committed count and the total revisions the caller passed in.
 *   2. `revisions` phase fires once with `insertedRevisions=0` before
 *      the first insert, then once per per-slug group with the correct
 *      cumulative `insertedRevisions` / `groupsDone` counters and a
 *      `slug` reference so the UI can name the row being processed.
 *   3. `done` phase fires exactly once at the very end, whether or not
 *      any revisions were carried in the bundle.
 *   4. A throwing listener never aborts the pipeline; the returned
 *      `PromptImportResults` still reflects the completed import.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({ invalidatePromptCache: vi.fn() }));
vi.mock('../prompt-loader', () => buildPromptLoaderMock({ invalidatePromptCache: vi.fn() }));

vi.mock('../../db/prompt-revision-db', () => ({
    listPromptRevisions: vi.fn(async () => ({ ok: true, value: [] })),
    insertImportedRevisions: vi.fn(async (_slug: string, rows: readonly unknown[]) => ({ ok: true, value: rows.length })),
    getMaxRevisionId: vi.fn(async () => ({ ok: true, value: 0 })),
    deleteImportedRevisionsAfter: vi.fn(async () => ({ ok: true, value: 0 })),
    recordPromptRevision: vi.fn(async () => ({ ok: true, value: 1 })),
    PROMPT_REVISION_LIMIT_PER_SLUG: 20,
}));

vi.mock('../prompt-cache', () => ({
    readJsonCopy: vi.fn(async () => ({ entries: [] })),
    writeJsonCopy: vi.fn(async () => undefined),
    clearPromptCache: vi.fn(async () => undefined),
}));

vi.mock('../prompt-io-db-bridge', () => ({
    partitionByRole: vi.fn((entries: { role?: string }[]) => {
        const dbEntries = entries.filter((e) => e.role === 'plan' || e.role === 'next' || e.role === 'generic');
        const cacheEntries = entries.filter((e) => !dbEntries.includes(e));
        return { dbEntries, cacheEntries };
    }),
    commitDbEntries: vi.fn(async (entries: unknown[]) => ({ upserted: entries.length, errors: [] })),
    collectDbEntriesForExport: vi.fn(async () => []),
    mergeDbIntoExport: vi.fn((c: unknown[], d: unknown[]) => [...d, ...c]),
}));

import { performPromptImport, type ImportProgress } from '../prompt-io';

beforeEach(() => { /* mocks reset by vi.mock scoping */ });

const rev = (slug: string, ts: number) => ({
    Slug: slug, Name: slug, Body: 'b', Role: 'plan' as const,
    ReplaceKey: '', ReplaceValues: '[]', CreatedAt: ts, Reason: 'upsert',
});

describe('performPromptImport progress events', () => {
    it('emits entries, revisions milestones, and done in order', async () => {
        const entries = [
            { name: 'A', text: 'a', slug: 'plan-a', role: 'plan' as const },
            { name: 'B', text: 'b', slug: 'plan-b', role: 'plan' as const },
        ];
        const revisions = [rev('plan-a', 1), rev('plan-a', 2), rev('plan-b', 3)];
        const events: ImportProgress[] = [];
        await performPromptImport(entries, { revisions, onProgress: (p) => events.push(p) });

        const phases = events.map((e) => e.phase);
        expect(phases[0]).toBe('entries');
        expect(phases[phases.length - 1]).toBe('done');
        expect(phases.filter((p) => p === 'entries')).toHaveLength(1);
        expect(phases.filter((p) => p === 'done')).toHaveLength(1);

        const revEvents = events.filter((e) => e.phase === 'revisions');
        // 1 initial + 1 per group (2 slugs) = 3
        expect(revEvents).toHaveLength(3);
        expect(revEvents[0]).toMatchObject({ insertedRevisions: 0, totalRevisions: 3, groupsDone: 0, totalGroups: 2 });
        expect(revEvents[1]).toMatchObject({ groupsDone: 1 });
        expect(revEvents[2]).toMatchObject({ groupsDone: 2, insertedRevisions: 3 });
        // Cumulative revisions counter is monotonic non-decreasing.
        for (let i = 1; i < revEvents.length; i++) {
            expect(revEvents[i]!.insertedRevisions).toBeGreaterThanOrEqual(revEvents[i - 1]!.insertedRevisions);
        }
        // Per-group events carry the slug that was just processed.
        expect(revEvents.slice(1).every((e) => typeof e.slug === 'string' && e.slug.length > 0)).toBe(true);
    });

    it('still emits entries + done when the bundle has no revisions', async () => {
        const events: ImportProgress[] = [];
        await performPromptImport(
            [{ name: 'A', text: 'a', slug: 'plan-a', role: 'plan' as const }],
            { onProgress: (p) => events.push(p) },
        );
        expect(events.map((e) => e.phase)).toEqual(['entries', 'done']);
        expect(events[0]).toMatchObject({ entriesCommitted: 1, totalRevisions: 0 });
    });

    it('a throwing listener does not abort the import', async () => {
        const entries = [{ name: 'A', text: 'a', slug: 'plan-a', role: 'plan' as const }];
        const revisions = [rev('plan-a', 1)];
        const res = await performPromptImport(entries, {
            revisions,
            onProgress: () => { throw new Error('boom'); },
        });
        expect(res.total).toBe(1);
        expect(res.revisionsImported).toBe(1);
    });
});

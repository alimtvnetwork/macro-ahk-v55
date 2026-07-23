/**
 * v4.190.0 regression coverage for:
 *   1. `exportPromptsToJson({ includeRevisions: true })` opt-in.
 *   2. Envelope round-trip preserves `revisions[]`.
 *   3. `applyRoleFilter` bulk role-scoping.
 *   4. `performPromptImport({ roleFilter, revisions })` end-to-end.
 *
 * The tests avoid the DOM download path (Blob/anchor) and exercise the
 * pure logic surface + the DB bridge boundary. Prompt-loader is mocked
 * via the shared factory per project CI guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({ invalidatePromptCache: vi.fn() }));
vi.mock('../prompt-loader', () => buildPromptLoaderMock({ invalidatePromptCache: vi.fn() }));

// Stub the DB revision layer so we can observe call arguments.
vi.mock('../../db/prompt-revision-db', () => ({
    listPromptRevisions: vi.fn(async (_slug: string) => ({ ok: true, value: [] as unknown[] })),
    insertImportedRevisions: vi.fn(async (_slug: string, rows: readonly unknown[]) => ({ ok: true, value: rows.length })),
    getMaxRevisionId: vi.fn(async () => ({ ok: true, value: 0 })),
    deleteImportedRevisionsAfter: vi.fn(async () => ({ ok: true, value: 0 })),
    recordPromptRevision: vi.fn(async () => ({ ok: true, value: 1 })),
    PROMPT_REVISION_LIMIT_PER_SLUG: 20,
}));

// Isolate the JSON-cache & bridge writes.
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

import { applyRoleFilter, performPromptImport, parsePromptsText } from '../prompt-io';
import { buildPromptsBundle } from '../prompt-bundle-types';
import * as revisionDb from '../../db/prompt-revision-db';

const insertImportedRevisionsMock = vi.mocked(revisionDb.insertImportedRevisions);
const listPromptRevisionsMock = vi.mocked(revisionDb.listPromptRevisions);

beforeEach(() => {
    listPromptRevisionsMock.mockClear();
    insertImportedRevisionsMock.mockClear();
});

describe('applyRoleFilter', () => {
    it('keeps only matching-role entries and counts drops', () => {
        const entries = [
            { name: 'A', text: '', role: 'plan' as const },
            { name: 'B', text: '', role: 'next' as const },
            { name: 'C', text: '' },
        ];
        const r = applyRoleFilter(entries, 'plan');
        expect(r.kept).toHaveLength(1);
        expect(r.kept[0]?.name).toBe('A');
        expect(r.droppedCount).toBe(2);
    });

    it('is a pass-through when no filter given', () => {
        const entries = [{ name: 'A', text: '' }];
        const r = applyRoleFilter(entries, undefined);
        expect(r.kept).toEqual(entries);
        expect(r.droppedCount).toBe(0);
    });

    it('drops entries whose role is undefined or invalid', () => {
        const entries = [
            { name: 'A', text: '', role: 'plan' as const },
            { name: 'B', text: '' },
            // Deliberately invalid at runtime — validates the guard.
            { name: 'C', text: '', role: 'garbage' as unknown as 'plan' },
        ];
        const r = applyRoleFilter(entries, 'plan');
        expect(r.kept.map((e) => e.name)).toEqual(['A']);
        expect(r.droppedCount).toBe(2);
    });
});

describe('bundle revisions round-trip', () => {
    it('buildPromptsBundle drops revisions whose slug is not in entries', () => {
        const bundle = buildPromptsBundle(
            [{ name: 'P', text: 'body', slug: 'plan-1' }],
            '4.190.0',
            {
                revisions: [
                    { Slug: 'plan-1', Name: 'P', Body: 'old', Role: 'plan', ReplaceKey: '', ReplaceValues: '[]', CreatedAt: 1, Reason: 'upsert' },
                    { Slug: 'orphan', Name: 'X', Body: 'x', Role: 'plan', ReplaceKey: '', ReplaceValues: '[]', CreatedAt: 2, Reason: 'upsert' },
                ],
            },
        );
        expect(bundle.revisions).toHaveLength(1);
        expect(bundle.revisions?.[0]?.Slug).toBe('plan-1');
    });

    it('parsePromptsText preserves revisions from a valid envelope', () => {
        const bundle = buildPromptsBundle(
            [{ name: 'P', text: 'body', slug: 'plan-1' }],
            '4.190.0',
            {
                revisions: [
                    { Slug: 'plan-1', Name: 'P', Body: 'old', Role: 'plan', ReplaceKey: '', ReplaceValues: '[]', CreatedAt: 1, Reason: 'upsert' },
                ],
            },
        );
        const parsed = parsePromptsText(JSON.stringify(bundle));
        expect(parsed.errors).toEqual([]);
        expect(parsed.valid).toHaveLength(1);
        expect(parsed.revisions).toHaveLength(1);
        expect(parsed.revisions?.[0]?.Slug).toBe('plan-1');
    });

    it('parsePromptsText yields no revisions field when envelope omits it', () => {
        const bundle = buildPromptsBundle([{ name: 'P', text: 'body', slug: 'plan-1' }], '4.190.0');
        const parsed = parsePromptsText(JSON.stringify(bundle));
        expect(parsed.revisions).toBeUndefined();
    });
});

describe('performPromptImport with roleFilter + revisions', () => {
    it('drops non-matching entries and reports the count', async () => {
        const entries = [
            { name: 'A', text: 'a', slug: 'plan-a', role: 'plan' as const },
            { name: 'B', text: 'b', slug: 'next-b', role: 'next' as const },
        ];
        const res = await performPromptImport(entries, { roleFilter: 'plan' });
        expect(res.total).toBe(2);
        expect(res.updated).toBe(1);
        expect(res.errors.some((e) => e.includes('roleFilter=plan'))).toBe(true);
    });

    it('groups imported revisions by slug and skips orphans', async () => {
        const entries = [{ name: 'A', text: 'a', slug: 'plan-a', role: 'plan' as const }];
        const revisions = [
            { Slug: 'plan-a', Name: 'A', Body: 'old', Role: 'plan' as const, ReplaceKey: '', ReplaceValues: '[]', CreatedAt: 1, Reason: 'upsert' },
            { Slug: 'orphan', Name: 'X', Body: 'x', Role: 'plan' as const, ReplaceKey: '', ReplaceValues: '[]', CreatedAt: 2, Reason: 'upsert' },
        ];
        const res = await performPromptImport(entries, { revisions });
        expect(insertImportedRevisionsMock).toHaveBeenCalledTimes(1);
        expect(insertImportedRevisionsMock).toHaveBeenCalledWith('plan-a', [revisions[0]]);
        expect(res.errors.some((e) => e.includes('1 revision rows dropped'))).toBe(true);
    });
});

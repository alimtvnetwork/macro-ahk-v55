/**
 * v4.192.0: sortRevisions + filterRevisions are pure helpers powering the
 * History panel toolbar (sortable Date/Reason columns, reason chips, and
 * an imported provenance filter).
 */
import { describe, it, expect } from 'vitest';
import { sortRevisions, filterRevisions } from '../prompt-history-panel';

const row = (over: Partial<Record<string, unknown>> = {}) => ({
    Id: 1,
    PromptId: 1,
    Slug: 's',
    Name: 'n',
    Body: 'b',
    Role: 'plan',
    ReplaceKey: 'n',
    ReplaceValues: '[]',
    CreatedAt: 1,
    Reason: 'upsert',
    ...over,
}) as Parameters<typeof sortRevisions>[0][number];

describe('sortRevisions', () => {
    const rows = [
        row({ Id: 1, CreatedAt: 100, Reason: 'upsert' }),
        row({ Id: 2, CreatedAt: 300, Reason: 'restore' }),
        row({ Id: 3, CreatedAt: 200, Reason: 'import' }),
    ];

    it('sorts by date desc by default view', () => {
        const out = sortRevisions(rows, 'date', 'desc').map((r) => r.Id);
        expect(out).toEqual([2, 3, 1]);
    });

    it('sorts by date asc', () => {
        const out = sortRevisions(rows, 'date', 'asc').map((r) => r.Id);
        expect(out).toEqual([1, 3, 2]);
    });

    it('sorts by reason alphabetically', () => {
        const asc = sortRevisions(rows, 'reason', 'asc').map((r) => r.Reason);
        expect(asc).toEqual(['import', 'restore', 'upsert']);
        const desc = sortRevisions(rows, 'reason', 'desc').map((r) => r.Reason);
        expect(desc).toEqual(['upsert', 'restore', 'import']);
    });

    it('does not mutate the input array', () => {
        const original = rows.slice();
        sortRevisions(rows, 'date', 'asc');
        expect(rows).toEqual(original);
    });

    it('breaks reason ties by newest CreatedAt then highest Id', () => {
        const tied = [
            row({ Id: 10, CreatedAt: 100, Reason: 'upsert' }),
            row({ Id: 11, CreatedAt: 200, Reason: 'upsert' }),
            row({ Id: 12, CreatedAt: 200, Reason: 'upsert' }),
        ];
        const out = sortRevisions(tied, 'reason', 'asc').map((r) => r.Id);
        expect(out).toEqual([12, 11, 10]);
    });
});

describe('filterRevisions', () => {
    const rows = [
        row({ Id: 1, Reason: 'upsert', PromptId: 5 }),
        row({ Id: 2, Reason: 'restore', PromptId: 5 }),
        row({ Id: 3, Reason: 'import', PromptId: 0 }),
        row({ Id: 4, Reason: 'upsert', PromptId: 0 }),
    ];

    it('empty reason set keeps every row', () => {
        const out = filterRevisions(rows, { reasons: new Set(), imported: 'all' });
        expect(out.map((r) => r.Id)).toEqual([1, 2, 3, 4]);
    });

    it('keeps only rows whose Reason is selected', () => {
        const out = filterRevisions(rows, { reasons: new Set(['upsert']), imported: 'all' });
        expect(out.map((r) => r.Id)).toEqual([1, 4]);
    });

    it('imported=only keeps PromptId=0 rows', () => {
        const out = filterRevisions(rows, { reasons: new Set(), imported: 'only' });
        expect(out.map((r) => r.Id)).toEqual([3, 4]);
    });

    it('imported=exclude drops PromptId=0 rows', () => {
        const out = filterRevisions(rows, { reasons: new Set(), imported: 'exclude' });
        expect(out.map((r) => r.Id)).toEqual([1, 2]);
    });

    it('combines reason chips with imported filter', () => {
        const out = filterRevisions(rows, { reasons: new Set(['upsert']), imported: 'only' });
        expect(out.map((r) => r.Id)).toEqual([4]);
    });
});

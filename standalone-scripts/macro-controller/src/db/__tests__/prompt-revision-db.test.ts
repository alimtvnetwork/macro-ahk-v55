/**
 * Tests for prompt-revision-db.ts: append + trim + list + get.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let responsesQueue: Record<string, unknown>[] = [];
let fallback: Record<string, unknown> = { isOk: true, rows: [], lastInsertId: 1 };

vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
    sendToExtension: vi.fn(async (_c: string, p: { method: string; params: { sql: string } }) => {
        captured.push({ method: p.method, sql: p.params.sql });
        return responsesQueue.shift() ?? fallback;
    }),
}));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logError: vi.fn(), logDiagnosticFromCode: vi.fn() };
});
vi.mock('../../logging', () => ({ log: vi.fn() }));

import {
    recordPromptRevision,
    listPromptRevisions,
    getPromptRevisionById,
    PROMPT_REVISION_LIMIT_PER_SLUG,
} from '../prompt-revision-db';
import type { PromptRow } from '../prompt-db';

const samplePrompt = (over: Partial<PromptRow> = {}): PromptRow => ({
    Id: 7,
    Slug: 'plan-default',
    Name: 'Plan default',
    Body: '# Plan {{n}}',
    Role: 'plan',
    IsDefault: 1,
    ReplaceKey: 'n',
    ReplaceValues: ['1', '2', '3'],
    CreatedAt: 100,
    UpdatedAt: 200,
    ...over,
});

beforeEach(() => {
    captured.length = 0;
    responsesQueue = [];
    fallback = { isOk: true, rows: [], lastInsertId: 42 };
});

describe('recordPromptRevision', () => {
    it('inserts the pre-image row and issues a trim DELETE afterwards', async () => {
        const r = await recordPromptRevision({ previous: samplePrompt(), reason: 'upsert' });
        expect(r.ok).toBe(true);
        expect(r.value).toBe(42);
        expect(captured).toHaveLength(2);
        expect(captured[0].sql).toMatch(/^INSERT INTO PromptRevision/);
        expect(captured[0].sql).toContain("'plan-default'");
        expect(captured[0].sql).toContain("'# Plan {{n}}'");
        expect(captured[0].sql).toContain('["1","2","3"]');
        expect(captured[0].sql).toContain("'upsert'");
        expect(captured[1].sql).toMatch(/^DELETE FROM PromptRevision WHERE Slug = 'plan-default'/);
        expect(captured[1].sql).toContain('LIMIT ' + String(PROMPT_REVISION_LIMIT_PER_SLUG));
    });

    it('rejects a pre-image with invalid Id, no SQL emitted', async () => {
        const r = await recordPromptRevision({ previous: samplePrompt({ Id: 0 }), reason: 'upsert' });
        expect(r.ok).toBe(false);
        expect(captured).toHaveLength(0);
    });

    it('rejects a pre-image with invalid role', async () => {
        const r = await recordPromptRevision({
            previous: samplePrompt({ Role: 'garbage' as never }),
            reason: 'upsert',
        });
        expect(r.ok).toBe(false);
        expect(captured).toHaveLength(0);
    });

    it('escapes single quotes in Body via sqlLit', async () => {
        const r = await recordPromptRevision({
            previous: samplePrompt({ Body: "it's fine" }),
            reason: 'manual',
        });
        expect(r.ok).toBe(true);
        expect(captured[0].sql).toContain("'it''s fine'");
    });
});

describe('listPromptRevisions', () => {
    it('emits SELECT ordered newest first, mapping rows to typed shape', async () => {
        responsesQueue = [{
            isOk: true,
            rows: [
                { Id: 9, PromptId: 7, Slug: 'plan-default', Name: 'x', Body: 'old', Role: 'plan',
                  ReplaceKey: 'n', ReplaceValues: '["1"]', CreatedAt: 500, Reason: 'upsert' },
            ],
        }];
        const r = await listPromptRevisions('plan-default');
        expect(r.ok).toBe(true);
        expect(r.value).toHaveLength(1);
        expect(r.value?.[0].Id).toBe(9);
        expect(r.value?.[0].Body).toBe('old');
        expect(captured[0].sql).toContain('ORDER BY CreatedAt DESC, Id DESC');
    });

    it('rejects empty slug without touching DB', async () => {
        const r = await listPromptRevisions('');
        expect(r.ok).toBe(false);
        expect(captured).toHaveLength(0);
    });
});

describe('getPromptRevisionById', () => {
    it('returns undefined when the id has no row', async () => {
        responsesQueue = [{ isOk: true, rows: [] }];
        const r = await getPromptRevisionById(999);
        expect(r.ok).toBe(true);
        expect(r.value).toBeUndefined();
    });

    it('rejects non-positive ids without touching DB', async () => {
        const r = await getPromptRevisionById(0);
        expect(r.ok).toBe(false);
        expect(captured).toHaveLength(0);
    });
});

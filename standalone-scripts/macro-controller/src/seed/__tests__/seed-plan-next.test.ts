/**
 * Tests for the idempotent Plan/Next seeder + boot telemetry (v4.72.0).
 * Call sequence: [pre-select existing slugs] -> [INSERT OR IGNORE]
 *   -> [hasDefault plan] -> [maybe promote plan]
 *   -> [hasDefault next] -> [maybe promote next].
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let responsesQueue: Record<string, unknown>[] = [];
const logCalls: Array<{ message: string; level?: string | undefined }> = [];

vi.mock('../../db/extension-bridge', () => ({
    sendToExtension: vi.fn(async (_c: string, p: { method: string; params: { sql: string } }) => {
        captured.push({ method: p.method, sql: p.params.sql });
        return responsesQueue.shift() ?? { isOk: true, rows: [] };
    }),
}));
vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
    sendToExtension: vi.fn(async (_c: string, p: { method: string; params: { sql: string } }) => {
        captured.push({ method: p.method, sql: p.params.sql });
        return responsesQueue.shift() ?? { isOk: true, rows: [] };
    }),
}));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logError: vi.fn(), logDiagnosticFromCode: vi.fn() };
});
vi.mock('../../logging', () => ({
    log: vi.fn((message: string, level?: string) => { logCalls.push({ message, level }); }),
}));

import { seedPlanNextPrompts } from '../seed-plan-next';

beforeEach(() => {
    captured.length = 0; responsesQueue = []; logCalls.length = 0;
    try { localStorage.removeItem('marco_last_seed_telemetry'); } catch { /* jsdom */ }
});

describe('seedPlanNextPrompts', () => {
    it('first boot: pre-select empty -> insert -> promotes both role defaults; telemetry reports all inserted', async () => {
        // Sequence (post-SQL-queue drift repair): [0] pre-select, [1] INSERT OR IGNORE,
        // [2] legacy read plan-default, [3] legacy read next-default,
        // [4] hasDefault plan, [5] promote plan, [6] hasDefault next, [7] promote next,
        // [8] audit-log INSERT (because inserts+promotes occurred).
        responsesQueue = [
            { isOk: true, rows: [] },                 // pre-select existing slugs -> none
            { isOk: true },                            // INSERT OR IGNORE
            { isOk: true, rows: [] },                 // legacy read plan-default (row-missing -> skip)
            { isOk: true, rows: [] },                 // legacy read next-default (row-missing -> skip)
            { isOk: true, rows: [] },                 // hasDefault plan -> none
            { isOk: true },                            // promote plan-default
            { isOk: true, rows: [] },                 // hasDefault next -> none
            { isOk: true },                            // promote next-default
            { isOk: true },                            // audit-log INSERT
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(true);
        expect(captured).toHaveLength(9);
        expect(captured[0].sql).toMatch(/^SELECT Slug FROM Prompt WHERE Slug IN/);
        expect(captured[1].sql).toMatch(/^INSERT OR IGNORE INTO Prompt/);
        expect(captured[5].sql).toBe("UPDATE Prompt SET IsDefault = 1 WHERE Slug = 'plan-default' AND Role = 'plan'");
        expect(captured[7].sql).toBe("UPDATE Prompt SET IsDefault = 1 WHERE Slug = 'next-default' AND Role = 'next'");
        expect(captured[8].sql).toMatch(/^INSERT INTO PromptSeedAudit/);
        const plan = r.telemetry?.find(t => t.role === 'plan');
        const next = r.telemetry?.find(t => t.role === 'next');
        expect(plan).toMatchObject({ inserted: 4, skipped: 0, promotedDefault: 1, alreadyDefault: 0 });
        expect(next).toMatchObject({ inserted: 4, skipped: 0, promotedDefault: 1, alreadyDefault: 0 });
        expect(logCalls.some(c => c.message.includes('[SeedPlanNext]'))).toBe(true);
    });

    it('second boot: all slugs already present, defaults preserved -> zero inserts, zero promotes, audit skipped', async () => {
        const allSlugs = [
            'plan-default', 'plan-concise', 'plan-with-evidence', 'plan-risk-annotated',
            'next-default', 'next-concise', 'next-with-time', 'next-with-risk',
        ].map(s => ({ Slug: s }));
        responsesQueue = [
            { isOk: true, rows: allSlugs },           // pre-select -> all present
            { isOk: true },                            // INSERT OR IGNORE (driver no-op)
            { isOk: true, rows: [] },                 // legacy read plan-default (skip)
            { isOk: true, rows: [] },                 // legacy read next-default (skip)
            { isOk: true, rows: [{ '1': 1 }] },       // hasDefault plan
            { isOk: true, rows: [{ '1': 1 }] },       // hasDefault next
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(true);
        expect(captured).toHaveLength(6);
        expect(captured.some(c => c.sql.startsWith('UPDATE Prompt SET IsDefault = 1'))).toBe(false);
        expect(captured.some(c => c.sql.startsWith('INSERT INTO PromptSeedAudit'))).toBe(false);
        const plan = r.telemetry?.find(t => t.role === 'plan');
        expect(plan).toMatchObject({ inserted: 0, skipped: 4, promotedDefault: 0, alreadyDefault: 1 });
    });

    it('mixed: plan default already set, next default missing -> promotes only next + writes audit row', async () => {
        responsesQueue = [
            { isOk: true, rows: [] },
            { isOk: true },
            { isOk: true, rows: [] },                 // legacy read plan-default (skip)
            { isOk: true, rows: [] },                 // legacy read next-default (skip)
            { isOk: true, rows: [{ '1': 1 }] },       // plan has default
            { isOk: true, rows: [] },                 // next missing
            { isOk: true },                            // promote next
            { isOk: true },                            // audit-log INSERT
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(true);
        expect(captured).toHaveLength(8);
        expect(captured[6].sql).toContain("Slug = 'next-default'");
        expect(captured[7].sql).toMatch(/^INSERT INTO PromptSeedAudit/);
        const next = r.telemetry?.find(t => t.role === 'next');
        expect(next?.promotedDefault).toBe(1);
    });

    it('surfaces INSERT failure instead of swallowing it', async () => {
        responsesQueue = [
            { isOk: true, rows: [] },                 // pre-select
            { isOk: false, errorMessage: 'disk full' },
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/disk full/);
    });

    it('INSERT SQL includes all 8 seed rows', async () => {
        responsesQueue = [
            { isOk: true, rows: [] },
            { isOk: true },
            { isOk: true, rows: [] },                 // legacy read plan-default
            { isOk: true, rows: [] },                 // legacy read next-default
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true, rows: [{ '1': 1 }] },
        ];
        await seedPlanNextPrompts();
        const sql = captured[1].sql;
        for (const slug of [
            'plan-default', 'plan-concise', 'plan-with-evidence', 'plan-risk-annotated',
            'next-default', 'next-concise', 'next-with-time', 'next-with-risk',
        ]) {
            expect(sql, 'seed SQL must include ' + slug).toContain("'" + slug + "'");
        }
    });

    it('persists telemetry to localStorage under marco_last_seed_telemetry', async () => {
        responsesQueue = [
            { isOk: true, rows: [] },
            { isOk: true },
            { isOk: true, rows: [] },                 // legacy read plan-default
            { isOk: true, rows: [] },                 // legacy read next-default
            { isOk: true, rows: [] },
            { isOk: true },
            { isOk: true, rows: [] },
            { isOk: true },
            { isOk: true },                            // audit-log INSERT
        ];
        await seedPlanNextPrompts();
        const raw = localStorage.getItem('marco_last_seed_telemetry');
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw ?? '{}');
        expect(typeof parsed.at).toBe('string');
        expect(Array.isArray(parsed.roles)).toBe(true);
        const plan = parsed.roles.find((r: { role: string }) => r.role === 'plan');
        expect(plan).toMatchObject({ inserted: 4, promotedDefault: 1 });
    });
});

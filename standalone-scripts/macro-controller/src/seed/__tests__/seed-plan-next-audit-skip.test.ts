/**
 * Plan-22 gap: `writeSeedAuditRow` no-observable-change SKIP path coverage.
 *
 * Root cause (one sentence): `seed-plan-next.ts` short-circuits the audit
 * INSERT when a boot inserts zero rows, promotes zero defaults, and upgrades
 * zero legacy bodies, but no test locks that branch, so a silent regression
 * that starts writing an audit row on every idempotent boot would produce
 * unbounded PromptSeedAudit growth (log spam) with no CI signal.
 *
 * This suite locks two invariants together:
 *
 *   S1. On a fully-idempotent second boot (all slugs present, no legacy
 *       body match, both defaults already promoted) the seeder MUST NOT
 *       emit any `INSERT INTO PromptSeedAudit ...` SQL AND MUST emit a
 *       structured `seed.audit-skip` telemetry event with
 *       `outcome:'skipped'` and `detail:'no-observable-change'`.
 *   S2. On the same boot, the seeder MUST still emit a `seed.complete`
 *       telemetry event with `outcome:'ok'` so operators can distinguish
 *       "audit skipped because nothing changed" from "seed silently died".
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let responsesQueue: unknown[] = [];

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
    return { ...actual, logDiagnosticFromCode: vi.fn() };
});
vi.mock('../../logging', () => ({ log: vi.fn() }));

const seedEvents: Array<{ event: string; outcome?: string; detail?: string }> = [];
vi.mock('../../telemetry/prompt-seed-telemetry', async () => {
    const actual = await vi.importActual<typeof import('../../telemetry/prompt-seed-telemetry')>(
        '../../telemetry/prompt-seed-telemetry',
    );
    return {
        ...actual,
        emitPromptSeedEvent: vi.fn((input: { event: string; outcome?: string; detail?: string }) => {
            seedEvents.push({ event: input.event, outcome: input.outcome, detail: input.detail });
            return { at: '', ...input };
        }),
    };
});

import { seedPlanNextPrompts } from '../seed-plan-next';
import { logDiagnosticFromCode } from '../../error-utils';

const ALL_SLUGS = [
    'plan-default', 'plan-concise', 'plan-with-evidence', 'plan-risk-annotated',
    'next-default', 'next-concise', 'next-with-time', 'next-with-risk',
].map(s => ({ Slug: s }));

beforeEach(() => {
    captured.length = 0;
    responsesQueue = [];
    seedEvents.length = 0;
    (logDiagnosticFromCode as unknown as Mock).mockClear();
});

describe('seedPlanNextPrompts: audit-skip on no-observable-change boot', () => {
    it('S1+S2: idempotent boot skips PromptSeedAudit INSERT and emits seed.audit-skip + seed.complete', async () => {
        // Sequence for a fully-idempotent boot:
        //  1. pre-select -> all 8 slugs already present (skipped=8, inserted=0)
        //  2. INSERT OR IGNORE -> ok (no rows actually inserted, driver still returns ok)
        //  3. legacy-body SELECT plan-default -> body does not match any legacy entry (user-customized skip)
        //  4. legacy-body SELECT next-default -> row missing (skip)
        //  5. hasDefault plan -> already true (kept)
        //  6. hasDefault next -> already true (kept)
        // -> upgradedTotal=0, promoted=0, inserted=0 -> audit must SKIP.
        responsesQueue = [
            { isOk: true, rows: ALL_SLUGS },
            { isOk: true },
            { isOk: true, rows: [{ Body: '# my own hand-authored plan body\n\n1. do work' }] },
            { isOk: true, rows: [{ Body: '# my own hand-authored next body\n\n1. pick task' }] },
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true, rows: [{ '1': 1 }] },
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(true);

        const auditWrites = captured.filter(c => c.sql.startsWith('INSERT INTO PromptSeedAudit'));
        expect(auditWrites, 'no audit row on idempotent boot').toHaveLength(0);

        const skip = seedEvents.find(e => e.event === 'seed.audit-skip');
        expect(skip, 'seed.audit-skip event must fire').toBeTruthy();
        expect(skip!.outcome).toBe('skipped');
        expect(skip!.detail).toBe('no-observable-change');

        const complete = seedEvents.find(e => e.event === 'seed.complete');
        expect(complete, 'seed.complete event must still fire on idempotent boot').toBeTruthy();
        expect(complete!.outcome).toBe('ok');

        const auditWrite = seedEvents.find(e => e.event === 'seed.audit-write');
        expect(auditWrite, 'seed.audit-write must NOT fire when audit is skipped').toBeUndefined();
    });
});

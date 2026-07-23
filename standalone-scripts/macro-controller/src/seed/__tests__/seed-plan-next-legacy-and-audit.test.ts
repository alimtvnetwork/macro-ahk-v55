/**
 * Plan-22 gaps: legacy-body upgrade paths and audit-write failure surface
 * for `seed-plan-next.ts`.
 *
 * The existing `seed-plan-next.test.ts` and `seed-plan-next-edges.test.ts`
 * lock the happy paths, the pre-select/promote/telemetry-persistence
 * failures, and the top-level driver throw. They do NOT cover:
 *
 *   L1. `upgradeLegacyBodyForRow` UPDATE branch: when the current DB body
 *       exactly matches `PLAN_DEFAULT_LEGACY_BODIES[0]`, the seeder must
 *       issue an `UPDATE Prompt SET Body = <new>` against `plan-default`
 *       and count the upgrade in the audit row (`UpgradedTotal >= 1`).
 *   L2. `upgradeLegacyBodyForRow` user-customized branch: when the current
 *       DB body is neither the new body nor any legacy entry, the seeder
 *       must NOT issue any UPDATE against that slug (user edits preserved).
 *   L3. `upgradeLegacyBodyForRow` UPDATE failure branch: when the driver
 *       returns `isOk:false` on the legacy UPDATE, seeder logs
 *       `SEED_LEGACY_UPGRADE_E001` and continues (overall `ok:true`).
 *   A1. `writeSeedAuditRow` UPDATE failure: when the audit INSERT returns
 *       `isOk:false`, seeder logs `SEED_AUDIT_E001` and still returns
 *       `ok:true` (audit is best-effort, never blocks the boot).
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
const captured: CapturedCall[] = [];
let responsesQueue: unknown[] = [];

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

import { seedPlanNextPrompts } from '../seed-plan-next';
import { PLAN_DEFAULT_LEGACY_BODIES, PLAN_DEFAULT_BODY, NEXT_DEFAULT_BODY } from '../plan-next-prompts';
import { logDiagnosticFromCode } from '../../error-utils';

const ALL_SLUGS = [
    'plan-default', 'plan-concise', 'plan-with-evidence', 'plan-risk-annotated',
    'next-default', 'next-concise', 'next-with-time', 'next-with-risk',
].map(s => ({ Slug: s }));

const LEGACY_PLAN_BODY = PLAN_DEFAULT_LEGACY_BODIES[0]!;
const STALE_NEXT_BODY = [
    '# Next {{n}} steps or tasks (v3.2)',
    '',
    '## RULE 0 - EXACTLY `{{n}}` NEXT STEPS (MUST)',
    '',
    'Give exactly {{n}} next steps and every remaining item after that.',
].join('\r\n');
const STALE_PLAN_BODY = [
    '# {{n}} steps Plan, Maximal Enforcement',
    '',
    'Parse the number {{n}} in this prompt\'s header. That number is the EXACT count of steps in the plan you must write. Not {{n}}-1. Not {{n}}+1. If you cannot find it, STOP and ask.',
    '',
    '## Rules - non-negotiable',
    '',
    '1. DO NOT execute anything this turn. No code edits, no migrations, no installs.',
].join('\n');

beforeEach(() => {
    captured.length = 0;
    responsesQueue = [];
    (logDiagnosticFromCode as unknown as Mock).mockClear();
    try { localStorage.removeItem('marco_last_seed_telemetry'); } catch { /* jsdom */ }
});

describe('seedPlanNextPrompts: legacy-body upgrade + audit surfaces', () => {
    it('L1: plan-default legacy body triggers UPDATE with new PLAN_DEFAULT_BODY and audit row', async () => {
        // Sequence: pre-select (all present) -> INSERT OR IGNORE ->
        //   legacy read plan-default (returns legacy body) -> UPDATE plan-default ->
        //   legacy read next-default (row-missing skip) ->
        //   hasDefault plan -> true -> hasDefault next -> true ->
        //   audit INSERT (upgraded=1, so audit fires).
        responsesQueue = [
            { isOk: true, rows: ALL_SLUGS },
            { isOk: true },
            { isOk: true, rows: [{ Body: LEGACY_PLAN_BODY }] },
            { isOk: true },                          // UPDATE legacy body
            { isOk: true, rows: [] },                // legacy read next-default (row-missing)
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true },                          // audit INSERT
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(true);
        const updates = captured.filter(c => /^UPDATE Prompt SET Body =/.test(c.sql));
        expect(updates).toHaveLength(1);
        expect(updates[0]!.sql).toContain("WHERE Slug = 'plan-default'");
        // The UPDATE carries the current PLAN_DEFAULT_BODY (SQL-escaped).
        expect(updates[0]!.sql).toContain(PLAN_DEFAULT_BODY.slice(0, 40).replace(/'/g, "''"));
        const audit = captured.find(c => c.sql.startsWith('INSERT INTO PromptSeedAudit'));
        expect(audit, 'audit row must be written when upgrade fires').toBeTruthy();
        expect(audit!.sql).toMatch(/,\s*1,\s*'boot'/); // UpgradedTotal=1, Reason='boot'
    });

    it('L2: user-customized plan-default body must NOT be overwritten', async () => {
        const CUSTOM = '# my hand-edited plan prompt body\n\n1. do stuff';
        responsesQueue = [
            { isOk: true, rows: ALL_SLUGS },
            { isOk: true },
            { isOk: true, rows: [{ Body: CUSTOM }] },  // legacy read plan-default -> user body
            { isOk: true, rows: [] },                  // legacy read next-default -> row-missing skip
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true, rows: [{ '1': 1 }] },
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(true);
        const updates = captured.filter(c => /^UPDATE Prompt SET Body =/.test(c.sql));
        expect(updates, 'user-authored body must be preserved').toHaveLength(0);
        // No observable change -> audit row must be skipped.
        expect(captured.some(c => c.sql.startsWith('INSERT INTO PromptSeedAudit'))).toBe(false);
    });

    it('L3: legacy UPDATE failure logs SEED_LEGACY_UPGRADE_E001 but seed still ok:true', async () => {
        responsesQueue = [
            { isOk: true, rows: ALL_SLUGS },
            { isOk: true },
            { isOk: true, rows: [{ Body: LEGACY_PLAN_BODY }] },
            { isOk: false, errorMessage: 'row locked' }, // UPDATE fails
            { isOk: true, rows: [] },                    // legacy read next-default (skip)
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true, rows: [{ '1': 1 }] },
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(true);
        expect(logDiagnosticFromCode).toHaveBeenCalledWith(
            'SEED_LEGACY_UPGRADE_E001',
            expect.objectContaining({
                role: 'plan', slug: 'plan-default',
                reason: expect.stringContaining('row locked'),
            }),
        );
        // Upgrade failed -> upgradedTotal stays 0 -> no audit row expected (no inserts, no promotes either).
        expect(captured.some(c => c.sql.startsWith('INSERT INTO PromptSeedAudit'))).toBe(false);
    });

    it('A1: audit INSERT failure logs SEED_AUDIT_E001, seed still returns ok:true', async () => {
        // First-boot flow (all inserts + both promotes) so audit fires,
        // then the audit INSERT itself fails.
        responsesQueue = [
            { isOk: true, rows: [] },                 // pre-select empty
            { isOk: true },                            // INSERT OR IGNORE
            { isOk: true, rows: [] },                 // legacy read plan-default (skip)
            { isOk: true, rows: [] },                 // legacy read next-default (skip)
            { isOk: true, rows: [] },                 // plan hasDefault false
            { isOk: true },                            // promote plan
            { isOk: true, rows: [] },                 // next hasDefault false
            { isOk: true },                            // promote next
            { isOk: false, errorMessage: 'audit table missing' }, // audit INSERT fails
        ];
        const r = await seedPlanNextPrompts();
        expect(r.ok).toBe(true);
        expect(captured[8]!.sql).toMatch(/^INSERT INTO PromptSeedAudit/);
        expect(logDiagnosticFromCode).toHaveBeenCalledWith(
            'SEED_AUDIT_E001',
            expect.objectContaining({ reason: expect.stringContaining('audit table missing') }),
        );
    });

    it('upgrades managed stale next-default drift used by Next preset buttons', async () => {
        responsesQueue = [
            { isOk: true, rows: ALL_SLUGS },
            { isOk: true },
            { isOk: true, rows: [{ Body: '# custom plan prompt' }] },
            { isOk: true, rows: [{ Body: STALE_NEXT_BODY }] },
            { isOk: true },
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true },
        ];
        const result = await seedPlanNextPrompts();
        expect(result.ok).toBe(true);
        const updates = captured.filter(call => /^UPDATE Prompt SET Body =/.test(call.sql));
        expect(updates).toHaveLength(1);
        expect(updates[0]!.sql).toContain("WHERE Slug = 'next-default'");
        expect(updates[0]!.sql).toContain(NEXT_DEFAULT_BODY.slice(0, 40).replace(/'/g, "''"));
    });

    it('upgrades managed stale plan-default drift used by Plan preset buttons', async () => {
        responsesQueue = [
            { isOk: true, rows: ALL_SLUGS },
            { isOk: true },
            { isOk: true, rows: [{ Body: STALE_PLAN_BODY }] },
            { isOk: true },
            { isOk: true, rows: [{ Body: '# custom next prompt' }] },
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true },
        ];
        const result = await seedPlanNextPrompts();
        expect(result.ok).toBe(true);
        const updates = captured.filter(call => /^UPDATE Prompt SET Body =/.test(call.sql));
        expect(updates).toHaveLength(1);
        expect(updates[0]!.sql).toContain("WHERE Slug = 'plan-default'");
        expect(updates[0]!.sql).toContain(PLAN_DEFAULT_BODY.slice(0, 40).replace(/'/g, "''"));
    });

    it('preserves custom plan-default bodies that do not match managed prompt shape', async () => {
        responsesQueue = [
            { isOk: true, rows: ALL_SLUGS },
            { isOk: true },
            { isOk: true, rows: [{ Body: '# Plan private\n\nUse {{n}} in my private workflow.' }] },
            { isOk: true, rows: [{ Body: '# custom next prompt' }] },
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true, rows: [{ '1': 1 }] },
        ];
        const result = await seedPlanNextPrompts();
        expect(result.ok).toBe(true);
        const updates = captured.filter(call => /^UPDATE Prompt SET Body =/.test(call.sql));
        expect(updates).toHaveLength(0);
    });

    it('preserves custom next-default bodies that do not match managed prompt shape', async () => {
        responsesQueue = [
            { isOk: true, rows: ALL_SLUGS },
            { isOk: true },
            { isOk: true, rows: [{ Body: '# custom plan prompt' }] },
            { isOk: true, rows: [{ Body: '# Next private\n\nDo my private {{n}} workflow.' }] },
            { isOk: true, rows: [{ '1': 1 }] },
            { isOk: true, rows: [{ '1': 1 }] },
        ];
        const result = await seedPlanNextPrompts();
        expect(result.ok).toBe(true);
        const updates = captured.filter(call => /^UPDATE Prompt SET Body =/.test(call.sql));
        expect(updates).toHaveLength(0);
    });
});

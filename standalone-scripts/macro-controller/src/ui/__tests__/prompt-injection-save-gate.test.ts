/**
 * Plan 22 gap #5: Rule-0 save-time gate in `saveRoleScopedPrompt`
 * (standalone-scripts/macro-controller/src/ui/prompt-injection.ts:564-597).
 *
 * Root cause pinned: The Plan/Next save path routes through
 * `saveRoleScopedPrompt`, which runs `validateRuleZero(input.text)` and
 * short-circuits with a `PROMPT_VALIDATE_E001` diagnostic + structured
 * `failure` payload BEFORE `upsertPrompt` is called. The live indicator
 * had unit coverage, but the save-time gate itself had none, so a
 * regression that (a) let a bad body reach `upsertPrompt`, (b) skipped
 * the diagnostic log, or (c) dropped `expectedN`/`actualN` from the
 * failure payload would ship silently.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const upsertPromptMock = vi.fn();
const logDiagnosticMock = vi.fn();

vi.mock('../../db/prompt-db', () => ({
    upsertPrompt: (...args: unknown[]) => upsertPromptMock(...args),
}));
vi.mock('../../error-utils', () => ({
    logDiagnosticFromCode: (...args: unknown[]) => logDiagnosticMock(...args),
    logError: vi.fn(),
}));
vi.mock('../../logging', () => ({ log: vi.fn() }));

import { saveRoleScopedPrompt } from '../prompt-injection';

beforeEach(() => {
    upsertPromptMock.mockReset();
    logDiagnosticMock.mockReset();
    upsertPromptMock.mockResolvedValue({ ok: true, value: 1 });
});

const baseInput = {
    name: 'Plan',
    category: '',
    tags: [],
    excludeFromExport: false,
    isEdit: false,
    editPrompt: null,
};

describe('saveRoleScopedPrompt Rule-0 save gate (Plan 22 gap #5)', () => {
    it('S1: role=plan with Steps:N mismatch blocks save BEFORE upsertPrompt', async () => {
        const body = 'EXACTLY 3 steps\n\n1. a\n2. b\n';
        const res = await saveRoleScopedPrompt({ ...baseInput, text: body }, 'plan');
        expect(res.isOk).toBe(false);
        if (res.isOk) return;
        expect(res.failure?.rule).toBe('rule-zero');
        expect(res.failure?.expectedN).toBe(3);
        expect(res.failure?.actualN).toBe(2);
        expect(upsertPromptMock).not.toHaveBeenCalled();
        // Diagnostic must be logged with the canonical error code so the
        // toast layer can render a specific fix, not a generic message.
        expect(logDiagnosticMock).toHaveBeenCalledTimes(1);
        expect(logDiagnosticMock.mock.calls[0][0]).toBe('PROMPT_VALIDATE_E001');
        const context = logDiagnosticMock.mock.calls[0][1];
        expect(context.role).toBe('plan');
        expect(String(context.ruleId)).toMatch(/^rule-zero:/);
    });

    it('S2: role=next enforces the same gate (v4.183.0 asymmetric-validator fix)', async () => {
        const body = 'EXACTLY 5 steps\n\n1. a\n';
        const res = await saveRoleScopedPrompt({ ...baseInput, name: 'Next', text: body }, 'next');
        expect(res.isOk).toBe(false);
        if (res.isOk) return;
        expect(res.failure?.expectedN).toBe(5);
        expect(res.failure?.actualN).toBe(1);
        expect(upsertPromptMock).not.toHaveBeenCalled();
    });

    it('S3: {{n}} template body is exempt (deferred to inject-time)', async () => {
        const body = '# {{n}} steps\n\n1. do the thing\n';
        const res = await saveRoleScopedPrompt({ ...baseInput, text: body }, 'plan');
        expect(res.isOk).toBe(true);
        expect(upsertPromptMock).toHaveBeenCalledTimes(1);
        expect(logDiagnosticMock).not.toHaveBeenCalled();
    });

    it('S4: role=generic bypasses the gate entirely (contract: plan/next only)', async () => {
        const body = 'EXACTLY 9 steps\n\n1. a\n'; // would fail rule-zero if gated
        const res = await saveRoleScopedPrompt({ ...baseInput, text: body }, 'generic');
        expect(res.isOk).toBe(true);
        expect(upsertPromptMock).toHaveBeenCalledTimes(1);
        expect(logDiagnosticMock).not.toHaveBeenCalled();
    });

    it('S5: valid Plan body with matching step count passes to upsertPrompt', async () => {
        const body = 'EXACTLY 2 steps\n\n1. first\n2. second\n';
        const res = await saveRoleScopedPrompt({ ...baseInput, text: body }, 'plan');
        expect(res.isOk).toBe(true);
        expect(upsertPromptMock).toHaveBeenCalledTimes(1);
        const call = upsertPromptMock.mock.calls[0][0];
        expect(call.role).toBe('plan');
        expect(call.body).toBe(body);
    });
});

/**
 * Regression tests for the "Repair prompts" chip-gear menu action.
 *
 * The action wires `runPromptHealthCheckWithAutoRepair` to
 * `openDefaultPromptEditor`. These cases lock the contract for:
 *
 *   CR1. Concurrent repairs — two overlapping invocations must each open the
 *        editor exactly once and never invoke force-mode reseed.
 *   CR2. Slug-not-default rows — when the repair path only produces a row
 *        with `IsDefault=0`, the auto-repair still returns unhealthy, we
 *        surface an error toast, AND we still open the editor so the user
 *        can inspect the row.
 *   CR3. Reopening after repair — a successful repair followed by a second
 *        (already-healthy) invocation must open the editor both times.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    runPromptHealthCheckWithAutoRepair: vi.fn(),
    openDefaultPromptEditor: vi.fn(async () => undefined),
    openPromptEditor: vi.fn(async () => undefined),
    reseedPromptsOnDemand: vi.fn(async () => ({ ok: true, mode: 'idempotent' as const })),
    showToast: vi.fn(),
    logDiagnosticFromCode: vi.fn(),
}));

vi.mock('../../seed/prompt-health-auto-repair', () => ({
    runPromptHealthCheckWithAutoRepair: mocks.runPromptHealthCheckWithAutoRepair,
}));
vi.mock('../../seed/reseed-command', () => ({
    reseedPromptsOnDemand: mocks.reseedPromptsOnDemand,
}));
vi.mock('../prompt-editor', () => ({
    openDefaultPromptEditor: mocks.openDefaultPromptEditor,
    openPromptEditor: mocks.openPromptEditor,
}));
vi.mock('../prompt-history-panel', () => ({ openPromptHistoryPanel: vi.fn() }));
vi.mock('../chip-gear-picker', () => ({ pickPromptFromRole: vi.fn() }));
vi.mock('../../db/prompt-db', () => ({
    setDefaultPromptForRole: vi.fn(),
    deletePromptById: vi.fn(),
}));
vi.mock('../prompt-io', () => ({ exportPromptsToJson: vi.fn() }));
vi.mock('../../toast', () => ({ showToast: mocks.showToast }));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logDiagnosticFromCode: mocks.logDiagnosticFromCode };
});

import { buildChipGearActionSection } from '../chip-gear-menu';

interface HealthReportLike {
    ok: boolean;
    issues: Array<{ code: string; message: string }>;
}
function report(ok: boolean, codes: string[] = []): HealthReportLike {
    return { ok, issues: codes.map(code => ({ code, message: code })) };
}

function findRepairRow(section: HTMLElement): HTMLElement {
    const rows = Array.from(section.querySelectorAll('button')) as HTMLElement[];
    const row = rows.find(r => r.textContent?.includes('Repair prompts'));
    if (!row) throw new Error('Repair row not found in gear section');
    return row;
}

async function flush(): Promise<void> {
    // Drain both microtasks AND macrotasks — runRepairAndOpen awaits a
    // dynamic import (`./repair-report-modal`) which resolves on a macrotask.
    // The first import can take >100ms in vitest, so wait generously.
    for (let round = 0; round < 12; round += 1) {
        for (let i = 0; i < 8; i += 1) await Promise.resolve();
        await new Promise(r => setTimeout(r, 40));
    }
}

beforeEach(() => {
    document.body.innerHTML = '';
    mocks.runPromptHealthCheckWithAutoRepair.mockReset();
    mocks.openDefaultPromptEditor.mockClear();
    mocks.reseedPromptsOnDemand.mockClear();
    mocks.showToast.mockClear();
    mocks.logDiagnosticFromCode.mockClear();
});

describe('chip-gear "Repair prompts" action', () => {
    it('CR1: concurrent repairs each open the editor and never force reseed', async () => {
        let resolves: Array<() => void> = [];
        mocks.runPromptHealthCheckWithAutoRepair.mockImplementation(() => new Promise(resolve => {
            resolves.push(() => resolve({
                initialReport: report(false, ['DEFAULT_MISSING']),
                repairAttempted: true,
                reseedOk: true,
                finalReport: report(true),
                isHealthy: true,
            }));
        }));

        const section = buildChipGearActionSection({ role: 'plan', roleLabel: 'Plan', accent: '#f0f' });
        document.body.appendChild(section);
        const row = findRepairRow(section);

        row.click();
        row.click();
        await flush();

        expect(mocks.runPromptHealthCheckWithAutoRepair).toHaveBeenCalledTimes(2);
        // Resolve both in-flight repairs.
        resolves.forEach(func => func());
        resolves = [];
        await flush();

        expect(mocks.openDefaultPromptEditor).toHaveBeenCalledTimes(2);
        expect(mocks.openDefaultPromptEditor).toHaveBeenNthCalledWith(1, 'plan');
        expect(mocks.openDefaultPromptEditor).toHaveBeenNthCalledWith(2, 'plan');
        // Repair path must NEVER invoke force-mode reseed directly.
        const forceCalls = mocks.reseedPromptsOnDemand.mock.calls.filter(([opts]) => (opts as { force?: boolean } | undefined)?.force === true);
        expect(forceCalls.length).toBe(0);
    });

    it('CR2: slug-not-default residual row -> error toast AND editor still opens', async () => {
        mocks.runPromptHealthCheckWithAutoRepair.mockResolvedValue({
            initialReport: report(false, ['DEFAULT_FLAG_MISSING']),
            repairAttempted: true,
            reseedOk: true,
            finalReport: report(false, ['DEFAULT_FLAG_MISSING']),
            isHealthy: false,
        });

        const section = buildChipGearActionSection({ role: 'next', roleLabel: 'Next', accent: '#0ff' });
        document.body.appendChild(section);
        findRepairRow(section).click();
        await flush();

        expect(mocks.openDefaultPromptEditor).toHaveBeenCalledExactlyOnceWith('next');
        const errorToasts = mocks.showToast.mock.calls.filter(([, level]) => level === 'error');
        expect(errorToasts.length).toBe(1);
        expect(String(errorToasts[0]?.[0])).toContain('Repair incomplete');
        expect(String(errorToasts[0]?.[0])).toContain('[code=REPAIR_RUN_E001]');
        expect(mocks.logDiagnosticFromCode).toHaveBeenCalledWith(
            'REPAIR_RUN_E001',
            expect.objectContaining({ role: 'next', stillBroken: expect.any(Number) }),
            undefined,
        );
    });

    it('CR3: reopen after repair — second (healthy) invocation still opens the editor', async () => {
        mocks.runPromptHealthCheckWithAutoRepair
            .mockResolvedValueOnce({
                initialReport: report(false, ['DEFAULT_MISSING']),
                repairAttempted: true,
                reseedOk: true,
                finalReport: report(true),
                isHealthy: true,
            })
            .mockResolvedValueOnce({
                initialReport: report(true),
                repairAttempted: false,
                reseedOk: true,
                finalReport: report(true),
                isHealthy: true,
            });

        const section = buildChipGearActionSection({ role: 'plan', roleLabel: 'Plan', accent: '#f0f' });
        document.body.appendChild(section);
        const row = findRepairRow(section);

        row.click();
        await flush();
        row.click();
        await flush();

        expect(mocks.openDefaultPromptEditor).toHaveBeenCalledTimes(2);
        expect(mocks.showToast.mock.calls.some(([message]) => String(message).toLowerCase().includes('repaired'))).toBe(true);
        expect(mocks.showToast.mock.calls.some(([message]) => String(message).toLowerCase().includes('already healthy'))).toBe(true);
        // No error toasts across either invocation.
        expect(mocks.showToast.mock.calls.some(([, level]) => level === 'error')).toBe(false);
    });
});

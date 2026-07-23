/**
 * Negative UI test: Plan chip when Prompt DB has no `plan-default` row.
 *
 * Root cause of the design under test: `resolvePlanBody()` (plan-task-ui.ts:98)
 * treats "no default row" as a soft miss — it emits a `console.warn` with the
 * exact string `[PlanTask] No plan-default row; falling back to hardcoded template`
 * and returns `buildPlanTaskPrompt(n)`, so the chip never dies silently.
 *
 * These tests lock BOTH negative branches:
 *   1. DB reachable, `getDefaultPromptForRole('plan')` -> `{ok:true, value:undefined}`
 *      -> console.warn fires, hardcoded fallback pasted, NO error toast.
 *   2. DB throws -> `logError('PlanTask', 'resolvePlanBody DB read failed;
 *      falling back to hardcoded template', err)` fires, hardcoded fallback
 *      pasted, NO error toast.
 *
 * Notes:
 * - We do NOT assert "does not submit" (a common fabrication): the actual
 *   design is fallback-and-continue, not fail-abort. Asserting the opposite
 *   would be a symptom-patch masquerading as a test.
 * - The submenu's `appendPresetSteps` fires a second async DB read via
 *   `resolveConfiguredChipValues`; we mock it to a no-op to keep the test
 *   focused on the click path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

const getDefaultMock = vi.hoisted(() => vi.fn());
const pasteMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());
const resolveConfiguredChipValuesMock = vi.hoisted(() => vi.fn());

vi.mock('../../db/prompt-db', () => ({
    getDefaultPromptForRole: getDefaultMock,
}));
vi.mock('../prompt-utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../prompt-utils')>();
    return {
        ...actual,
        pasteIntoEditor: pasteMock,
        showPasteToast: toastMock,
    };
});
vi.mock('../prompt-loader', () => buildPromptLoaderMock({
    getPromptsConfig: () => ({}),
}));
vi.mock('../../xpath-utils', () => ({
    getByXPath: () => null,
}));
vi.mock('../../error-utils', () => ({
    logError: logErrorMock,
}));
vi.mock('../configured-chip-values', () => ({
    resolveConfiguredChipValues: resolveConfiguredChipValuesMock,
}));

import { buildPlanTaskPrompt, renderPlanTaskSubmenu } from '../plan-task-ui';
import type { PromptContext } from '../prompt-loader';

function makeCtx(): PromptContext {
    // Only `promptsDropdown` is read by renderPlanTaskSubmenu.
    const dropdown = document.createElement('div');
    document.body.appendChild(dropdown);
    return { promptsDropdown: dropdown } as unknown as PromptContext;
}

function firstPresetItem(container: HTMLElement): HTMLElement {
    const sub = container.querySelector<HTMLElement>('[data-plan-task-sub]');
    if (!sub) throw new Error('sub not rendered');
    const first = sub.querySelector<HTMLElement>('[data-plan-preset]');
    if (!first) throw new Error('no preset row');
    return first;
}

async function waitForPaste(): Promise<void> {
    // Chain: click -> injectPlanPrompt IIFE -> await resolvePlanBody (dynamic
    // import + await DB) -> await pasteIntoEditor. Poll until pasteMock fires,
    // or 500ms budget is spent (surfaces hangs instead of silent timeouts).
    const deadline = Date.now() + 500;
    while (pasteMock.mock.calls.length === 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5));
    // Extra tick so the outcome branch (toast on 'failed') can run after paste resolves.
    await new Promise((r) => setTimeout(r, 5));
}
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    getDefaultMock.mockReset();
    pasteMock.mockReset();
    pasteMock.mockResolvedValue('injected');
    toastMock.mockReset();
    logErrorMock.mockReset();
    resolveConfiguredChipValuesMock.mockReset();
    // Keep chip-values refresh a no-op so the click path is isolated.
    resolveConfiguredChipValuesMock.mockResolvedValue([]);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* silent */ });
    vi.spyOn(console, 'log').mockImplementation(() => { /* silent */ });
    document.body.innerHTML = '';
});

afterEach(() => {
    warnSpy.mockRestore();
    vi.restoreAllMocks();
});

describe('plan-task-ui — DB empty for plan role (negative path)', () => {
    it('warns and falls back to hardcoded prompt when no plan-default row exists', async () => {
        getDefaultMock.mockResolvedValueOnce({ ok: true, value: undefined });

        const container = document.createElement('div');
        renderPlanTaskSubmenu(container, makeCtx());
        firstPresetItem(container).click();
        await waitForPaste();

        // 1) Empty-state signal: exact warn line fires exactly once.
        const warnCalls = warnSpy.mock.calls.map((c) => String(c[0] ?? ''));
        const empties = warnCalls.filter((m) =>
            m === '[PlanTask] No plan-default row; falling back to hardcoded template',
        );
        expect(empties).toHaveLength(1);

        // 2) Fallback body is exactly `buildPlanTaskPrompt(2)` (first preset = 2).
        expect(pasteMock).toHaveBeenCalledTimes(1);
        const [pastedText, , , captureSource] = pasteMock.mock.calls[0];
        expect(pastedText).toBe(buildPlanTaskPrompt(2));
        expect(captureSource).toBe('plan-chip');

        // 3) No error toast on soft-miss — fallback succeeded.
        expect(toastMock).not.toHaveBeenCalled();

        // 4) DB failure is NOT logged via logError on the empty-row branch
        //    (logError is reserved for thrown errors — verify no cross-contamination).
        expect(logErrorMock).not.toHaveBeenCalledWith(
            'PlanTask',
            expect.stringContaining('resolvePlanBody'),
            expect.anything(),
        );
    });

    it('logs via logError and falls back to hardcoded prompt when DB read throws', async () => {
        const err = new Error('db unavailable');
        getDefaultMock.mockRejectedValueOnce(err);

        const container = document.createElement('div');
        renderPlanTaskSubmenu(container, makeCtx());
        firstPresetItem(container).click();
        await waitForPaste();

        // 1) logError fires with exact scope + message + original error.
        expect(logErrorMock).toHaveBeenCalledWith(
            'PlanTask',
            'resolvePlanBody DB read failed; falling back to hardcoded template',
            err,
        );

        // 2) Fallback body still injected — chip does not die silently.
        expect(pasteMock).toHaveBeenCalledTimes(1);
        const [pastedText] = pasteMock.mock.calls[0];
        expect(pastedText).toBe(buildPlanTaskPrompt(2));

        // 3) Soft-miss warn line MUST NOT fire on the throw branch.
        const warned = warnSpy.mock.calls.some((c) =>
            String(c[0] ?? '').includes('No plan-default row'),
        );
        expect(warned).toBe(false);
    });

    it('surfaces a hard-failure toast only when pasteIntoEditor reports failed', async () => {
        getDefaultMock.mockResolvedValueOnce({ ok: true, value: undefined });
        pasteMock.mockResolvedValueOnce('failed');

        const container = document.createElement('div');
        renderPlanTaskSubmenu(container, makeCtx());
        firstPresetItem(container).click();
        await waitForPaste();
        // Poll for the toast (fires one microtask after paste resolves).
        const deadline = Date.now() + 200;
        while (toastMock.mock.calls.length === 0 && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 5));
        }

        expect(toastMock).toHaveBeenCalledWith('❌ Plan prompt: injection failed', true);
    });
});

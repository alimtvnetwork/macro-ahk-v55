/**
 * Positive UI tests for plan-task-ui.
 *
 * Locks the happy paths that the negative suite (plan-task-ui-db-empty.test.ts)
 * intentionally does not cover:
 *   P1. Preset click with a real DB row -> Body with {{n}} substituted, pasted verbatim.
 *   P2. Preset click closes the parent dropdown (display='none').
 *   P3. Custom row Enter/click path parses the input and injects for that N.
 *   P4. Custom row rejects out-of-range values with a warning toast and does NOT paste.
 *   P5. Custom ReplaceKey from the DB row is honored (not the hardcoded default).
 *   P6. Preset chip values refresh from DB when resolveConfiguredChipValues diverges.
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

import { renderPlanTaskSubmenu } from '../plan-task-ui';
import type { PromptContext } from '../prompt-loader';

function makeCtx(): { pctx: PromptContext; dropdown: HTMLElement } {
    const dropdown = document.createElement('div');
    document.body.appendChild(dropdown);
    return { pctx: { promptsDropdown: dropdown } as unknown as PromptContext, dropdown };
}

function sub(container: HTMLElement): HTMLElement {
    const node = container.querySelector<HTMLElement>('[data-plan-task-sub]');
    if (!node) throw new Error('sub not rendered');
    return node;
}

function presetAt(container: HTMLElement, index: number): HTMLElement {
    const presets = sub(container).querySelectorAll<HTMLElement>('[data-plan-preset]');
    const child = presets.item(index);
    if (!child) throw new Error('no preset at index ' + index);
    return child;
}

async function waitFor(pred: () => boolean, ms = 500): Promise<void> {
    const deadline = Date.now() + ms;
    while (!pred() && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5));
    }
    // extra tick for post-paste microtasks
    await new Promise((r) => setTimeout(r, 5));
}

beforeEach(() => {
    getDefaultMock.mockReset();
    pasteMock.mockReset();
    pasteMock.mockResolvedValue('injected');
    toastMock.mockReset();
    logErrorMock.mockReset();
    resolveConfiguredChipValuesMock.mockReset();
    resolveConfiguredChipValuesMock.mockResolvedValue([]);
    vi.spyOn(console, 'log').mockImplementation(() => { /* silent */ });
    vi.spyOn(console, 'warn').mockImplementation(() => { /* silent */ });
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('plan-task-ui — positive DB-backed paths', () => {
    it('P1: preset click pastes the DB Body with {{n}} substituted', async () => {
        getDefaultMock.mockResolvedValueOnce({
            ok: true,
            value: { Body: 'Plan {{n}} steps: solve X in {{n}} passes.', ReplaceKey: 'n' },
        });

        const container = document.createElement('div');
        const { pctx } = makeCtx();
        renderPlanTaskSubmenu(container, pctx);
        // First preset in hardcoded list is 2.
        presetAt(container, 0).click();
        await waitFor(() => pasteMock.mock.calls.length > 0);

        expect(pasteMock).toHaveBeenCalledTimes(1);
        const [pastedText, , , source] = pasteMock.mock.calls[0];
        expect(pastedText).toBe('Plan 2 steps: solve X in 2 passes.');
        expect(source).toBe('plan-chip');
        expect(toastMock).not.toHaveBeenCalled();
        expect(logErrorMock).not.toHaveBeenCalled();
    });

    it('P2: preset click closes the parent dropdown', async () => {
        getDefaultMock.mockResolvedValueOnce({
            ok: true,
            value: { Body: 'x {{n}}', ReplaceKey: 'n' },
        });

        const container = document.createElement('div');
        const { pctx, dropdown } = makeCtx();
        renderPlanTaskSubmenu(container, pctx);
        dropdown.style.display = 'block';
        presetAt(container, 0).click();

        expect(dropdown.style.display).toBe('none');
    });

    it('P3: custom row Enter injects for the parsed N', async () => {
        getDefaultMock.mockResolvedValue({
            ok: true,
            value: { Body: '## N={{n}}', ReplaceKey: 'n' },
        });

        const container = document.createElement('div');
        const { pctx, dropdown } = makeCtx();
        renderPlanTaskSubmenu(container, pctx);

        const inp = sub(container).querySelector<HTMLInputElement>('input[type=number]');
        const go = sub(container).querySelector<HTMLElement>('span[title="Plan"]');
        expect(inp && go).toBeTruthy();
        inp!.value = '7';
        go!.click();
        await waitFor(() => pasteMock.mock.calls.length > 0);

        expect(pasteMock).toHaveBeenCalledTimes(1);
        expect(pasteMock.mock.calls[0][0]).toBe('## N=7');
        expect(dropdown.style.display).toBe('none');
        expect(toastMock).not.toHaveBeenCalled();
    });

    it('P4: custom row rejects out-of-range values with warn toast and no paste', async () => {
        const container = document.createElement('div');
        const { pctx } = makeCtx();
        renderPlanTaskSubmenu(container, pctx);
        const inp = sub(container).querySelector<HTMLInputElement>('input[type=number]');
        const go = sub(container).querySelector<HTMLElement>('span[title="Plan"]');

        inp!.value = '1000';
        go!.click();
        // Give the (would-be) IIFE a beat to prove it never runs.
        await new Promise((r) => setTimeout(r, 20));

        expect(toastMock).toHaveBeenCalledWith('⚠️ Enter 1–999', true);
        expect(pasteMock).not.toHaveBeenCalled();
        expect(getDefaultMock).not.toHaveBeenCalled();
    });

    it('P5: honors a user-renamed ReplaceKey from the DB row', async () => {
        getDefaultMock.mockResolvedValueOnce({
            ok: true,
            value: { Body: 'Iterate {{steps}} times ({{steps}}!)', ReplaceKey: 'steps' },
        });

        const container = document.createElement('div');
        const { pctx } = makeCtx();
        renderPlanTaskSubmenu(container, pctx);
        presetAt(container, 0).click();
        await waitFor(() => pasteMock.mock.calls.length > 0);

        expect(pasteMock.mock.calls[0][0]).toBe('Iterate 2 times (2!)');
    });

    it('P6: refreshes preset rows from DB when resolveConfiguredChipValues diverges', async () => {
        getDefaultMock.mockResolvedValue({
            ok: true,
            value: { Body: 'N={{n}}', ReplaceKey: 'n' },
        });
        resolveConfiguredChipValuesMock.mockResolvedValueOnce([4, 9]);

        const container = document.createElement('div');
        const { pctx } = makeCtx();
        renderPlanTaskSubmenu(container, pctx);
        // Let the async refresh run.
        await waitFor(() => {
            const first = sub(container).firstElementChild as HTMLElement | null;
            return !!first && first.textContent === 'Plan 4';
        });

        const labels = Array.from(sub(container).children)
            .map((c) => (c as HTMLElement).textContent || '')
            .filter((t) => t.startsWith('Plan '));
        expect(labels).toEqual(['Plan 4', 'Plan 9']);

        // And the click still resolves to the new N.
        (sub(container).children.item(1) as HTMLElement).click();
        await waitFor(() => pasteMock.mock.calls.length > 0);
        expect(pasteMock.mock.calls[0][0]).toBe('N=9');
    });
});

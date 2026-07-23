/**
 * G7: prompt-library-modal a11y — initial focus + Tab focus trap.
 *
 * DoD:
 *  - On open, keyboard focus lands inside the modal (on the Close button).
 *  - Tab at the last focusable node wraps to the first.
 *  - Shift+Tab at the first focusable node wraps to the last.
 *  - Focus that escaped the modal is pulled back on next Tab.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));

const rows: Record<string, unknown[]> = {
    plan: [
        { Id: 1, Slug: 'plan-default', Name: 'Plan (default)', Body: 'X {{n}} Y', Role: 'plan', IsDefault: 1, CreatedAt: 0, UpdatedAt: 0 },
    ],
    next: [],
    generic: [],
};

const mocks = vi.hoisted(() => ({
    listPromptsByRole: vi.fn(),
    setDefaultPromptForRole: vi.fn(async () => ({ ok: true })),
    deletePromptById: vi.fn(async () => ({ ok: true })),
    upsertPrompt: vi.fn(async () => ({ ok: true, value: 99 })),
}));
vi.mock('../../db/prompt-db', () => mocks);

import { openPromptLibraryModal } from '../prompt-library-modal';

const flush = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
};

function dispatchTab(shift = false): boolean {
    const evt = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });
    return document.dispatchEvent(evt);
}

function focusableInModal(): HTMLElement[] {
    const root = document.getElementById('macro-prompt-library-modal')!;
    const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll<HTMLElement>(sel))
        .filter((n) => !n.hasAttribute('disabled') && n.tabIndex !== -1);
}

describe('prompt-library-modal — a11y focus trap', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.listPromptsByRole.mockImplementation(async (role: string) => ({ ok: true, value: rows[role] ?? [] }));
    });
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('initial focus lands on Close button', async () => {
        await openPromptLibraryModal();
        await flush();
        const close = document.querySelector<HTMLButtonElement>('button[data-testid="library-close"]')!;
        expect(close).toBeTruthy();
        expect(document.activeElement).toBe(close);
    });

    it('Tab at last focusable wraps to first (forward trap)', async () => {
        await openPromptLibraryModal();
        await flush();
        const nodes = focusableInModal();
        expect(nodes.length).toBeGreaterThan(1);
        nodes[nodes.length - 1]!.focus();
        dispatchTab(false);
        expect(document.activeElement).toBe(nodes[0]);
    });

    it('Shift+Tab at first focusable wraps to last (backward trap)', async () => {
        await openPromptLibraryModal();
        await flush();
        const nodes = focusableInModal();
        expect(nodes.length).toBeGreaterThan(1);
        nodes[0]!.focus();
        dispatchTab(true);
        expect(document.activeElement).toBe(nodes[nodes.length - 1]);
    });

    it('focus that escaped the modal is pulled back on next Tab', async () => {
        const outside = document.createElement('button');
        outside.textContent = 'outside';
        document.body.appendChild(outside);
        await openPromptLibraryModal();
        await flush();
        outside.focus();
        expect(document.activeElement).toBe(outside);
        dispatchTab(false);
        const nodes = focusableInModal();
        expect(document.activeElement).toBe(nodes[0]);
    });
});

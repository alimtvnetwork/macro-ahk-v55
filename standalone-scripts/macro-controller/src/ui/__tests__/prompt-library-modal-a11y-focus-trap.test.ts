/**
 * prompt-library-modal a11y — extended focus-trap + initial-focus coverage.
 *
 * Complements `prompt-library-modal-a11y.test.ts` by locking additional
 * observable behavior:
 *
 *   1) Opening the modal moves focus INTO the modal even when a page element
 *      was focused before open (initial focus is not left on the trigger).
 *   2) Initial focus explicitly lands on the Close button (data-testid
 *      "library-close") regardless of DOM order.
 *   3) Repeated forward Tab from the last focusable node cycles back to the
 *      first focusable node and can cycle multiple times without escaping.
 *   4) Escape key closes the modal (dialog-standard dismissal), releasing the
 *      keyboard trap so focus is no longer confined.
 *   5) Non-Tab keys (e.g. ArrowDown) do NOT reset or move focus - the trap is
 *      Tab-only and does not interfere with normal keyboard input.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));

const rows: Record<string, unknown[]> = {
    plan: [
        { Id: 1, Slug: 'plan-default', Name: 'Plan (default)', Body: 'X {{n}} Y', Role: 'plan', IsDefault: 1, CreatedAt: 0, UpdatedAt: 0 },
        { Id: 2, Slug: 'plan-concise', Name: 'Plan (concise)', Body: 'A {{n}} B', Role: 'plan', IsDefault: 0, CreatedAt: 0, UpdatedAt: 0 },
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

function dispatchKey(key: string, opts: { shift?: boolean } = {}): void {
    document.dispatchEvent(new KeyboardEvent('keydown', {
        key, shiftKey: !!opts.shift, bubbles: true, cancelable: true,
    }));
}

function focusableInModal(): HTMLElement[] {
    const root = document.getElementById('macro-prompt-library-modal')!;
    const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll<HTMLElement>(sel))
        .filter((n) => !n.hasAttribute('disabled') && n.tabIndex !== -1);
}

function getCloseBtn(): HTMLButtonElement {
    return document.querySelector<HTMLButtonElement>('button[data-testid="library-close"]')!;
}

beforeEach(() => {
    document.body.innerHTML = '';
    mocks.listPromptsByRole.mockImplementation(async (role: string) => ({ ok: true, value: rows[role] ?? [] }));
});
afterEach(() => {
    // Ensure any lingering modal is unmounted so its keydown listener detaches.
    dispatchKey('Escape');
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('prompt-library-modal — a11y initial focus', () => {
    it('moves focus from a pre-existing page element INTO the modal on open', async () => {
        const trigger = document.createElement('button');
        trigger.textContent = 'Open library';
        document.body.appendChild(trigger);
        trigger.focus();
        expect(document.activeElement).toBe(trigger);

        await openPromptLibraryModal();
        await flush();

        const modal = document.getElementById('macro-prompt-library-modal')!;
        expect(modal.contains(document.activeElement)).toBe(true);
        expect(document.activeElement).toBe(getCloseBtn());
    });

    it('Close button receives initial focus regardless of its DOM order', async () => {
        await openPromptLibraryModal();
        await flush();
        expect(document.activeElement).toBe(getCloseBtn());
    });
});

describe('prompt-library-modal — a11y focus trap (extended)', () => {
    it('forward Tab from last node cycles back to first, and cycles again without escaping', async () => {
        await openPromptLibraryModal();
        await flush();
        const nodes = focusableInModal();
        expect(nodes.length).toBeGreaterThan(1);
        const first = nodes[0]!;
        const last = nodes[nodes.length - 1]!;

        last.focus();
        dispatchKey('Tab');
        expect(document.activeElement).toBe(first);

        // Second cycle: return to last, Tab again, must still wrap to first.
        last.focus();
        dispatchKey('Tab');
        expect(document.activeElement).toBe(first);
    });

    it('non-Tab keys (ArrowDown) do not move focus away from the current node', async () => {
        await openPromptLibraryModal();
        await flush();
        const nodes = focusableInModal();
        const mid = nodes[Math.min(2, nodes.length - 1)]!;
        mid.focus();
        dispatchKey('ArrowDown');
        expect(document.activeElement).toBe(mid);
    });

    it('Escape closes the modal and releases the focus trap', async () => {
        await openPromptLibraryModal();
        await flush();
        expect(document.getElementById('macro-prompt-library-modal')).not.toBeNull();

        dispatchKey('Escape');
        await flush();
        expect(document.getElementById('macro-prompt-library-modal')).toBeNull();

        // After close, focusing an outside element and pressing Tab must not
        // yank focus back into a (now non-existent) modal.
        const outside = document.createElement('button');
        outside.textContent = 'after-close';
        document.body.appendChild(outside);
        outside.focus();
        dispatchKey('Tab');
        expect(document.activeElement).toBe(outside);
    });
});

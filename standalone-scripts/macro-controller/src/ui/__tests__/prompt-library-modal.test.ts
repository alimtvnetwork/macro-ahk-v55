/**
 * Tests for prompt-library-modal (plan-14 step 10).
 * Covers the pure `uniqueDupSlug` helper AND a smoke test that
 * `openPromptLibraryModal` mounts + renders per-role sections + wires
 * the Set-default action against the mocked db layer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));

const rows: Record<string, unknown[]> = {
    plan: [
        { Id: 1, Slug: 'plan-default', Name: 'Plan (default)', Body: 'X {{n}} Y', Role: 'plan', IsDefault: 1, CreatedAt: 0, UpdatedAt: 0 },
        { Id: 2, Slug: 'plan-concise', Name: 'Plan (concise)', Body: 'A {{n}} B', Role: 'plan', IsDefault: 0, CreatedAt: 0, UpdatedAt: 0 },
    ],
    next: [
        { Id: 3, Slug: 'next-default', Name: 'Next (default)', Body: 'N {{n}}', Role: 'next', IsDefault: 1, CreatedAt: 0, UpdatedAt: 0 },
    ],
    generic: [],
};

const mocks = vi.hoisted(() => ({
    listPromptsByRole: vi.fn(),
    setDefaultPromptForRole: vi.fn(async () => ({ ok: true })),
    deletePromptById: vi.fn(async () => ({ ok: true })),
    upsertPrompt: vi.fn(async () => ({ ok: true, value: 99 })),
}));
vi.mock('../../db/prompt-db', () => mocks);

import { openPromptLibraryModal, uniqueDupSlug } from '../prompt-library-modal';

describe('uniqueDupSlug (pure helper)', () => {
    it('returns <slug>-copy when free', () => {
        expect(uniqueDupSlug('plan-default')).toBe('plan-default-copy');
    });
    it('avoids collisions with -copy-N', () => {
        expect(uniqueDupSlug('plan-default', ['plan-default-copy'])).toBe('plan-default-copy-2');
        expect(uniqueDupSlug('plan-default', ['plan-default-copy', 'plan-default-copy-2'])).toBe('plan-default-copy-3');
    });
});

describe('openPromptLibraryModal', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.listPromptsByRole.mockImplementation(async (role: string) => ({ ok: true, value: rows[role] ?? [] }));
        mocks.setDefaultPromptForRole.mockClear();
        mocks.deletePromptById.mockClear();
        mocks.upsertPrompt.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('mounts the modal and renders one section per role', async () => {
        await openPromptLibraryModal();
        const modal = document.getElementById('macro-prompt-library-modal');
        expect(modal).not.toBeNull();
        // Two Plan rows + one Next row = 3 row elements with data-prompt-id.
        const rowEls = modal!.querySelectorAll('[data-prompt-id]');
        expect(rowEls.length).toBe(3);
        // The Plan default row is starred.
        const planDefault = modal!.querySelector('[data-prompt-slug="plan-default"]');
        expect(planDefault!.textContent).toContain('★');
    });

    it('reopening is idempotent (replaces prior modal instance)', async () => {
        await openPromptLibraryModal();
        await openPromptLibraryModal();
        expect(document.querySelectorAll('#macro-prompt-library-modal').length).toBe(1);
    });

    it('clicking Set default calls setDefaultPromptForRole with the row id + role', async () => {
        await openPromptLibraryModal();
        const nonDefault = document.querySelector('[data-prompt-slug="plan-concise"]')!;
        const btn = Array.from(nonDefault.querySelectorAll('button')).find(b => b.textContent === 'Set default')!;
        btn.click();
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));
        expect(mocks.setDefaultPromptForRole).toHaveBeenCalledWith(2, 'plan');
    });

    it('clicking Duplicate calls upsertPrompt with -copy slug and IsDefault omitted', async () => {
        await openPromptLibraryModal();
        const row = document.querySelector('[data-prompt-slug="plan-default"]')!;
        const btn = Array.from(row.querySelectorAll('button')).find(b => b.textContent === 'Duplicate')!;
        btn.click();
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));
        expect(mocks.upsertPrompt).toHaveBeenCalledTimes(1);
        const arg = (mocks.upsertPrompt.mock.calls as unknown[][])[0][0] as { slug: string; role: string; name: string };
        expect(arg.slug).toBe('plan-default-copy');
        expect(arg.role).toBe('plan');
        expect(arg.name).toContain('(copy)');
    });

    it('clicking Edit reveals an editor; Save calls upsertPrompt with previousBody and the row id', async () => {
        await openPromptLibraryModal();
        const row = document.querySelector('[data-prompt-slug="plan-concise"]')!;
        const editBtn = Array.from(row.querySelectorAll('button')).find(b => b.textContent === 'Edit')!;
        editBtn.click();
        const ta = document.querySelector('textarea') as HTMLTextAreaElement;
        expect(ta).not.toBeNull();
        ta.value = 'A {{n}} B edited';
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Save')!;
        saveBtn.click();
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));
        expect(mocks.upsertPrompt).toHaveBeenCalledTimes(1);
        const arg = (mocks.upsertPrompt.mock.calls as unknown[][])[0][0] as { id: number; slug: string; body: string; previousBody: string };
        expect(arg.id).toBe(2);
        expect(arg.slug).toBe('plan-concise');
        expect(arg.body).toBe('A {{n}} B edited');
        expect(arg.previousBody).toBe('A {{n}} B');
    });

    it('surfaces a load error inline when listPromptsByRole fails (no swallowed error)', async () => {
        mocks.listPromptsByRole.mockImplementationOnce(async () => ({ ok: false, error: 'boom' }));
        await openPromptLibraryModal();
        const modal = document.getElementById('macro-prompt-library-modal')!;
        expect(modal.textContent).toContain('Load error: boom');
    });

    it('role filter chip narrows the render to a single role', async () => {
        await openPromptLibraryModal();
        expect(document.querySelectorAll('[data-prompt-id]').length).toBe(3);
        const nextChip = document.querySelector('button[data-role="next"]') as HTMLButtonElement;
        expect(nextChip).not.toBeNull();
        nextChip.click();
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));
        const remaining = Array.from(document.querySelectorAll('[data-prompt-slug]')).map(e => (e as HTMLElement).dataset.promptSlug);
        expect(remaining).toEqual(['next-default']);
    });

    it('sort=name orders rows alphabetically within a role', async () => {
        await openPromptLibraryModal();
        const select = document.querySelector('[data-testid="library-sort"]') as HTMLSelectElement;
        select.value = 'name';
        select.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));
        const planSlugs = Array.from(document.querySelectorAll('[data-prompt-slug^="plan-"]')).map(e => (e as HTMLElement).dataset.promptSlug);
        // 'Plan (concise)' < 'Plan (default)' alphabetically.
        expect(planSlugs).toEqual(['plan-concise', 'plan-default']);
    });

    it('clicking a row name toggles a body preview element', async () => {
        await openPromptLibraryModal();
        const row = document.querySelector('[data-prompt-slug="plan-default"]') as HTMLElement;
        const nameCol = row.firstElementChild as HTMLElement;
        expect(document.querySelector('[data-testid="row-preview"]')).toBeNull();
        nameCol.click();
        const preview = document.querySelector('[data-testid="row-preview"]') as HTMLElement;
        expect(preview).not.toBeNull();
        expect(preview.textContent).toContain('X {{n}} Y');
        // Toggle off.
        const row2 = document.querySelector('[data-prompt-slug="plan-default"]') as HTMLElement;
        (row2.firstElementChild as HTMLElement).click();
        expect(document.querySelector('[data-testid="row-preview"]')).toBeNull();
    });

    it('Escape closes the modal when no editor is open', async () => {
        await openPromptLibraryModal();
        expect(document.getElementById('macro-prompt-library-modal')).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(document.getElementById('macro-prompt-library-modal')).toBeNull();
    });

    it('Escape cancels editor without closing the modal', async () => {
        await openPromptLibraryModal();
        const row = document.querySelector('[data-prompt-slug="plan-concise"]')!;
        const editBtn = Array.from(row.querySelectorAll('button')).find(b => b.textContent === 'Edit')!;
        editBtn.click();
        expect(document.querySelector('textarea')).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));
        expect(document.getElementById('macro-prompt-library-modal')).not.toBeNull();
        expect(document.querySelector('textarea')).toBeNull();
    });

    it('Ctrl+S saves the open editor via upsertPrompt', async () => {
        await openPromptLibraryModal();
        const row = document.querySelector('[data-prompt-slug="plan-concise"]')!;
        const editBtn = Array.from(row.querySelectorAll('button')).find(b => b.textContent === 'Edit')!;
        editBtn.click();
        const ta = document.querySelector('textarea') as HTMLTextAreaElement;
        ta.value = 'A {{n}} B via-ctrl-s';
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));
        expect(mocks.upsertPrompt).toHaveBeenCalledTimes(1);
        const arg = (mocks.upsertPrompt.mock.calls as unknown[][])[0][0] as { id: number; body: string };
        expect(arg.id).toBe(2);
        expect(arg.body).toBe('A {{n}} B via-ctrl-s');
    });
});

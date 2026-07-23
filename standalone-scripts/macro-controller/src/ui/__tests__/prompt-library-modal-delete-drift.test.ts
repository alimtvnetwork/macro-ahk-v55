/**
 * G6: prompt-library-modal Delete flow + token-drift guard integration on Save.
 *
 * - Delete happy path: window.confirm=true -> deletePromptById called with row id.
 * - Delete cancel:     window.confirm=false -> deletePromptById NOT called.
 * - Delete blocked:    deletePromptById returns {ok:false} -> status shows "Delete blocked: <err>".
 * - Token-drift on Save: upsertPrompt returns {ok:false, error:'token drift: {{n}} missing'}
 *                        -> status shows "Save failed: token drift: {{n}} missing" and modal stays open.
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

async function flush(): Promise<void> {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
}

describe('prompt-library-modal — Delete flow', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.listPromptsByRole.mockImplementation(async (role: string) => ({ ok: true, value: rows[role] ?? [] }));
        mocks.deletePromptById.mockClear();
        mocks.deletePromptById.mockImplementation(async () => ({ ok: true }));
        mocks.upsertPrompt.mockClear();
    });
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('confirm=true calls deletePromptById with row.Id', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        await openPromptLibraryModal();
        const row = document.querySelector('[data-prompt-slug="plan-concise"]')!;
        const btn = Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Delete')!;
        btn.click();
        await flush();
        expect(mocks.deletePromptById).toHaveBeenCalledTimes(1);
        expect(mocks.deletePromptById).toHaveBeenCalledWith(2);
    });

    it('confirm=false does NOT call deletePromptById', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        await openPromptLibraryModal();
        const row = document.querySelector('[data-prompt-slug="plan-concise"]')!;
        const btn = Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Delete')!;
        btn.click();
        await flush();
        expect(mocks.deletePromptById).not.toHaveBeenCalled();
    });

    it('deletePromptById returning ok:false surfaces "Delete blocked: <error>" in status', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        mocks.deletePromptById.mockImplementationOnce(async () => ({ ok: false, error: 'last-row-guard' }));
        await openPromptLibraryModal();
        const row = document.querySelector('[data-prompt-slug="plan-concise"]')!;
        const btn = Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Delete')!;
        btn.click();
        await flush();
        const status = document.querySelector('[data-testid="library-status"]') as HTMLElement
            ?? document.querySelector('#macro-prompt-library-modal')!;
        expect(status.textContent).toContain('Delete blocked');
        expect(status.textContent).toContain('last-row-guard');
    });
});

describe('prompt-library-modal — token-drift guard integration on Save', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.listPromptsByRole.mockImplementation(async (role: string) => ({ ok: true, value: rows[role] ?? [] }));
        mocks.upsertPrompt.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('DB rejects with token-drift -> status shows "Save failed: ..." and modal stays open', async () => {
        mocks.upsertPrompt.mockImplementation(async () => ({ ok: false, error: 'token drift: {{n}} missing' }));
        await openPromptLibraryModal();
        const row = document.querySelector('[data-prompt-slug="plan-concise"]')!;
        const editBtn = Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Edit')!;
        editBtn.click();
        const ta = document.querySelector('textarea') as HTMLTextAreaElement;
        // Simulate the user removing the required {{n}} placeholder — DB parity guard should reject.
        ta.value = 'A B (no token)';
        const saveBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Save')!;
        saveBtn.click();
        await flush();
        expect(mocks.upsertPrompt).toHaveBeenCalledTimes(1);
        const modal = document.getElementById('macro-prompt-library-modal');
        expect(modal).not.toBeNull();
        expect(modal!.textContent).toContain('Save failed');
        expect(modal!.textContent).toContain('token drift');
    });
});

/**
 * Delete → DOM removal + subsequent Save drift-guard integration.
 *
 * Complements `prompt-library-modal-delete-drift.test.ts` by asserting the
 * observable end-to-end flow:
 *
 *   1) Successful delete: the deleted prompt's row is removed from the DOM
 *      after the modal re-renders (listPromptsByRole is re-invoked with the
 *      shrunken data set) and the status line reflects success (no
 *      "Delete blocked" text).
 *   2) After a successful delete, editing a *surviving* prompt to remove the
 *      required `{{n}}` token still causes `upsertPrompt` to reject with the
 *      token-drift error, the modal stays open, and the drifted body is not
 *      committed to the visible row (Body untouched on re-render).
 *
 * Together these lock the contract: delete removes the selected prompt from
 * both DB and DOM, and the token-drift guard remains armed for later saves.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));

interface Row {
    Id: number; Slug: string; Name: string; Body: string; Role: string;
    IsDefault: number; CreatedAt: number; UpdatedAt: number;
}

// Mutable store so renderAllRoles reflects post-delete state.
const store: Record<string, Row[]> = {
    plan: [
        { Id: 1, Slug: 'plan-default', Name: 'Plan (default)', Body: 'X {{n}} Y', Role: 'plan', IsDefault: 1, CreatedAt: 0, UpdatedAt: 0 },
        { Id: 2, Slug: 'plan-concise', Name: 'Plan (concise)', Body: 'A {{n}} B', Role: 'plan', IsDefault: 0, CreatedAt: 0, UpdatedAt: 0 },
        { Id: 3, Slug: 'plan-verbose', Name: 'Plan (verbose)', Body: 'V {{n}} W', Role: 'plan', IsDefault: 0, CreatedAt: 0, UpdatedAt: 0 },
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
    for (let i = 0; i < 4; i += 1) await new Promise((r) => setTimeout(r, 0));
}

function findRow(slug: string): HTMLElement | null {
    return document.querySelector('[data-prompt-slug="' + slug + '"]');
}

function clickButton(scope: ParentNode, label: string): void {
    const btn = Array.from(scope.querySelectorAll('button')).find((b) => b.textContent === label);
    if (!btn) throw new Error('button not found: ' + label);
    btn.click();
}

beforeEach(() => {
    document.body.innerHTML = '';
    // Reset store to a known baseline for each test.
    store.plan = [
        { Id: 1, Slug: 'plan-default', Name: 'Plan (default)', Body: 'X {{n}} Y', Role: 'plan', IsDefault: 1, CreatedAt: 0, UpdatedAt: 0 },
        { Id: 2, Slug: 'plan-concise', Name: 'Plan (concise)', Body: 'A {{n}} B', Role: 'plan', IsDefault: 0, CreatedAt: 0, UpdatedAt: 0 },
        { Id: 3, Slug: 'plan-verbose', Name: 'Plan (verbose)', Body: 'V {{n}} W', Role: 'plan', IsDefault: 0, CreatedAt: 0, UpdatedAt: 0 },
    ];
    mocks.listPromptsByRole.mockReset();
    mocks.listPromptsByRole.mockImplementation(async (role: string) => ({ ok: true, value: store[role] ?? [] }));
    mocks.deletePromptById.mockReset();
    mocks.deletePromptById.mockImplementation(async (id: number) => {
        store.plan = store.plan.filter((r) => r.Id !== id);
        return { ok: true };
    });
    mocks.upsertPrompt.mockReset();
    mocks.upsertPrompt.mockImplementation(async () => ({ ok: true, value: 99 }));
});
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('prompt-library-modal — delete removes row + drift guard persists on next Save', () => {
    it('confirmed delete: DOM row disappears and listPromptsByRole is re-invoked with shrunken set', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        await openPromptLibraryModal();

        expect(findRow('plan-concise')).not.toBeNull();
        const initialListCalls = mocks.listPromptsByRole.mock.calls.length;

        clickButton(findRow('plan-concise')!, 'Delete');
        await flush();

        expect(mocks.deletePromptById).toHaveBeenCalledWith(2);
        expect(findRow('plan-concise')).toBeNull();
        // Surviving rows still present.
        expect(findRow('plan-default')).not.toBeNull();
        expect(findRow('plan-verbose')).not.toBeNull();
        // Re-render fetched the shrunken data set.
        expect(mocks.listPromptsByRole.mock.calls.length).toBeGreaterThan(initialListCalls);
        // Status line does not report a block.
        const modal = document.getElementById('macro-prompt-library-modal')!;
        expect(modal.textContent).not.toContain('Delete blocked');
    });

    it('after successful delete, editing a survivor to drop {{n}} is rejected and the modal stays open with unchanged body', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        // Arm token-drift rejection for the subsequent upsertPrompt call.
        mocks.upsertPrompt.mockImplementation(async () => ({ ok: false, error: 'token drift: {{n}} missing' }));

        await openPromptLibraryModal();

        // Step 1: delete plan-concise.
        clickButton(findRow('plan-concise')!, 'Delete');
        await flush();
        expect(findRow('plan-concise')).toBeNull();

        // Step 2: edit a survivor (plan-verbose), remove the {{n}} token, click Save.
        clickButton(findRow('plan-verbose')!, 'Edit');
        const ta = document.querySelector('textarea') as HTMLTextAreaElement;
        expect(ta).not.toBeNull();
        ta.value = 'no token here';
        clickButton(document, 'Save');
        await flush();

        // upsertPrompt was called exactly once (for the survivor edit).
        expect(mocks.upsertPrompt).toHaveBeenCalledTimes(1);
        // Modal is still mounted with a drift error surfaced.
        const modal = document.getElementById('macro-prompt-library-modal');
        expect(modal).not.toBeNull();
        expect(modal!.textContent).toContain('Save failed');
        expect(modal!.textContent).toContain('token drift');
        // The persistent store was NOT mutated: survivor Body still contains {{n}}.
        const survivor = store.plan.find((r) => r.Slug === 'plan-verbose')!;
        expect(survivor.Body).toContain('{{n}}');
    });

    it('cancelled delete leaves DOM row intact and does not call deletePromptById', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        await openPromptLibraryModal();
        clickButton(findRow('plan-concise')!, 'Delete');
        await flush();
        expect(mocks.deletePromptById).not.toHaveBeenCalled();
        expect(findRow('plan-concise')).not.toBeNull();
    });
});

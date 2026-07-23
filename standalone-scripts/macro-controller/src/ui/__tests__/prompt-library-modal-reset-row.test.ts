/**
 * Plan-23 remaining-item #3 (regression coverage for v4.144.0 Step 2).
 *
 * Prompt Library per-row `↺ Reset` action:
 *   - Renders ONLY for seeded slugs whose current Body diverges from the seed.
 *   - Absent when Body already equals the shipped seed (nothing to reset).
 *   - Absent for user-authored (non-seeded) slugs.
 *   - Confirm=true  -> upsertPrompt called with Body=seedBody, other metadata preserved.
 *   - Confirm=false -> upsertPrompt NOT called; status untouched.
 *   - upsertPrompt returning ok:false surfaces a "Reset failed: <err>" status line.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PLAN_DEFAULT_BODY } from '../../seed/plan-next-prompts';

vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../error-utils', () => ({ logError: vi.fn() }));
vi.mock('../toast', () => ({ showToast: vi.fn() }));

const rows: Record<string, unknown[]> = {
    plan: [
        // Seeded slug whose body diverges from the seed → Reset visible.
        { Id: 1, Slug: 'plan-default', Name: 'Plan (default)', Body: 'user edit without token', Role: 'plan', IsDefault: 1, Category: 'plan', Tags: '', ReplaceKey: 'n', ReplaceValues: '', CreatedAt: 0, UpdatedAt: 0 },
        // Seeded slug whose body ALREADY equals seed → Reset hidden.
        { Id: 2, Slug: 'plan-concise', Name: 'Plan (concise)', Body: '# Plan in {{n}} steps (concise)\n\nWrite exactly {{n}} numbered steps. No preamble, no rationale block per step, one line each. TODO(user): replace with final concise variant.', Role: 'plan', IsDefault: 0, Category: 'plan', Tags: '', ReplaceKey: 'n', ReplaceValues: '', CreatedAt: 0, UpdatedAt: 0 },
    ],
    next: [],
    generic: [
        // Non-seeded slug → Reset must be hidden regardless of Body.
        { Id: 3, Slug: 'user-custom', Name: 'Custom', Body: 'hello', Role: 'generic', IsDefault: 0, Category: 'generic', Tags: '', ReplaceKey: '', ReplaceValues: '', CreatedAt: 0, UpdatedAt: 0 },
    ],
};

const mocks = vi.hoisted(() => ({
    listPromptsByRole: vi.fn(),
    setDefaultPromptForRole: vi.fn(async () => ({ ok: true })),
    deletePromptById: vi.fn(async () => ({ ok: true })),
    upsertPrompt: vi.fn(async () => ({ ok: true, value: 1 })),
}));
vi.mock('../../db/prompt-db', () => mocks);

import { openPromptLibraryModal } from '../prompt-library-modal';

async function flush(): Promise<void> {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
}

function resetButtonForSlug(slug: string): HTMLButtonElement | null {
    const row = document.querySelector('[data-prompt-slug="' + slug + '"]');
    if (!row) return null;
    return (Array.from(row.querySelectorAll('button')).find(
        (b) => (b.textContent ?? '').includes('Reset'),
    ) as HTMLButtonElement | undefined) ?? null;
}

describe('prompt-library-modal — per-row ↺ Reset', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        mocks.listPromptsByRole.mockImplementation(async (role: string) => ({ ok: true, value: rows[role] ?? [] }));
        mocks.upsertPrompt.mockClear();
        mocks.upsertPrompt.mockImplementation(async () => ({ ok: true, value: 1 }));
    });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('renders the Reset button for a seeded slug whose Body diverges from the seed', async () => {
        await openPromptLibraryModal();
        await flush();
        expect(resetButtonForSlug('plan-default')).not.toBeNull();
    });

    it('does NOT render Reset when the Body already equals the shipped seed', async () => {
        await openPromptLibraryModal();
        await flush();
        expect(resetButtonForSlug('plan-concise')).toBeNull();
    });

    it('does NOT render Reset for a non-seeded (user-authored) slug', async () => {
        await openPromptLibraryModal();
        await flush();
        expect(resetButtonForSlug('user-custom')).toBeNull();
    });

    it('confirm=true calls upsertPrompt with Body=seed and preserves Name/Role/ReplaceKey', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        await openPromptLibraryModal();
        await flush();
        const btn = resetButtonForSlug('plan-default')!;
        btn.click();
        await flush();
        expect(mocks.upsertPrompt).toHaveBeenCalledTimes(1);
        const arg = mocks.upsertPrompt.mock.calls[0]![0] as {
            id: number; slug: string; name: string; body: string; role: string; replaceKey: string;
        };
        expect(arg.slug).toBe('plan-default');
        expect(arg.body).toBe(PLAN_DEFAULT_BODY);
        expect(arg.name).toBe('Plan (default)');
        expect(arg.role).toBe('plan');
        expect(arg.replaceKey).toBe('n');
    });

    it('confirm=false does NOT call upsertPrompt', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        await openPromptLibraryModal();
        await flush();
        resetButtonForSlug('plan-default')!.click();
        await flush();
        expect(mocks.upsertPrompt).not.toHaveBeenCalled();
    });

    it('upsertPrompt returning ok:false surfaces "Reset failed: <err>" in the status line', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        mocks.upsertPrompt.mockImplementationOnce(async () => ({ ok: false, error: 'db-locked' }));
        await openPromptLibraryModal();
        await flush();
        resetButtonForSlug('plan-default')!.click();
        await flush();
        const modal = document.getElementById('macro-prompt-library-modal')!;
        expect(modal.textContent).toContain('Reset failed');
        expect(modal.textContent).toContain('db-locked');
    });
});

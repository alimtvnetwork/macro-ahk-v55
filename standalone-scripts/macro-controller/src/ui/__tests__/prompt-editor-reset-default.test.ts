/**
 * Plan-23 step 4 regression: editor `↺ Reset to default` restores the seed
 * body for a shipped slug, re-runs the drift-guard chip strip (so Save stays
 * disabled if the seed itself is missing a required token — impossible for
 * ours, but the wiring must be live), and never persists until the user
 * explicitly clicks Save.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openPromptCreationModal } from '../prompt-injection';
import { PLAN_NEXT_SEED_ROWS, getSeedBodyForSlug } from '../../seed/plan-next-prompts';

// Prevent JSDOM `window.confirm` from returning undefined (falsy → cancels).
beforeEach(() => {
  document.body.innerHTML = '';
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

function openWithPlanDefault(): { overlay: HTMLElement; textarea: HTMLTextAreaElement; resetBtn: HTMLButtonElement; saveBtn: HTMLButtonElement } {
  const seedRow = PLAN_NEXT_SEED_ROWS.find((r) => r.slug === 'plan-default')!;
  const editPrompt = {
    id: 'db-row-1',
    slug: seedRow.slug,
    name: seedRow.name,
    text: 'Some user-edited body without any placeholder',
  };
  // ctx and taskNextDeps are unused (`_` prefix in the impl).
  openPromptCreationModal({} as never, {} as never, editPrompt as never, undefined, {
    requiredTokens: ['n'],
    roleLabel: 'Plan',
  });

  const overlay = document.getElementById('marco-prompt-modal')!;
  const textarea = overlay.querySelector('textarea') as HTMLTextAreaElement;
  const resetBtn = overlay.querySelector<HTMLButtonElement>('[data-testid="prompt-editor-reset-default"]')!;
  const saveBtn = Array.from(overlay.querySelectorAll('button')).find(
    (b) => b.textContent === '💾 Update',
  ) as HTMLButtonElement;
  return { overlay, textarea, resetBtn, saveBtn };
}

describe('prompt editor: ↺ Reset to default', () => {
  it('renders the reset button when the row slug matches a seed body', () => {
    const { resetBtn } = openWithPlanDefault();
    expect(resetBtn).toBeInstanceOf(HTMLButtonElement);
    expect(resetBtn.textContent).toContain('Reset to default');
  });

  it('does NOT render the reset button for a slug without a seed body', () => {
    openPromptCreationModal({} as never, {} as never, { id: 'x', slug: 'user-custom', name: 'Custom', text: 'anything' } as never, undefined, {
      requiredTokens: [],
      roleLabel: 'Generic',
    });
    const overlay = document.getElementById('marco-prompt-modal')!;
    expect(overlay.querySelector('[data-testid="prompt-editor-reset-default"]')).toBeNull();
  });

  it('replaces the textarea body with the shipped seed body on click', () => {
    const { textarea, resetBtn } = openWithPlanDefault();
    const seedBody = getSeedBodyForSlug('plan-default')!;
    expect(textarea.value).not.toBe(seedBody);
    resetBtn.click();
    expect(textarea.value).toBe(seedBody);
  });

  it('fires an input event so the drift-guard chip strip re-evaluates and re-enables Save', () => {
    const { textarea, resetBtn, saveBtn } = openWithPlanDefault();
    // User body had no {{n}} → Save must start disabled.
    expect(saveBtn.disabled).toBe(true);
    resetBtn.click();
    // Seed body contains {{n}} → Save should now be enabled.
    expect(textarea.value).toContain('{{n}}');
    expect(saveBtn.disabled).toBe(false);
  });

  it('is guarded by confirm() when the current body would be overwritten', () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { textarea, resetBtn } = openWithPlanDefault();
    const before = textarea.value;
    resetBtn.click();
    expect(spy).toHaveBeenCalledOnce();
    // User cancelled → body untouched.
    expect(textarea.value).toBe(before);
    spy.mockRestore();
  });
});

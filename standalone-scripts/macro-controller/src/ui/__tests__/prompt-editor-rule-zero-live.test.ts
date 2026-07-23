/**
 * v4.176.0 — Rule-0 live pre-save indicator regression.
 *
 * The Plan editor MUST surface `validateRuleZero(body)` state live so users
 * see declared vs counted step counts and Save is disabled while a literal
 * mismatch is present. Template bodies (containing `{{n}}`) must stay
 * neutral and never block Save.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { openPromptCreationModal } from '../prompt-injection';
import { PLAN_NEXT_SEED_ROWS } from '../../seed/plan-next-prompts';

beforeEach(() => { document.body.innerHTML = ''; });

function openPlanEditorWith(bodyText: string): {
  badge: HTMLElement;
  saveBtn: HTMLButtonElement;
  textarea: HTMLTextAreaElement;
} {
  const seedRow = PLAN_NEXT_SEED_ROWS.find((r) => r.slug === 'plan-default')!;
  const editPrompt = { id: 'db-row-1', slug: seedRow.slug, name: seedRow.name, text: bodyText };
  openPromptCreationModal({} as never, {} as never, editPrompt as never, undefined, {
    requiredTokens: ['n'],
    roleLabel: 'Plan',
    role: 'plan',
  });
  const overlay = document.getElementById('marco-prompt-modal')!;
  const badge = overlay.querySelector<HTMLElement>('[data-testid="prompt-editor-rule-zero-badge"]')!;
  const textarea = overlay.querySelector('textarea') as HTMLTextAreaElement;
  const saveBtn = Array.from(overlay.querySelectorAll('button')).find(
    (b) => b.textContent === '💾 Update',
  ) as HTMLButtonElement;
  return { badge, saveBtn, textarea };
}

describe('Rule-0 live pre-save indicator (v4.176.0, extended to next in v4.189.0)', () => {
  it('mounts the indicator for the Next role (v4.189.0 parity with Plan)', () => {
    const seedRow = PLAN_NEXT_SEED_ROWS.find((r) => r.slug === 'next-default')!;
    openPromptCreationModal(
      {} as never, {} as never,
      { id: 'x', slug: seedRow.slug, name: seedRow.name, text: seedRow.body } as never,
      undefined,
      { requiredTokens: ['n'], roleLabel: 'Next', role: 'next' },
    );
    const overlay = document.getElementById('marco-prompt-modal')!;
    expect(overlay.querySelector('[data-testid="prompt-editor-rule-zero-indicator"]')).not.toBeNull();
    expect(overlay.querySelector('[data-testid="prompt-editor-rule-zero-badge"]')).not.toBeNull();
  });

  it('does NOT mount the indicator for the Generic role', () => {
    openPromptCreationModal(
      {} as never, {} as never,
      { id: 'g', slug: 'generic-thing', name: 'Generic', text: 'no rule zero here' } as never,
      undefined,
      { requiredTokens: [], roleLabel: 'Generic', role: 'generic' },
    );
    const overlay = document.getElementById('marco-prompt-modal')!;
    expect(overlay.querySelector('[data-testid="prompt-editor-rule-zero-indicator"]')).toBeNull();
  });

  it('shows template state for a body still carrying {{n}} and does not block Save', () => {
    const { badge, saveBtn } = openPlanEditorWith('Steps: {{n}}\n\n## Steps\n1. Do a thing that has {{n}}\n');
    expect(badge.textContent).toMatch(/template/i);
    expect(saveBtn.disabled).toBe(false);
  });

  it('shows match state for concrete N with matching step count', () => {
    const { badge, saveBtn } = openPlanEditorWith(
      'Steps: 2\n\n## Steps\n1. First {{n}}\n2. Second {{n}}\n',
    );
    expect(badge.textContent).toContain('✓');
    expect(saveBtn.disabled).toBe(false);
  });

  it('shows mismatch and blocks Save when counted steps != declared', () => {
    const { badge, saveBtn, textarea } = openPlanEditorWith(
      'Steps: 3\n\n## Steps\n1. Only one {{n}}\n',
    );
    expect(badge.textContent).toContain('✗');
    expect(saveBtn.disabled).toBe(true);
    // Fix the body live and confirm Save re-enables.
    textarea.value = 'Steps: 3\n\n## Steps\n1. a {{n}}\n2. b {{n}}\n3. c {{n}}\n';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(saveBtn.disabled).toBe(false);
    expect(badge.textContent).toContain('✓');
  });

  it('shows no-steps state when declared N > 0 but body has zero numbered steps', () => {
    const { badge, saveBtn } = openPlanEditorWith('Steps: 5\n\nSome prose with {{n}} but no list.');
    expect(badge.textContent).toMatch(/0 numbered steps/);
    expect(saveBtn.disabled).toBe(true);
  });
});

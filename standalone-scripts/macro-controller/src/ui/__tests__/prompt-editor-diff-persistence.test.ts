/**
 * v4.192.0 — Diff-pane open/closed state persists per role via localStorage.
 * Key namespace: `marco.diffOpen.<role>` where role is 'plan' | 'next' |
 * 'generic'. Guarantees:
 *   1. Toggling in one role writes only that role's key.
 *   2. Re-opening the same-role editor restores the last state.
 *   3. Different roles have independent state (no cross-role bleed).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { openPromptCreationModal } from '../prompt-injection';
import { PLAN_NEXT_SEED_ROWS } from '../../seed/plan-next-prompts';
import { clearDiffPrefs, DIFF_PREF_PREFIX } from './helpers/clear-diff-prefs';

const PLAN_KEY = `${DIFF_PREF_PREFIX}plan`;
const NEXT_KEY = `${DIFF_PREF_PREFIX}next`;

beforeEach(() => {
  document.body.innerHTML = '';
  clearDiffPrefs();
});


function openEditModal(role: 'plan' | 'next'): {
  overlay: HTMLElement;
  diffBtn: HTMLButtonElement;
  diffHost: HTMLElement;
} {
  const slug = role + '-default';
  const seedRow = PLAN_NEXT_SEED_ROWS.find((r) => r.slug === slug)!;
  const editPrompt = { id: 'db-row', slug: seedRow.slug, name: seedRow.name, text: seedRow.body };
  openPromptCreationModal({} as never, {} as never, editPrompt as never, undefined, {
    requiredTokens: ['n'], roleLabel: role, role,
  });
  const overlay = document.getElementById('marco-prompt-modal')!;
  const diffBtn = overlay.querySelector<HTMLButtonElement>('[data-testid="prompt-editor-diff-toggle"]')!;
  const diffHost = overlay.querySelector<HTMLElement>('[data-testid="prompt-editor-diff-host"]')!;
  return { overlay, diffBtn, diffHost };
}

describe('Diff-pane persistence per role (v4.192.0)', () => {
  it('writes the persisted state to localStorage when toggled', () => {
    const { diffBtn } = openEditModal('plan');
    expect(window.localStorage.getItem(PLAN_KEY)).toBeNull();
    diffBtn.click();
    expect(window.localStorage.getItem(PLAN_KEY)).toBe('1');
    diffBtn.click();
    expect(window.localStorage.getItem(PLAN_KEY)).toBe('0');
  });

  it('restores the pane open on re-open when the role key was "1"', () => {
    window.localStorage.setItem(PLAN_KEY, '1');
    const { diffBtn, diffHost } = openEditModal('plan');
    expect(diffHost.style.display).toBe('block');
    expect(diffBtn.textContent).toBe('🔍 Hide diff');
  });

  it('keeps the pane closed on re-open when the role key was "0" or missing', () => {
    window.localStorage.setItem(PLAN_KEY, '0');
    const { diffHost } = openEditModal('plan');
    expect(diffHost.style.display).toBe('none');
  });

  it('scopes state per role: plan and next do not share the key', () => {
    const plan = openEditModal('plan');
    plan.diffBtn.click();
    expect(window.localStorage.getItem(PLAN_KEY)).toBe('1');
    expect(window.localStorage.getItem(NEXT_KEY)).toBeNull();
    plan.overlay.remove();

    const next = openEditModal('next');
    expect(next.diffHost.style.display).toBe('none');
    next.diffBtn.click();
    expect(window.localStorage.getItem(NEXT_KEY)).toBe('1');
    // Plan key untouched by the Next toggle.
    expect(window.localStorage.getItem(PLAN_KEY)).toBe('1');
  });
});

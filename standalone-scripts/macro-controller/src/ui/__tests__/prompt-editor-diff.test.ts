/**
 * v4.177.0 — Inline diff pane regression.
 *
 * Users must be able to preview the exact +/- delta between the currently-
 * saved prompt body and their in-flight edits BEFORE clicking Save.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { openPromptCreationModal } from '../prompt-injection';
import {
  diffLines,
  summarizeDiff,
  renderDiffPane,
  DIFF_OP_ADD,
  DIFF_OP_REMOVE,
  DIFF_OP_EQUAL,
} from '../prompt-diff';
import { PLAN_NEXT_SEED_ROWS } from '../../seed/plan-next-prompts';
import { clearDiffPrefs } from './helpers/clear-diff-prefs';

beforeEach(() => {
  document.body.innerHTML = '';
  // v4.192.0 persists diff open/closed state to localStorage under the
  // `marco.diffOpen.<role>` namespace. Clearing those keys prevents a prior
  // test's toggle click from leaking a pre-open pane into the next test
  // (which would then close on toggle instead of opening).
  clearDiffPrefs();
});


describe('diffLines()', () => {
  it('marks identical bodies as all-equal', () => {
    const ops = diffLines('a\nb\nc', 'a\nb\nc');
    expect(ops.every((o) => o.op === DIFF_OP_EQUAL)).toBe(true);
  });
  it('detects added and removed lines', () => {
    const ops = diffLines('a\nb\nc', 'a\nB\nc\nd');
    const added = ops.filter((o) => o.op === DIFF_OP_ADD).map((o) => o.text);
    const removed = ops.filter((o) => o.op === DIFF_OP_REMOVE).map((o) => o.text);
    expect(added).toContain('B');
    expect(added).toContain('d');
    expect(removed).toContain('b');
  });
});

describe('summarizeDiff()', () => {
  it('counts adds, removes, unchanged', () => {
    const stats = summarizeDiff(diffLines('a\nb', 'a\nB\nc'));
    expect(stats.added).toBe(2);
    expect(stats.removed).toBe(1);
    expect(stats.unchanged).toBe(1);
  });
});

describe('renderDiffPane()', () => {
  it('emits an empty marker when bodies match', () => {
    const pane = renderDiffPane('same\nbody', 'same\nbody');
    expect(pane.querySelector('[data-testid="prompt-editor-diff-empty"]')).not.toBeNull();
  });
  it('emits +/- rows with data-diff-op attributes', () => {
    const pane = renderDiffPane('one\ntwo', 'one\nTWO');
    const ops = Array.from(pane.querySelectorAll('[data-diff-op]')).map(
      (node) => (node as HTMLElement).dataset.diffOp,
    );
    expect(ops).toContain('add');
    expect(ops).toContain('remove');
  });
});

function openEditorWith(baseline: string): {
  overlay: HTMLElement;
  toggle: HTMLButtonElement;
  host: HTMLElement;
  textarea: HTMLTextAreaElement;
} {
  const seedRow = PLAN_NEXT_SEED_ROWS.find((r) => r.slug === 'plan-default')!;
  const editPrompt = { id: 'db-row-1', slug: seedRow.slug, name: seedRow.name, text: baseline };
  openPromptCreationModal({} as never, {} as never, editPrompt as never, undefined, {
    requiredTokens: ['n'],
    roleLabel: 'Plan',
    role: 'plan',
  });
  const overlay = document.getElementById('marco-prompt-modal')!;
  const toggle = overlay.querySelector<HTMLButtonElement>('[data-testid="prompt-editor-diff-toggle"]')!;
  const host = overlay.querySelector<HTMLElement>('[data-testid="prompt-editor-diff-host"]')!;
  const textarea = overlay.querySelector('textarea') as HTMLTextAreaElement;
  return { overlay, toggle, host, textarea };
}

describe('Diff toggle wired into the Plan editor', () => {
  it('is hidden by default and revealed on click', () => {
    const { toggle, host } = openEditorWith('line-1\nline-2\n{{n}} steps');
    expect(host.style.display).toBe('none');
    toggle.click();
    expect(host.style.display).toBe('block');
    expect(host.querySelector('[data-testid="prompt-editor-diff-pane"]')).not.toBeNull();
  });

  it('updates live as the textarea changes while open', () => {
    const { toggle, host, textarea } = openEditorWith('line-1\nline-2\n{{n}} steps');
    toggle.click();
    textarea.value = 'line-1\nline-CHANGED\n{{n}} steps';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const rows = Array.from(host.querySelectorAll('[data-diff-op]')).map(
      (node) => (node as HTMLElement).dataset.diffOp,
    );
    expect(rows).toContain('add');
    expect(rows).toContain('remove');
  });

  it('does not render a diff toggle in create mode (no baseline)', () => {
    openPromptCreationModal({} as never, {} as never, null, undefined, {
      requiredTokens: [],
      roleLabel: 'Generic',
    });
    const overlay = document.getElementById('marco-prompt-modal')!;
    expect(overlay.querySelector('[data-testid="prompt-editor-diff-toggle"]')).toBeNull();
  });
});

/**
 * v4.189.0 — Ctrl+D / Cmd+D keyboard shortcut toggles the diff pane while
 * the prompt editor modal is open. Guards against the regressions this
 * shortcut has to survive:
 *
 *   1. Only fires while the modal is mounted (self-removes when overlay is
 *      detached), so a Ctrl+D in a later, unrelated modal instance does not
 *      trip a stale listener.
 *   2. Only visible/wired in edit mode (needs a diff baseline). Add-new
 *      mode has no diff button and pressing Ctrl+D must be a no-op.
 *   3. Ignores modified variants (Ctrl+Shift+D, Ctrl+Alt+D) to leave room
 *      for future shortcuts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { openPromptCreationModal } from '../prompt-injection';
import { PLAN_NEXT_SEED_ROWS } from '../../seed/plan-next-prompts';
import { clearDiffPrefs } from './helpers/clear-diff-prefs';

beforeEach(() => { document.body.innerHTML = ''; clearDiffPrefs(); });


function dispatchCtrlD(target: EventTarget, opts?: Partial<KeyboardEventInit>): boolean {
  const ev = new KeyboardEvent('keydown', {
    key: 'd', code: 'KeyD', ctrlKey: true, bubbles: true, cancelable: true, ...opts,
  });
  return target.dispatchEvent(ev);
}

function openEditModalOnSeed(): {
  overlay: HTMLElement;
  diffBtn: HTMLButtonElement;
  diffHost: HTMLElement;
} {
  const seedRow = PLAN_NEXT_SEED_ROWS.find((r) => r.slug === 'plan-default')!;
  const editPrompt = { id: 'db-row-1', slug: seedRow.slug, name: seedRow.name, text: seedRow.body };
  openPromptCreationModal({} as never, {} as never, editPrompt as never, undefined, {
    requiredTokens: ['n'], roleLabel: 'Plan', role: 'plan',
  });
  const overlay = document.getElementById('marco-prompt-modal')!;
  const diffBtn = overlay.querySelector<HTMLButtonElement>('[data-testid="prompt-editor-diff-toggle"]')!;
  const diffHost = overlay.querySelector<HTMLElement>('[data-testid="prompt-editor-diff-host"]')!;
  return { overlay, diffBtn, diffHost };
}

describe('Diff pane Ctrl+D shortcut (v4.189.0)', () => {
  it('toggles the diff pane visibility on Ctrl+D', () => {
    const { diffBtn, diffHost } = openEditModalOnSeed();
    expect(diffHost.style.display).toBe('none');
    expect(diffBtn.textContent).toBe('🔍 Diff vs saved');

    dispatchCtrlD(document);
    expect(diffHost.style.display).toBe('block');
    expect(diffBtn.textContent).toBe('🔍 Hide diff');

    dispatchCtrlD(document);
    expect(diffHost.style.display).toBe('none');
    expect(diffBtn.textContent).toBe('🔍 Diff vs saved');
  });

  it('supports Cmd+D on macOS (metaKey variant)', () => {
    const { diffHost } = openEditModalOnSeed();
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'd', code: 'KeyD', metaKey: true, bubbles: true, cancelable: true,
    }));
    expect(diffHost.style.display).toBe('block');
  });

  it('ignores Ctrl+Shift+D and Ctrl+Alt+D so future shortcuts stay free', () => {
    const { diffHost } = openEditModalOnSeed();
    dispatchCtrlD(document, { shiftKey: true });
    expect(diffHost.style.display).toBe('none');
    dispatchCtrlD(document, { altKey: true });
    expect(diffHost.style.display).toBe('none');
  });

  it('is a no-op in add-new mode (no diff baseline, no diff button)', () => {
    openPromptCreationModal({} as never, {} as never, null, { name: 'Fresh' }, {
      requiredTokens: [], roleLabel: 'Generic', role: 'generic',
    });
    const overlay = document.getElementById('marco-prompt-modal')!;
    expect(overlay.querySelector('[data-testid="prompt-editor-diff-toggle"]')).toBeNull();
    // Dispatching Ctrl+D must not throw and must not synthesize a host.
    expect(() => dispatchCtrlD(document)).not.toThrow();
    expect(overlay.querySelector('[data-testid="prompt-editor-diff-host"]')?.childElementCount).toBe(0);
  });

  it('stale handler self-removes once the overlay is detached', () => {
    const { overlay, diffHost } = openEditModalOnSeed();
    overlay.remove();
    // Open a fresh add-new modal — Ctrl+D on the OLD listener must not toggle
    // the detached host, and must not crash the new modal.
    openPromptCreationModal({} as never, {} as never, null, { name: 'Fresh' }, {
      requiredTokens: [], roleLabel: 'Generic', role: 'generic',
    });
    dispatchCtrlD(document);
    expect(diffHost.style.display).toBe('none');
  });
});

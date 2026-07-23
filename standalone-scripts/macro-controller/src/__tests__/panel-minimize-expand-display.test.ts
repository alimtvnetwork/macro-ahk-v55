/**
 * Issue 117 regression test — Macro toolbar button squish after minimize→expand.
 *
 * RCA: `toggleMinimize` previously set `el.style.display = 'none'` then
 * `el.style.display = ''`, which REMOVES the inline display property and
 * reverts <div> elements (like btnRow) to their UA default of `block`,
 * wiping out the inline `display:flex` written via cssText. The fix stashes
 * the original `display` into `data-macro-prev-display` and restores it on
 * expand.
 *
 * See: spec/22-app-issues/117-toolbar-button-squish/02-step2-rca-evidence.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logging', () => ({
  log: vi.fn(),
  logSub: vi.fn(),
}));

vi.mock('../constants', () => ({
  PANEL_EDGE_MARGIN: 8,
  PANEL_MIN_VISIBLE_HEIGHT: 100,
  PANEL_MIN_VISIBLE_WIDTH: 100,
  DEFAULT_BACKDROP_OPACITY: 0.4,
}));

vi.mock('../shared-state', () => ({
  PANEL_DEFAULT_WIDTH: 494,
  PANEL_DEFAULT_HEIGHT: 760,
}));

import {
  createPanelLayoutCtx,
  toggleMinimize,
  hideBodyElementForMinimize,
  restorePanel,
} from '../ui/panel-layout';

function buildBtnRowLike(): HTMLDivElement {
  // Mirrors panel-controls.ts L130 — the actual production cssText for btnRow.
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;gap:10px;row-gap:10px;flex-wrap:wrap;'
    + 'align-items:center;justify-content:center;padding:8px 10px 10px;'
    + 'width:100%;max-width:100%;min-width:0;margin:0 auto;'
    + 'box-sizing:border-box;overflow:visible;';
  return el;
}

describe('Issue 117 — minimize/expand preserves inline display:flex on body elements', () => {
  let ui: HTMLDivElement;
  let btnRow: HTMLDivElement;
  let plainBlock: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    ui = document.createElement('div');
    ui.style.height = '760px';
    document.body.appendChild(ui);

    btnRow = buildBtnRowLike();
    plainBlock = document.createElement('div');
    plainBlock.style.cssText = 'padding:4px;';
    ui.append(btnRow, plainBlock);
  });

  it('preserves display:flex on the button row across minimize → expand', () => {
    const ctx = createPanelLayoutCtx(ui, '', '', '');
    ctx.bodyElements = [btnRow, plainBlock];

    expect(btnRow.style.display).toBe('flex');

    toggleMinimize(ctx);
    expect(ctx.panelState).toBe('minimized');
    expect(btnRow.style.display).toBe('none');
    expect(btnRow.getAttribute('data-macro-prev-display')).toBe('flex');

    toggleMinimize(ctx);
    expect(ctx.panelState).toBe('expanded');
    // Critical assertion: display:flex must come back, not the empty string.
    expect(btnRow.style.display).toBe('flex');
    expect(btnRow.hasAttribute('data-macro-prev-display')).toBe(false);
  });

  it('survives repeated minimize → expand cycles without drift', () => {
    const ctx = createPanelLayoutCtx(ui, '', '', '');
    ctx.bodyElements = [btnRow, plainBlock];

    for (let i = 0; i < 5; i++) {
      toggleMinimize(ctx); // minimize
      toggleMinimize(ctx); // expand
      expect(btnRow.style.display).toBe('flex');
    }
  });

  it('does not invent a display value for elements that had none', () => {
    const ctx = createPanelLayoutCtx(ui, '', '', '');
    ctx.bodyElements = [btnRow, plainBlock];

    expect(plainBlock.style.display).toBe('');

    toggleMinimize(ctx);
    toggleMinimize(ctx);

    expect(plainBlock.style.display).toBe('');
  });

  it('restorePanel also brings back original display values', () => {
    const ctx = createPanelLayoutCtx(ui, '', '', '');
    ctx.bodyElements = [btnRow, plainBlock];

    // Simulate _restoreMinimizedPanel’s initial-load hide path:
    hideBodyElementForMinimize(btnRow);
    hideBodyElementForMinimize(plainBlock);
    ctx.panelState = 'minimized';
    expect(btnRow.style.display).toBe('none');

    restorePanel(ctx);
    expect(ctx.panelState).toBe('expanded');
    expect(btnRow.style.display).toBe('flex');
    expect(plainBlock.style.display).toBe('');
  });

  it('hideBodyElementForMinimize is idempotent — repeated calls do not lose original display', () => {
    hideBodyElementForMinimize(btnRow);
    expect(btnRow.getAttribute('data-macro-prev-display')).toBe('flex');

    // Idempotency: calling again must NOT overwrite the stash with 'none'.
    hideBodyElementForMinimize(btnRow);
    expect(btnRow.getAttribute('data-macro-prev-display')).toBe('flex');
  });
});

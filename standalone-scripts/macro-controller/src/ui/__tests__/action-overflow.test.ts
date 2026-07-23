/**
 * Regression tests for installActionOverflow — the ⋯ actions popover that
 * relocates trailing action buttons (data-trailing-action="1") into a menu
 * when the strip gets tight. Mirrors the chip-overflow test scaffolding
 * (stubbed clientWidth/scrollWidth, FakeResizeObserver) so recompute() can
 * be exercised in jsdom.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../logging', () => ({ log: vi.fn() }));

import {
  installActionOverflow,
  __resetNextInlineForTests,
} from '../next-inline-ui';

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const ACTION_W = 60;
const OVERFLOW_W = 40;

function stubSizing(body: HTMLElement, clientWidth: () => number): void {
  Object.defineProperty(body, 'clientWidth', {
    configurable: true,
    get: clientWidth,
  });
  Object.defineProperty(body, 'scrollWidth', {
    configurable: true,
    get() {
      // Actions still in flow contribute width. Actions that were relocated
      // into the ⋯ popover (which is position:absolute) don't.
      let w = 0;
      for (const childElement of body.children) {
        const childHtmlElement = childElement as HTMLElement;
        if (childHtmlElement.dataset.role === 'action-overflow') {
          if (childHtmlElement.style.display !== 'none') w += OVERFLOW_W;
          continue;
        }
        if (childHtmlElement.dataset.trailingAction === '1' && childHtmlElement.style.display !== 'none') w += ACTION_W;
      }
      return w;
    },
  });
}

function makeAction(label: string): HTMLElement {
  const wrap = document.createElement('span');
  wrap.dataset.trailingAction = '1';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  wrap.appendChild(btn);
  return wrap;
}

describe('installActionOverflow (⋯ trailing-actions popover)', () => {
  beforeEach(() => {
    (globalThis as unknown as { ResizeObserver: typeof FakeResizeObserver })
      .ResizeObserver = FakeResizeObserver;
  });

  afterEach(() => {
    __resetNextInlineForTests();
    document.body.innerHTML = '';
  });

  it('stays hidden while every action fits in the strip', () => {
    const body = document.createElement('div');
    body.appendChild(makeAction('More'));
    document.body.appendChild(body);
    stubSizing(body, () => 1000);

    const recompute = installActionOverflow(body, 'rgba(245,158,11,0.6)');
    recompute();

    const wrap = body.querySelector<HTMLElement>('[data-role="action-overflow"]')!;
    expect(wrap.style.display).toBe('none');
    expect(body.querySelectorAll('[data-trailing-action="1"]').length).toBe(1);
    expect(body.querySelector('[data-trailing-action="1"]')!.parentElement).toBe(body);
  });

  it('relocates trailing actions into the ⋯ popover when the strip is tight', () => {
    const body = document.createElement('div');
    const a1 = makeAction('Edit');
    const a2 = makeAction('Manage');
    const a3 = makeAction('More');
    body.append(a1, a2, a3);
    document.body.appendChild(body);
    // 3 actions × 60 = 180; container = 100. After showing ⋯ (+40) drop
    // actions from the end until scrollWidth ≤ 101: 1 action visible (60+40).
    stubSizing(body, () => 100);

    const recompute = installActionOverflow(body, 'rgba(245,158,11,0.6)');
    recompute();

    const wrap = body.querySelector<HTMLElement>('[data-role="action-overflow"]')!;
    expect(wrap.style.display).toBe('inline-block');

    const panel = wrap.querySelector<HTMLElement>('[role="menu"]')!;
    // a3 and a2 got relocated (from the end); a1 stays in flow.
    expect(a1.parentElement).toBe(body);
    expect(a2.parentElement).toBe(panel);
    expect(a3.parentElement).toBe(panel);
    // Relocation order preserves original left-to-right order.
    expect(Array.from(panel.children)).toEqual([a2, a3]);
  });

  it('restores actions to their original slot when the container grows', () => {
    const body = document.createElement('div');
    const a1 = makeAction('Edit');
    const a2 = makeAction('More');
    body.append(a1, a2);
    document.body.appendChild(body);

    let width = 100;
    stubSizing(body, () => width);
    const recompute = installActionOverflow(body, 'rgba(245,158,11,0.6)');
    recompute();

    const wrap = body.querySelector<HTMLElement>('[data-role="action-overflow"]')!;
    const panel = wrap.querySelector<HTMLElement>('[role="menu"]')!;
    expect(a2.parentElement).toBe(panel);

    width = 1000;
    recompute();
    expect(wrap.style.display).toBe('none');
    expect(a1.parentElement).toBe(body);
    expect(a2.parentElement).toBe(body);
    // Original order preserved: a1 then a2 then the ⋯ wrap.
    const ordered = Array.from(body.children).filter(
      (childElement) => (childElement as HTMLElement).dataset.trailingAction === '1',
    );
    expect(ordered).toEqual([a1, a2]);
  });

  it('preserves click handlers on relocated actions', () => {
    const body = document.createElement('div');
    const a1 = makeAction('Edit');
    const a2 = makeAction('More');
    body.append(a1, a2);
    document.body.appendChild(body);
    stubSizing(body, () => 100);

    const clicked = vi.fn();
    a2.querySelector('button')!.addEventListener('click', clicked);

    const recompute = installActionOverflow(body, 'rgba(245,158,11,0.6)');
    recompute();

    const wrap = body.querySelector<HTMLElement>('[data-role="action-overflow"]')!;
    const panel = wrap.querySelector<HTMLElement>('[role="menu"]')!;
    expect(a2.parentElement).toBe(panel);

    // Open the ⋯ popover and click the relocated action.
    wrap.querySelector<HTMLButtonElement>('button')!.click();
    a2.querySelector<HTMLButtonElement>('button')!.click();
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('exposes correct ARIA and closes on Esc with focus restore', () => {
    const body = document.createElement('div');
    body.append(makeAction('Edit'), makeAction('Manage'), makeAction('More'));
    document.body.appendChild(body);
    stubSizing(body, () => 100);

    const recompute = installActionOverflow(body, 'rgba(245,158,11,0.6)');
    recompute();

    const wrap = body.querySelector<HTMLElement>('[data-role="action-overflow"]')!;
    const btn = wrap.querySelector<HTMLButtonElement>('button')!;
    const panel = wrap.querySelector<HTMLElement>('[role="menu"]')!;

    expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    expect(btn.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-label')).toBe('Additional actions');

    btn.click();
    expect(panel.style.display).toBe('flex');
    expect(btn.getAttribute('aria-expanded')).toBe('true');

    panel.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true,
    }));
    expect(panel.style.display).toBe('none');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(btn);
  });

  it('closes on outside pointerdown and restores focus to the trigger', () => {
    const body = document.createElement('div');
    body.append(makeAction('Edit'), makeAction('Manage'), makeAction('More'));
    document.body.appendChild(body);
    stubSizing(body, () => 100);

    const recompute = installActionOverflow(body, 'rgba(245,158,11,0.6)');
    recompute();

    const wrap = body.querySelector<HTMLElement>('[data-role="action-overflow"]')!;
    const btn = wrap.querySelector<HTMLButtonElement>('button')!;
    const panel = wrap.querySelector<HTMLElement>('[role="menu"]')!;

    btn.click();
    expect(panel.style.display).toBe('flex');
    // Focus is on the first relocated menu item; simulates the trap.
    expect(panel.contains(document.activeElement)).toBe(true);

    // Non-focusable outside region: mousedown on document.body should close
    // the popover AND restore focus to the trigger.
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(panel.style.display).toBe('none');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(btn);
  });

  it('outside pointerdown honours a subsequent native focus on the clicked target', () => {
    // In real browsers, mousedown fires first, then the native focus moves
    // to the pointer's target. This test simulates that ordering: our
    // handler restores focus to the trigger, then the browser's native
    // focus-on-mousedown wins (represented here by an explicit focus()).
    const body = document.createElement('div');
    body.append(makeAction('Edit'), makeAction('Manage'), makeAction('More'));
    document.body.appendChild(body);
    const otherInput = document.createElement('input');
    document.body.appendChild(otherInput);
    stubSizing(body, () => 100);

    const recompute = installActionOverflow(body, 'rgba(245,158,11,0.6)');
    recompute();

    const wrap = body.querySelector<HTMLElement>('[data-role="action-overflow"]')!;
    const btn = wrap.querySelector<HTMLButtonElement>('button')!;
    const panel = wrap.querySelector<HTMLElement>('[role="menu"]')!;

    btn.click();
    expect(panel.style.display).toBe('flex');

    otherInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    // After our handler: popover closed, focus restored to trigger.
    expect(panel.style.display).toBe('none');
    expect(document.activeElement).toBe(btn);
    // Simulate native focus-on-mousedown taking over.
    otherInput.focus();
    expect(document.activeElement).toBe(otherInput);
  });
});

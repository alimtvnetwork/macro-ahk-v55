/**
 * Regression tests for installChipOverflow (ResizeObserver-driven chip hiding
 * on the Plan/Next inline strips). jsdom does not lay out, so we stub
 * `clientWidth` / `scrollWidth` on the container so the recompute() sizing
 * math can be exercised deterministically. This pins:
 *
 *   1. When chips fit, the ⋯ trigger stays hidden and no chips are moved.
 *   2. When they overflow, the last chips are hidden from the strip and
 *      re-rendered into the popover panel in their original left-to-right
 *      order (via `unshift`).
 *   3. Recomputing after the container grows restores every chip and
 *      re-hides the ⋯ trigger.
 *   4. Accessibility contract: trigger exposes aria-haspopup/expanded/controls
 *      and the panel has role="menu". Esc closes and restores focus.
 *
 * See standalone-scripts/macro-controller/src/ui/next-inline-ui.ts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../logging', () => ({ log: vi.fn() }));

import {
  installChipOverflow,
  __resetNextInlineForTests,
} from '../next-inline-ui';

class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const CHIP_W = 30;
const OVERFLOW_W = 40;

function stubSizing(body: HTMLElement, clientWidth: () => number): void {
  Object.defineProperty(body, 'clientWidth', {
    configurable: true,
    get: clientWidth,
  });
  Object.defineProperty(body, 'scrollWidth', {
    configurable: true,
    get() {
      let w = 0;
      const chips = body.querySelectorAll<HTMLElement>('[data-chip="1"]');
      for (const c of chips) if (c.style.display !== 'none') w += CHIP_W;
      const wrap = body.querySelector<HTMLElement>('[data-role="chip-overflow"]');
      if (wrap && wrap.style.display !== 'none') w += OVERFLOW_W;
      return w;
    },
  });
}

function makeChip(n: number, highlighted = false): HTMLElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.chip = '1';
  b.dataset.n = String(n);
  b.dataset.highlighted = highlighted ? '1' : '0';
  b.textContent = String(n);
  return b;
}

function buildStrip(chipNs: readonly number[]): {
  body: HTMLElement;
  moreWrap: HTMLElement;
} {
  const body = document.createElement('div');
  body.style.display = 'flex';
  for (const n of chipNs) body.appendChild(makeChip(n));
  const moreWrap = document.createElement('span');
  moreWrap.dataset.role = 'more';
  body.appendChild(moreWrap);
  document.body.appendChild(body);
  return { body, moreWrap };
}

describe('installChipOverflow (ResizeObserver-based chip hiding)', () => {
  beforeEach(() => {
    (globalThis as unknown as { ResizeObserver: typeof FakeResizeObserver })
      .ResizeObserver = FakeResizeObserver;
  });

  afterEach(() => {
    __resetNextInlineForTests();
    document.body.innerHTML = '';
  });

  it('leaves every chip visible when the strip has room', () => {
    const { body, moreWrap } = buildStrip([1, 2, 3, 5]);
    stubSizing(body, () => 1000);
    const recompute = installChipOverflow(
      body,
      moreWrap,
      (n) => makeChip(n),
      'rgba(124,58,237,0.6)',
    );
    recompute();
    const wrap = body.querySelector<HTMLElement>('[data-role="chip-overflow"]')!;
    expect(wrap.style.display).toBe('none');
    const chips = body.querySelectorAll<HTMLElement>('[data-chip="1"]');
    for (const c of chips) expect(c.style.display).toBe('');
  });

  it('moves the trailing chips into the popover when the strip overflows', () => {
    const { body, moreWrap } = buildStrip([1, 2, 3, 5, 10]);
    // 5 chips × 30 = 150; container = 100. After showing overflow (+40) we
    // must drop chips until scrollWidth ≤ 101: keep 2 chips visible (60+40).
    stubSizing(body, () => 100);
    const recompute = installChipOverflow(
      body,
      moreWrap,
      (n, hi) => makeChip(n, hi),
      'rgba(124,58,237,0.6)',
    );
    recompute();

    const wrap = body.querySelector<HTMLElement>('[data-role="chip-overflow"]')!;
    expect(wrap.style.display).toBe('inline-block');

    const visible: number[] = [];
    for (const c of body.querySelectorAll<HTMLElement>('[data-chip="1"]')) {
      if (c.parentElement === body && c.style.display !== 'none') {
        visible.push(Number(c.dataset.n));
      }
    }
    expect(visible).toEqual([1, 2]);

    const panel = wrap.querySelector<HTMLElement>('[role="menu"]')!;
    const panelNs = Array.from(
      panel.querySelectorAll<HTMLElement>('[data-chip="1"]'),
    ).map((c) => Number(c.dataset.n));
    expect(panelNs).toEqual([3, 5, 10]);
  });

  it('recompute() restores hidden chips when the container grows back', () => {
    const { body, moreWrap } = buildStrip([1, 2, 3, 5, 10]);
    let width = 100;
    stubSizing(body, () => width);
    const recompute = installChipOverflow(
      body,
      moreWrap,
      (n) => makeChip(n),
      'rgba(124,58,237,0.6)',
    );
    recompute();
    const wrap = body.querySelector<HTMLElement>('[data-role="chip-overflow"]')!;
    expect(wrap.style.display).toBe('inline-block');

    width = 1000;
    recompute();
    expect(wrap.style.display).toBe('none');
    const panel = wrap.querySelector<HTMLElement>('[role="menu"]')!;
    expect(panel.querySelectorAll('[data-chip="1"]').length).toBe(0);
    for (const c of body.querySelectorAll<HTMLElement>('[data-chip="1"]')) {
      expect(c.style.display).toBe('');
    }
  });

  it('trigger exposes correct ARIA and Esc closes + restores focus', () => {
    const { body, moreWrap } = buildStrip([1, 2, 3, 5, 10]);
    stubSizing(body, () => 100);
    const recompute = installChipOverflow(
      body,
      moreWrap,
      (n) => makeChip(n),
      'rgba(124,58,237,0.6)',
    );
    recompute();

    const wrap = body.querySelector<HTMLElement>('[data-role="chip-overflow"]')!;
    const btn = wrap.querySelector<HTMLButtonElement>('button')!;
    const panel = wrap.querySelector<HTMLElement>('[role="menu"]')!;

    expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-label')).toBe('Additional sizes');

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

  it('announces open/close and focused item on the aria-live region', async () => {
    const { body, moreWrap } = buildStrip([1, 2, 3, 5, 10]);
    stubSizing(body, () => 100);
    const recompute = installChipOverflow(
      body,
      moreWrap,
      (n) => makeChip(n),
      'rgba(124,58,237,0.6)',
    );
    recompute();

    const wrap = body.querySelector<HTMLElement>('[data-role="chip-overflow"]')!;
    const btn = wrap.querySelector<HTMLButtonElement>('button')!;
    const panel = wrap.querySelector<HTMLElement>('[role="menu"]')!;

    btn.click();
    const live = document.getElementById('marco-popover-announcer')!;
    expect(live).toBeTruthy();
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.getAttribute('aria-atomic')).toBe('true');

    // Announcer schedules text on a microtask/timeout, so wait a tick.
    await new Promise((r) => setTimeout(r, 40));
    expect(live.textContent).toMatch(/Sizes menu opened\. Focused: /);

    panel.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true,
    }));
    await new Promise((r) => setTimeout(r, 40));
    expect(live.textContent).toBe('Sizes menu closed.');
  });
});

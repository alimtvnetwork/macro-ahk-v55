/**
 * Plan popover visual regression, flipped (above) vs normal (below).
 *
 * Locks the content-aware positioning contract for the fixed-position
 * Plan/Next "More" popover so regressions cannot silently recur.
 * The popover must:
 *   - anchor as `position: fixed` and LEFT-align to the trigger, so it
 *     drops down to the RIGHT side of the button (grows rightward),
 *   - drop DOWN when there is enough room below the trigger,
 *   - flip UP when the trigger sits near the viewport bottom,
 *   - cap `maxHeight` to the available side so long menus never overflow,
 *   - always keep `overflow-y: auto` so the numeric grid + gear actions
 *     stay scrollable when clamped,
 *   - clamp the left offset so the panel never overflows the viewport
 *     when the trigger sits near the right edge.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { __positionPopoverFixedForTests } from '../ui/next-inline-ui';

interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

function makeButton(rect: Rect): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  document.body.appendChild(button);
  button.getBoundingClientRect = (): DOMRect => ({
    ...rect,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect,
  }) as DOMRect;
  return button;
}

function makePanel(height: number, width = 220): HTMLElement {
  const panel = document.createElement('div');
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  document.body.appendChild(panel);
  Object.defineProperty(panel, 'offsetHeight', { configurable: true, get: () => height });
  Object.defineProperty(panel, 'offsetWidth', { configurable: true, get: () => width });
  return panel;
}

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

describe('Plan popover fixed-position visual regression', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setViewport(1280, 900);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('normal placement: drops DOWN and to the RIGHT of the trigger', () => {
    const button = makeButton({ top: 100, bottom: 130, left: 900, right: 1000, width: 100, height: 30 });
    const panel = makePanel(300, 220);

    __positionPopoverFixedForTests(panel, button);

    expect(panel.style.position).toBe('fixed');
    // Left-anchored to trigger left (900), within viewport (1280 - 220 - 8 = 1052).
    expect(panel.style.left).toBe('900px');
    expect(panel.style.right).toBe('auto');
    // Below: top = rect.bottom (130) + gap (4) = 134
    expect(panel.style.top).toBe('134px');
    expect(panel.style.bottom).toBe('auto');
    // maxHeight bounded by spaceBelow (770) - gap (4) - margin (8) = 758
    expect(panel.style.maxHeight).toBe('758px');
    expect(panel.style.overflowY).toBe('auto');
  });

  it('flipped placement: opens UP when the trigger sits near the viewport bottom', () => {
    const button = makeButton({ top: 830, bottom: 860, left: 900, right: 1000, width: 100, height: 30 });
    const panel = makePanel(300, 220);

    __positionPopoverFixedForTests(panel, button);

    expect(panel.style.position).toBe('fixed');
    expect(panel.style.left).toBe('900px');
    expect(panel.style.right).toBe('auto');
    expect(panel.style.top).toBe('auto');
    // bottom = innerHeight (900) - rect.top (830) + gap (4) = 74
    expect(panel.style.bottom).toBe('74px');
    expect(panel.style.maxHeight).toBe('818px');
    expect(panel.style.overflowY).toBe('auto');
  });

  it('prefers DOWN when spaceBelow is tight but still >= spaceAbove', () => {
    const button = makeButton({ top: 430, bottom: 460, left: 900, right: 1000, width: 100, height: 30 });
    const panel = makePanel(600, 220);

    __positionPopoverFixedForTests(panel, button);

    expect(panel.style.top).toBe('464px');
    expect(panel.style.bottom).toBe('auto');
    expect(panel.style.maxHeight).toBe('428px');
  });

  it('flip decision is stable across repeated calls (idempotent positioning)', () => {
    const button = makeButton({ top: 830, bottom: 860, left: 900, right: 1000, width: 100, height: 30 });
    const panel = makePanel(300, 220);

    __positionPopoverFixedForTests(panel, button);
    const firstSnapshot = {
      top: panel.style.top,
      bottom: panel.style.bottom,
      left: panel.style.left,
      maxHeight: panel.style.maxHeight,
    };

    __positionPopoverFixedForTests(panel, button);
    const secondSnapshot = {
      top: panel.style.top,
      bottom: panel.style.bottom,
      left: panel.style.left,
      maxHeight: panel.style.maxHeight,
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
  });

  it('clamps left offset so the panel stays within the viewport when trigger is near the right edge', () => {
    // Trigger far right: left=1300, panel width=220, viewport=1280.
    // maxLeft = 1280 - 220 - 8 = 1052. Clamped to 1052.
    const button = makeButton({ top: 100, bottom: 130, left: 1300, right: 1400, width: 100, height: 30 });
    const panel = makePanel(200, 220);

    __positionPopoverFixedForTests(panel, button);

    expect(panel.style.left).toBe('1052px');
    expect(panel.style.right).toBe('auto');
  });

  it('maxHeight floor is respected (never below 120px) when both sides are cramped', () => {
    setViewport(1280, 200);
    const button = makeButton({ top: 80, bottom: 110, left: 900, right: 1000, width: 100, height: 30 });
    const panel = makePanel(400, 220);

    __positionPopoverFixedForTests(panel, button);

    expect(panel.style.maxHeight).toBe('120px');
  });
});

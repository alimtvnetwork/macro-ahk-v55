/**
 * Step A4 / A8 — flyout placement resolver unit tests.
 *
 * Pure-function coverage: default right+down, flip near right wall, flip near
 * bottom edge, flip both, cramped-corner clamp to viewport.
 */

import { describe, it, expect } from 'vitest';
import { resolveFlyoutPlacement, FLYOUT_GUTTER_PX } from '../flyout-placement';

const VIEWPORT = { innerWidth: 1280, innerHeight: 800 };
const SIZE = { width: 200, height: 300 };

describe('resolveFlyoutPlacement', () => {
  it('opens right and down by default when there is room', () => {
    const trigger = { top: 100, bottom: 130, left: 300, right: 400 };
    const r = resolveFlyoutPlacement(trigger, SIZE, VIEWPORT);
    expect(r.horizontal).toBe('right');
    expect(r.vertical).toBe('down');
    expect(r.left).toBe(400 + FLYOUT_GUTTER_PX);
    expect(r.top).toBe(100);
  });

  it('flips horizontally to the left when too close to the right wall', () => {
    // trigger near right edge: right=1200, panel width 200 + gutter 8 = 1408 > 1280 → flip
    const trigger = { top: 100, bottom: 130, left: 1100, right: 1200 };
    const r = resolveFlyoutPlacement(trigger, SIZE, VIEWPORT);
    expect(r.horizontal).toBe('left');
    expect(r.left).toBe(1100 - FLYOUT_GUTTER_PX - SIZE.width);
  });

  it('flips vertically upward when too close to the bottom edge', () => {
    // trigger near bottom: top=600, panel height 300 → 900 > 800 → flip up
    const trigger = { top: 600, bottom: 630, left: 300, right: 400 };
    const r = resolveFlyoutPlacement(trigger, SIZE, VIEWPORT);
    expect(r.vertical).toBe('up');
    expect(r.top).toBe(630 - SIZE.height);
  });

  it('flips both horizontally and vertically in the bottom-right corner', () => {
    const trigger = { top: 700, bottom: 730, left: 1150, right: 1250 };
    const r = resolveFlyoutPlacement(trigger, SIZE, VIEWPORT);
    expect(r.horizontal).toBe('left');
    expect(r.vertical).toBe('up');
  });

  it('clamps to the viewport gutter when the flipped position would still overflow', () => {
    // Tiny viewport — panel barely fits anywhere
    const tinyViewport = { innerWidth: 250, innerHeight: 250 };
    const trigger = { top: 240, bottom: 245, left: 240, right: 245 };
    const r = resolveFlyoutPlacement(trigger, SIZE, tinyViewport);
    expect(r.left).toBeGreaterThanOrEqual(FLYOUT_GUTTER_PX);
    expect(r.top).toBeGreaterThanOrEqual(FLYOUT_GUTTER_PX);
  });
});

/**
 * MacroLoop Controller — Flyout placement resolver (Step A4)
 *
 * Pure function. Given a trigger rect, the flyout's own size, and the viewport,
 * decides the top/left where the flyout should be drawn AND which side it ended
 * up on. Default: open to the right of the trigger; flip to the left if it would
 * overflow the right edge. Same logic vertically: default downward, flip upward
 * if it would overflow the bottom edge.
 *
 * No DOM access. No magic numbers — gutter is exported.
 *
 * Spec ref: combined plan Step A4 (submenu auto-flip placement).
 */

export const FLYOUT_GUTTER_PX = 8;

export interface RectLike {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export interface SizeLike {
  readonly width: number;
  readonly height: number;
}

export interface ViewportLike {
  readonly innerWidth: number;
  readonly innerHeight: number;
}

export type HorizontalPlacement = 'right' | 'left';
export type VerticalPlacement = 'down' | 'up';

export interface PlacementResult {
  readonly top: number;
  readonly left: number;
  readonly horizontal: HorizontalPlacement;
  readonly vertical: VerticalPlacement;
}

function resolveHorizontal(trigger: RectLike, size: SizeLike, viewport: ViewportLike): { left: number; horizontal: HorizontalPlacement } {
  const wantRightEdge = trigger.right + FLYOUT_GUTTER_PX + size.width;
  const fitsRight = wantRightEdge <= viewport.innerWidth;

  if (fitsRight) {
    return { left: trigger.right + FLYOUT_GUTTER_PX, horizontal: 'right' };
  }

  const flippedLeft = trigger.left - FLYOUT_GUTTER_PX - size.width;
  const clampedLeft = Math.max(FLYOUT_GUTTER_PX, flippedLeft);
  return { left: clampedLeft, horizontal: 'left' };
}

function resolveVertical(trigger: RectLike, size: SizeLike, viewport: ViewportLike): { top: number; vertical: VerticalPlacement } {
  const wantBottomEdge = trigger.top + size.height;
  const fitsDown = wantBottomEdge <= viewport.innerHeight;

  if (fitsDown) {
    return { top: trigger.top, vertical: 'down' };
  }

  const flippedTop = trigger.bottom - size.height;
  const clampedTop = Math.max(FLYOUT_GUTTER_PX, flippedTop);
  return { top: clampedTop, vertical: 'up' };
}

export function resolveFlyoutPlacement(trigger: RectLike, size: SizeLike, viewport: ViewportLike): PlacementResult {
  const h = resolveHorizontal(trigger, size, viewport);
  const v = resolveVertical(trigger, size, viewport);
  return { top: v.top, left: h.left, horizontal: h.horizontal, vertical: v.vertical };
}

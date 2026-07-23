/**
 * Regression: repeat count wrap through preset ladder.
 * User request 2026-07-18: values beyond 60 must cycle into 70 / 75 / 80 /
 * 100 / 200 (and wrap) rather than stopping at the current max.
 */
import { describe, it, expect } from 'vitest';
import { nextPresetAbove, prevPresetBelow, PRESETS, PRESET_INLINE_MAX } from '../repeat-loop-ui';

describe('nextPresetAbove', () => {
  it('walks the tail ladder 60 -> 70 -> 75 -> 80 -> 100 -> 200', () => {
    expect(nextPresetAbove(60)).toBe(70);
    expect(nextPresetAbove(70)).toBe(75);
    expect(nextPresetAbove(75)).toBe(80);
    expect(nextPresetAbove(80)).toBe(100);
    expect(nextPresetAbove(100)).toBe(200);
  });
  it('wraps past the max into the first tail preset', () => {
    const first = PRESETS.find(p => p > PRESET_INLINE_MAX)!;
    expect(nextPresetAbove(200)).toBe(first);
    expect(nextPresetAbove(999)).toBe(first);
  });
  it('handles arbitrary values between presets', () => {
    expect(nextPresetAbove(55)).toBe(60);
    expect(nextPresetAbove(72)).toBe(75);
  });
});

describe('prevPresetBelow', () => {
  it('walks the tail ladder downward 200 -> 100 -> 80 -> 75 -> 70 -> 60', () => {
    expect(prevPresetBelow(200)).toBe(100);
    expect(prevPresetBelow(100)).toBe(80);
    expect(prevPresetBelow(80)).toBe(75);
    expect(prevPresetBelow(75)).toBe(70);
    expect(prevPresetBelow(70)).toBe(60);
  });
  it('wraps under the smallest preset to the top of the ladder', () => {
    expect(prevPresetBelow(1)).toBe(PRESETS[PRESETS.length - 1]);
  });
});

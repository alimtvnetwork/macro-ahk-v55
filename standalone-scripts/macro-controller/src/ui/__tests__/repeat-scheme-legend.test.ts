/**
 * 2026-07-18: The repeat strip surfaces the interval scheme via a "Scheme ⓘ"
 * chip so users can see how 60+ values are handled. This test verifies the
 * chip renders the summary text, opens a popover with the ladder + wrap
 * rows, and closes cleanly on Escape.
 */
import { describe, it, expect } from 'vitest';
import { buildRepeatSchemeLegend, PRESETS, PRESET_INLINE_MAX } from '../repeat-loop-ui';

const tail = PRESETS.filter(p => p > PRESET_INLINE_MAX);
const tailLadder = tail.join('→');

describe('buildRepeatSchemeLegend', () => {
  it('renders a summary chip showing the tail ladder and wrap glyph', () => {
    const node = buildRepeatSchemeLegend();
    const summary = node.querySelector('[data-testid="repeat-scheme-summary"]');
    expect(summary).not.toBeNull();
    expect(summary!.textContent).toContain('≥' + PRESET_INLINE_MAX);
    expect(summary!.textContent).toContain(tailLadder);
    expect(summary!.textContent).toContain('↺');
  });

  it('starts with the popover hidden and aria-expanded=false', () => {
    const node = buildRepeatSchemeLegend();
    const pop = node.querySelector('[data-testid="repeat-scheme-popover"]') as HTMLElement;
    const summary = node.querySelector('[data-testid="repeat-scheme-summary"]') as HTMLElement;
    expect(pop.hidden).toBe(true);
    expect(summary.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the popover on click and lists ladder + wrap + clamp rows', () => {
    document.body.appendChild(buildRepeatSchemeLegend());
    const summary = document.querySelector('[data-testid="repeat-scheme-summary"]') as HTMLElement;
    summary.click();
    const pop = document.querySelector('[data-testid="repeat-scheme-popover"]') as HTMLElement;
    expect(pop.hidden).toBe(false);
    expect(summary.getAttribute('aria-expanded')).toBe('true');
    const ladder = document.querySelector('[data-testid="repeat-scheme-ladder-row"]')!;
    const wrap = document.querySelector('[data-testid="repeat-scheme-wrap-row"]')!;
    expect(ladder.textContent).toContain(tailLadder);
    expect(wrap.textContent).toContain(tail[0]!.toString());
    expect(wrap.textContent).toContain(tail[tail.length - 1]!.toString());
    expect(pop.textContent).toContain('[1, 1000]');
    document.body.innerHTML = '';
  });

  it('closes on Escape and re-opens on second click (toggle behavior)', () => {
    document.body.appendChild(buildRepeatSchemeLegend());
    const summary = document.querySelector('[data-testid="repeat-scheme-summary"]') as HTMLElement;
    summary.click();
    const pop = document.querySelector('[data-testid="repeat-scheme-popover"]') as HTMLElement;
    expect(pop.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(pop.hidden).toBe(true);
    summary.click();
    expect(pop.hidden).toBe(false);
    document.body.innerHTML = '';
  });
});

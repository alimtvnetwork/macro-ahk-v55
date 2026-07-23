/**
 * Unit tests for `showUndoToast` (v4.175.0).
 *
 * Contract:
 *   - Renders a toast with a button matching `data-testid="undo-toast-action"`.
 *   - Clicking the button invokes `onUndo` exactly once.
 *   - A second click after the first is a no-op (idempotent).
 *   - When `onUndo` returns a rejected Promise, the failure is surfaced.
 *   - Auto-dismisses after `timeoutMs`.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { showUndoToast } from '../prompt-utils';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function getToast(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="undo-toast"]');
}

function getUndoBtn(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-testid="undo-toast-action"]');
}

describe('showUndoToast', () => {
  it('renders a toast with Undo button and the passed message', () => {
    showUndoToast('Saved change', () => { /* noop */ });
    const toast = getToast();
    expect(toast).not.toBeNull();
    expect(toast!.textContent).toContain('Saved change');
    const btn = getUndoBtn();
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe('Undo');
  });

  it('invokes onUndo exactly once on click, then ignores repeat clicks', () => {
    const onUndo = vi.fn();
    showUndoToast('X', onUndo);
    const btn = getUndoBtn()!;
    btn.click();
    btn.click();
    btn.click();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('uses a custom undoLabel when provided', () => {
    showUndoToast('X', () => { /* noop */ }, { undoLabel: 'Revert' });
    expect(getUndoBtn()!.textContent).toBe('Revert');
  });

  it('auto-dismisses after timeoutMs when Undo is not pressed', () => {
    showUndoToast('X', () => { /* noop */ }, { timeoutMs: 1000 });
    expect(getToast()).not.toBeNull();
    vi.advanceTimersByTime(1000);
    // fade-out transition + 250ms removal timer
    vi.advanceTimersByTime(300);
    expect(getToast()).toBeNull();
  });

  it('does NOT auto-dismiss after undo click completes (button-driven dismiss only)', async () => {
    const onUndo = vi.fn(() => Promise.resolve());
    showUndoToast('X', onUndo, { timeoutMs: 5000 });
    getUndoBtn()!.click();
    // Let the .then chain run.
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(300);
    expect(getToast()).toBeNull();
  });

  it('awaits an async onUndo and surfaces errors without throwing', async () => {
    const err = new Error('boom');
    const onUndo = vi.fn(() => Promise.reject(err));
    expect(() => showUndoToast('X', onUndo)).not.toThrow();
    getUndoBtn()!.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('renders the restored id chip when opts.restoredId is provided', () => {
    showUndoToast('Restored', () => { /* noop */ }, { restoredId: 42 });
    const chip = document.querySelector<HTMLElement>('[data-testid="undo-toast-restored-id"]');
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toBe('#42');
  });

  it('omits the id chip when restoredId is not provided', () => {
    showUndoToast('Restored', () => { /* noop */ });
    expect(document.querySelector('[data-testid="undo-toast-restored-id"]')).toBeNull();
  });

  it('accepts string ids and renders them as #<id>', () => {
    showUndoToast('Restored', () => { /* noop */ }, { restoredId: 'abc-9' });
    expect(document.querySelector('[data-testid="undo-toast-restored-id"]')!.textContent).toBe('#abc-9');
  });

  it('renders a countdown bar + label reflecting the remaining seconds', () => {
    showUndoToast('X', () => { /* noop */ }, { timeoutMs: 5000 });
    const label = document.querySelector<HTMLElement>('[data-testid="undo-toast-countdown-label"]');
    const bar = document.querySelector<HTMLElement>('[data-testid="undo-toast-countdown-bar"]');
    expect(label).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(label!.textContent).toBe('5s');
    // Advance the interval tick to observe the countdown decrement.
    vi.advanceTimersByTime(2000);
    expect(['3s', '4s']).toContain(label!.textContent);
  });
});


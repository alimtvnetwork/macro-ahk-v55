/**
 * Step 6 — Tests: Macro Controller no-autorun guard.
 *
 * Verifies that `requireUserGesture()` returns false (and logs CODE RED) when no
 * gesture has been marked, returns true within the 30s TTL after a mark, and
 * expires after the TTL.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  markUserGesture,
  requireUserGesture,
  _resetUserGestureForTests,
  _peekUserGestureForTests,
} from '../user-gesture-guard';

describe('user-gesture-guard', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetUserGestureForTests();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  it('rejects with CODE RED when no gesture has ever been marked', () => {
    const ok = requireUserGesture('startLoop');
    expect(ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const msg = String(errorSpy.mock.calls[0][0]);
    expect(msg).toContain('[CODE RED]');
    expect(msg).toContain('startLoop rejected');
    expect(msg).toContain('user-gesture-guard.ts');
    expect(msg).toContain('Last gesture source: (never)');
    expect(msg).toContain('Reason:');
  });

  it('accepts immediately after markUserGesture()', () => {
    markUserGesture('panel-controls/start-stop-btn');
    expect(requireUserGesture('startLoop')).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(_peekUserGestureForTests().source).toBe('panel-controls/start-stop-btn');
  });

  it('accepts within the 30s TTL window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T10:00:00Z'));
    markUserGesture('keyboard-handlers/ctrl-alt-up');
    vi.setSystemTime(new Date('2026-05-25T10:00:29Z')); // 29s later
    expect(requireUserGesture('startLoop')).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('rejects with CODE RED after the 30s TTL expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T10:00:00Z'));
    markUserGesture('menu-builder/loop-up');
    vi.setSystemTime(new Date('2026-05-25T10:00:31Z')); // 31s later
    const ok = requireUserGesture('startLoop');
    expect(ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const msg = String(errorSpy.mock.calls[0][0]);
    expect(msg).toContain('[CODE RED]');
    expect(msg).toContain('Last gesture source: menu-builder/loop-up');
  });

  it('logs include the caller id passed to requireUserGesture', () => {
    requireUserGesture('LoopEngine.start');
    const msg = String(errorSpy.mock.calls[0][0]);
    expect(msg).toContain('LoopEngine.start rejected');
  });

  it('markUserGesture overwrites the previous source', () => {
    markUserGesture('first');
    markUserGesture('second');
    expect(_peekUserGestureForTests().source).toBe('second');
  });
});

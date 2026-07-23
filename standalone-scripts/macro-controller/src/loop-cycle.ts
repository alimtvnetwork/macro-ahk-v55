/**
 * Loop Cycle - Core API-based loop iteration logic.
 *
 * Plan-17 step 13: fallback fetch flow moved to `./loop-cycle-fallback` to
 * keep this file under the 500 LOC cap. This module now owns only the
 * cycle entry point (`runCycle`), preconditions, and delegate-timeout guard.
 *
 * @see spec/22-app-issues/free-credits-detect/overview.md
 * @see memory/architecture/networking/centralized-api-registry
 */

import { log } from './logger';
import { MacroController } from './core/MacroController';
import { isUserTypingInPrompt } from './dom-helpers';
import { TIMING, state } from './shared-state';
import { checkAndActOnCreditBalance, BALANCE_CONFIG } from './credit-balance';
import { logError } from './error-utils';
import { checkAutoResume } from './queue-control/auto-resume';
import { doCycleFetchFallback, releaseCycleLock, setRunCycleRef } from './loop-cycle-fallback';

// Re-export for backward compat (existing callers import doCycleFetchFallback
// from './loop-cycle' - keeping the surface avoids touching call sites).
export { doCycleFetchFallback } from './loop-cycle-fallback';

/** Shorthand for MacroController singleton */
function mc() { return MacroController.getInstance(); }

// ============================================
// handleDelegateTimeout - checks and recovers from stale delegation
// ============================================

function handleDelegateTimeout(): boolean {
  const elapsed = state.delegateStartTime ? (Date.now() - state.delegateStartTime) / 1000 : 0;
  const isTimedOut = elapsed > 60;

  if (!isTimedOut) {
    releaseCycleLock();
    log('SKIP: Waiting for API move (' + Math.floor(elapsed) + 's)', 'skip');

    return false;
  }

  log('Move timeout after ' + Math.floor(elapsed) + 's - auto-recovering', 'warn');
  state.isDelegating = false;
  state.forceDirection = null;
  state.delegateStartTime = 0;
  mc().updateUILight();

  return true;
}

// ============================================
// runCycle - API-based credit check
// ============================================

export function runCycle(): void {
  if (_checkLoopPreconditions()) return;

  state.__cycleInFlight = true;

  if (state.isDelegating && !handleDelegateTimeout()) {
    return;
  }

  state.cycleCount++;
  state.countdown = Math.floor(TIMING.LOOP_INTERVAL / 1000);
  log('--- Cycle #' + state.cycleCount + ' ---');

  if (isUserTypingInPrompt()) {
    releaseCycleLock();
    log('SKIP: User is typing in prompt area', 'skip');

    return;
  }

  _performCycleTasks();
}

function _checkLoopPreconditions(): boolean {
  if (!state.running) {
    state.__cycleInFlight = false;
    state.__cycleRetryPending = false;
    log('SKIP: Loop not running', 'skip');
    return true;
  }
  if (state.__cycleRetryPending) {
    log('SKIP: Retry already scheduled - waiting', 'skip');
    return true;
  }
  if (state.__cycleInFlight) {
    log('SKIP: Previous cycle still in flight', 'skip');
    return true;
  }
  return false;
}

function _performCycleTasks(): void {
  // Task Queue Management Logic
  import('./task-manager').then(m => {
    const manager = m.TaskQueueManager.getInstance();
    manager.startProcessing().catch(err => {
      logError('runCycle', 'TaskQueueManager failed', err);
    });
  });

  // Run auto-resume check to see if "Return" button is gone
  checkAutoResume();

  log('Step 1: Checking credit balance via API...', 'check');

  checkAndActOnCreditBalance()
    .then(function (apiSucceeded: boolean) {
      if (apiSucceeded) {
        log('Step 1: ✅ Credit balance API succeeded', 'success');
        mc().updateUI();
        releaseCycleLock();

        return;
      }

      if (!BALANCE_CONFIG.fallbackToXPath) {
        log('Step 1: Credit balance API failed and XPath fallback disabled - skipping', 'warn');
        releaseCycleLock();

        return;
      }

      log('Step 1: Credit balance API failed - falling back to full workspace API...', 'warn');
      doCycleFetchFallback();
    })
    .catch(function (err: Error) {
      logError('runCycle', 'Credit balance check error - falling back to workspace API', err);

      if (!BALANCE_CONFIG.fallbackToXPath) {
        releaseCycleLock();

        return;
      }

      doCycleFetchFallback();
    });
}

// Wire runCycle into the fallback module so the soft-cooldown retry inside
// `handleCycleFetchError` can invoke it without a static import cycle.
setRunCycleRef(runCycle);

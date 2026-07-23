/**
 * Loop cycle - fallback fetch flow.
 *
 * Split out from `loop-cycle.ts` (Plan-17 step 13) to keep both files under
 * the 500 LOC cap. Owns the /user/workspaces API fallback path invoked when
 * checkAndActOnCreditBalance() reports the credit-balance API failed.
 *
 * Responsibilities:
 *  - handleFallbackAuthRecovery : auth 401/403 recovery + single retry
 *  - processWorkspaceData       : parse + sync + double-confirm dispatch
 *  - handleCycleFetchError      : soft-cooldown retry ladder
 *  - doCycleFetchWithToken      : single SDK call with auth handling
 *  - doCycleFetchFallback       : public entry point (pre-flight recovery)
 *  - doubleConfirmAndMove       : low-credit re-check before triggering move
 *
 * Note: `runCycle` (in `./loop-cycle`) is called from `handleCycleFetchError`
 * for the soft-cooldown re-tick. Imported lazily via a setter to avoid a
 * static cycle (loop-cycle -> loop-cycle-fallback -> loop-cycle).
 */

import { log, logSub } from './logger';
import { showToast } from './toast';
import {
  resolveToken,
  getLastTokenSource,
  invalidateSessionBridgeKey,
  markBearerTokenExpired,
  recoverAuthOnce,
} from './auth';
import { parseLoopApiResponse, syncCreditStateFromApi, schedulePostParseEnrichment } from './credit-fetch';
import { MacroController } from './core/MacroController';
import { CREDIT_API_BASE, loopCreditState, state } from './shared-state';
import { autoDetectLoopCurrentWorkspace } from './workspace-detection';
import { performDirectMove } from './loop-dom-fallback';
import { runCycleDomFallback } from './loop-dom-fallback';
import { BALANCE_CONFIG } from './credit-balance';
import { delay } from './async-utils';
import { logError } from './error-utils';
import { throwDiagnostic } from './errors/diagnostic-error';

const LOG_SCOPE_LOOP_CYCLE = 'loop-cycle';

/** Shorthand for MacroController singleton */
function mc() { return MacroController.getInstance(); }

// Injected by loop-cycle.ts on module load to avoid a static import cycle.
let _runCycleRef: (() => void) | null = null;
export function setRunCycleRef(runCycle: () => void): void {
  _runCycleRef = runCycle;
}

function isAuthFailure(status: number): boolean {
  return status === 401 || status === 403;
}

function isLoopStale(): boolean {
  return !state.running || state.isDelegating;
}

function releaseCycleLock(): void {
  if (state.__cycleRetryPending) {
    return;
  }

  state.__cycleInFlight = false;
}

// ============================================
// Double-confirm fetch - verifies low credits before moving
// ============================================

async function doubleConfirmAndMove(threshold: number): Promise<void> {
  await delay(2000);

  if (isLoopStale()) {
    log('SKIP: State changed during double-confirm wait', 'skip');

    return;
  }

  if (!window.marco?.api?.credits?.fetchWorkspaces) {
    logError('Double-confirm API fetch failed', 'SdkNotReady: window.marco.api.credits.fetchWorkspaces unavailable');

    return;
  }
  const resp = await window.marco.api.credits.fetchWorkspaces({ baseUrl: CREDIT_API_BASE });

  if (!resp.ok) {
    logError('Double-confirm API fetch failed', 'HTTP ' + resp.status);

    return;
  }

  if (isLoopStale()) {
    log('SKIP: State changed during double-confirm fetch', 'skip');

    return;
  }

  const data = resp.data as Record<string, unknown>;
  parseLoopApiResponse(data);
  state.workspaceFromApi = false;

  const confirmToken = resolveToken();
  await autoDetectLoopCurrentWorkspace(confirmToken);
  syncCreditStateFromApi();
  mc().updateUI();

  const cws = loopCreditState.currentWs;
  const dailyFree = cws ? (cws.dailyFree || 0) : 0;

  if (dailyFree >= threshold) {
    log('DOUBLE-CONFIRM: Daily free credits found on re-check (' + dailyFree + ')! No move needed.', 'success');

    return;
  }

  log('CONFIRMED: Credits (' + dailyFree + ') below threshold (' + threshold + ') - moving ' + state.direction.toUpperCase(), 'delegate');
  logSub('Direction: ' + state.direction.toUpperCase() + ', Workspace: ' + (cws ? cws.fullName : 'unknown'), 1);
  performDirectMove(state.direction);
}

// ============================================
// handleFallbackAuthRecovery - auth failure recovery with retry
// ============================================

async function handleFallbackAuthRecovery(
  freshToken: string,
  status: number,
  fetchWithTokenFn: () => Promise<void>,
): Promise<void> {
  if (freshToken) {
    markBearerTokenExpired(LOG_SCOPE_LOOP_CYCLE);
    invalidateSessionBridgeKey(freshToken);
  }

  log('Cycle fallback: Auth ' + status + ' - recovering session...', 'warn');
  showToast('Auth ' + status + ' - recovering session...', 'warn', { noStop: true });

  state.__cycleRetryPending = true;

  await delay(2500);
  state.__cycleRetryPending = false;

  const newToken = await recoverAuthOnce();

  if (!newToken) {
    logError('Cycle fallback', 'Recovery failed - skipping this cycle');
    showToast('Auth recovery failed - will retry next cycle', 'warn', { noStop: true });
    releaseCycleLock();

    return;
  }

  log('Cycle fallback: Recovery successful - retrying API call once', 'success');
  await fetchWithTokenFn();
}

// ============================================
// processWorkspaceData - handles successful workspace API response
// ============================================

async function processWorkspaceData(
  data: Record<string, unknown>,
): Promise<void> {
  if (state.retryCount > 0) {
    log('Retry recovery: API succeeded after ' + state.retryCount + ' previous failure(s)', 'success');
    showToast('Recovered after ' + state.retryCount + ' retry(ies)', 'success');
  }

  state.retryCount = 0;
  state.lastRetryError = null;

  if (isLoopStale()) {
    log('SKIP: State changed during API fetch', 'skip');

    return;
  }

  const isParseOk = parseLoopApiResponse(data);

  if (!isParseOk) {
    logError('Cycle aborted', 'API response parse failed');

    return;
  }

  state.workspaceFromApi = false;

  const cycleToken = resolveToken();
  await autoDetectLoopCurrentWorkspace(cycleToken);

  if (isLoopStale()) {
    log('SKIP: State changed during workspace detection', 'skip');

    return;
  }

  syncCreditStateFromApi();
  mc().updateUI();
  // v3.40.2 overlay of pro_0 + pro_1 /credit-balance enrichments so the Free
  // Credit panel reflects per-workspace `dailyFree` updates DURING an active
  // loop, not just on manual fetches. Fire-and-forget; each enrichment
  // re-aggregates and re-renders the panel on completion. This matches the
  // chain used by the non-loop `processSuccessData` path in credit-fetch.ts.
  schedulePostParseEnrichment();

  const cws = loopCreditState.currentWs;
  const dailyFree = cws ? (cws.dailyFree || 0) : 0;
  const threshold = BALANCE_CONFIG.minDailyCredit;

  if (dailyFree >= threshold) {
    log('✅ Daily free credits (' + dailyFree + ') >= threshold (' + threshold + ') - NO move needed', 'success');

    return;
  }

  log('Step 3: Credits (' + dailyFree + ') below threshold (' + threshold + ') - double-confirming via API...', 'warn');
  await doubleConfirmAndMove(threshold);
}

// ============================================
// handleCycleFetchError - manages retry/backoff for cycle failures
// ============================================

function handleCycleFetchError(err: Error, freshToken: string): void {
  state.retryCount++;
  const hasRetriesLeft = state.retryCount <= state.maxRetries;

  if (hasRetriesLeft) {
    const backoff = state.retryBackoffMs * Math.pow(2, state.retryCount - 1);
    showToast('Cycle failed: ' + err.message + ' - retrying in ' + (backoff / 1000) + 's (attempt ' + state.retryCount + '/' + state.maxRetries + ')', 'warn');
    log('Cycle fallback API fetch failed (attempt ' + state.retryCount + '/' + state.maxRetries + '): ' + err.message + ' - retrying in ' + backoff + 'ms', 'warn');
    logSub('Token: ' + (freshToken ? freshToken.substring(0, 12) + '...REDACTED' : 'NONE'), 1);
    logSub('Token source: ' + getLastTokenSource(), 1);

    state.__cycleRetryPending = true;
    setTimeout(function () {
      state.__cycleRetryPending = false;
      state.__cycleInFlight = false;

      if (state.running) {
        log('Retry #' + state.retryCount + ' - re-running cycle...', 'check');
        if (_runCycleRef) {
          _runCycleRef();
        } else {
          logError('Cycle retry', 'runCycle ref not injected - loop-cycle module load order broken');
        }
      }
    }, backoff);

    return;
  }

  // Soft-cooldown policy (v3.40.2 - Issue: "loop turns off when tab regains focus")
  // Previously this branch called `stopLoop()` after `maxRetries` exhausted
  // transient cycle failures. That was the root cause of the loop appearing
  // OFF when the user returned to a backgrounded tab: Chrome throttles
  // timers / stalls fetches in hidden tabs, so 3 consecutive fetch failures
  // happen easily, and `stopLoop()` killed the runtime permanently.
  // Fix: reset counters, log non-fatal cooldown, let interval re-invoke
  // runCycle next tick. Honors mem://constraints/no-retry-policy.
  state.lastRetryError = err.message;
  showToast(
    'Cycle failed ' + state.maxRetries + 'x: ' + err.message
      + ' - loop kept ON, retrying next tick.',
    'warn',
    { stack: err.stack, noStop: true },
  );
  logError(
    'Cycle',
    'API fetch failed after ' + state.maxRetries
      + ' retries: ' + err.message
      + ' - loop kept ON, retry budget reset (lastTokenSource='
      + getLastTokenSource() + ')',
  );
  state.retryCount = 0;
  state.__cycleInFlight = false;
  state.__cycleRetryPending = false;
  runCycleDomFallback();
}

// ============================================
// doCycleFetchWithToken - single workspace API call via SDK
// ============================================

async function doCycleFetchWithToken(isRetryAttempt: boolean): Promise<void> {
  const freshToken = resolveToken();

  log('Cycle fallback API: GET /user/workspaces' + (isRetryAttempt ? ' (RETRY after recovery)' : ''), 'check');
  logSub('Auth: ' + (freshToken ? 'Bearer ' + freshToken.substring(0, 12) + '...REDACTED' : 'NO TOKEN (cookies only)'), 1);
  logSub('Token source: ' + getLastTokenSource(), 1);

  try {
    if (!window.marco?.api?.credits?.fetchWorkspaces) {
      throwDiagnostic('LOOP_FALLBACK_SDK_E001', { op: 'doCycleFetchWithToken' });
    }
    const resp = await window.marco.api.credits.fetchWorkspaces({ baseUrl: CREDIT_API_BASE });

    if (isAuthFailure(resp.status) && !isRetryAttempt) {
      await handleFallbackAuthRecovery(
        freshToken,
        resp.status,
        () => doCycleFetchWithToken(true),
      );

      return;
    }

    if (isAuthFailure(resp.status) && freshToken) {
      markBearerTokenExpired(LOG_SCOPE_LOOP_CYCLE);
    }

    if (!resp.ok) {
      throwDiagnostic('LOOP_FALLBACK_HTTP_E001', {
        status: resp.status,
        url: `${CREDIT_API_BASE}/user/workspaces`,
        op: 'doCycleFetchWithToken',
      });
    }

    const data = resp.data as Record<string, unknown>;
    log('Cycle fallback API: response received', 'check');
    await processWorkspaceData(data);
  } catch (err) {
    handleCycleFetchError(err as Error, freshToken);
  } finally {
    releaseCycleLock();
  }
}

// ============================================
// doCycleFetchFallback - entry point for /user/workspaces fallback
// ============================================

export async function doCycleFetchFallback(): Promise<void> {
  const token = resolveToken();

  if (!token) {
    log('Cycle fallback: No token - attempting recovery before API call...', 'warn');

    try {
      const recoveredToken = await recoverAuthOnce();

      if (recoveredToken) {
        log('Cycle fallback: Recovered token - proceeding with API call', 'success');
      } else {
        log('Cycle fallback: No token from any source - API call will likely fail with 401', 'warn');
      }
    } catch (err) {
      logError('Cycle fallback', 'Auth recovery failed before API call: ' + (err as Error).message);
      releaseCycleLock();

      return;
    }
  }

  await doCycleFetchWithToken(false);
}

export { releaseCycleLock };

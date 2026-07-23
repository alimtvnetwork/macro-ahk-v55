/**
 * prompt-health-auto-repair.ts — v4.178.0
 *
 * Root cause it closes: `runPromptHealthCheck` today detects unhealthy
 * defaults but the ONLY recovery path is a manual gear-menu click ("🔄
 * Re-seed defaults"). Every piece needed for self-healing already exists
 * (`reseedPromptsOnDemand` is idempotent and preserves user edits on
 * non-default slugs), they just were not wired together at boot.
 *
 * This module composes the three primitives:
 *   1. silent probe          — `runPromptHealthCheck({ silent: true })`
 *   2. idempotent recovery   — `reseedPromptsOnDemand()` (never force)
 *   3. verification probe    — `runPromptHealthCheck()` (loud on failure)
 *
 * We NEVER auto-invoke `{ force: true }` — that would destroy user edits
 * silently. If recovery still fails after the idempotent reseed, we let
 * the second (non-silent) health check surface the red toast so the user
 * is aware and can escalate manually.
 *
 * Error handling: every branch either returns or logs via `logError`.
 * No `try/catch` used to hide failure — the caller receives a full
 * `AutoRepairResult` with `finalReport` for observability, plus telemetry.
 */

import { runPromptHealthCheck, type PromptHealthReport } from './prompt-health-check';
import { reseedPromptsOnDemand } from './reseed-command';
import { logDiagnosticFromCode } from '../error-utils';
import { log } from '../logger';
import { showToast } from '../toast';
import { emitPromptSeedEvent } from '../telemetry/prompt-seed-telemetry';

export interface AutoRepairResult {
  /** Initial (pre-repair) health report. */
  initialReport: PromptHealthReport;
  /** Whether a reseed was attempted (i.e., initial report was unhealthy). */
  repairAttempted: boolean;
  /** Whether the reseed itself succeeded (independent of final health). */
  reseedOk: boolean;
  /** Reseed error message when reseedOk === false. */
  reseedError?: string;
  /** Health report AFTER repair. Same as initialReport when no repair ran. */
  finalReport: PromptHealthReport;
  /** True iff finalReport.ok === true. */
  isHealthy: boolean;
}

/**
 * Codes that a plain idempotent reseed can plausibly fix. All current codes
 * qualify: `reseedPromptsOnDemand` re-inserts missing rows, rewires the
 * IsDefault flag via seed, and (in force mode, which we do NOT use here)
 * would also fix body/token drift. We attempt idempotent recovery for ANY
 * unhealthy state — worst case the second probe re-reports the same issues
 * and the toast fires as it does today.
 */
function shouldAttemptRepair(report: PromptHealthReport): boolean {
  return report.ok === false && report.issues.length > 0;
}

function emitRepairStart(initial: PromptHealthReport): void {
  const codes = Array.from(new Set(initial.issues.map(i => i.code))).join(',');
  emitPromptSeedEvent({
    event: 'health.auto-repair.start', outcome: 'ok',
    detail: 'issues=' + initial.issues.length + ' codes=' + codes,
  });
}

function emitRepairRecovered(): void {
  emitPromptSeedEvent({
    event: 'health.auto-repair.recovered', outcome: 'ok',
    detail: 'idempotent reseed restored default rows',
  });
  log('[PromptHealthAutoRepair] recovered via idempotent reseed', 'success');
  showToast('🩹 Prompt defaults auto-repaired on boot.', 'success');
}

function emitRepairFailed(finalReport: PromptHealthReport, reseedError?: string): void {
  const detail = reseedError
    ? 'reseed threw: ' + reseedError
    : 'issues remain after reseed: ' + finalReport.issues.length;
  emitPromptSeedEvent({
    event: 'health.auto-repair.failed', outcome: 'failed', detail,
  });
  logDiagnosticFromCode('HEALTH_AUTO_REPAIR_E001', {
    stage: reseedError ? 'reseed' : 'verify',
    reason: detail,
  });
}

/**
 * Run the health check and, if unhealthy, attempt a single idempotent
 * reseed followed by a verification probe. Never throws. Never invokes
 * force-mode reseed. Safe to call at boot in place of `runPromptHealthCheck`.
 */
export async function runPromptHealthCheckWithAutoRepair(): Promise<AutoRepairResult> {
  const initialReport = await runPromptHealthCheck({ silent: true });
  if (!shouldAttemptRepair(initialReport)) {
    return {
      initialReport,
      repairAttempted: false,
      reseedOk: true,
      finalReport: initialReport,
      isHealthy: initialReport.ok,
    };
  }
  emitRepairStart(initialReport);
  const reseed = await reseedPromptsOnDemand();
  // Second probe is intentionally LOUD (silent=false): if issues remain,
  // the user must see the red banner. When healthy, publishReport
  // short-circuits before the toast, so a healthy state stays quiet.
  const finalReport = await runPromptHealthCheck({ silent: false });
  const isHealthy = finalReport.ok;
  if (isHealthy) emitRepairRecovered();
  else emitRepairFailed(finalReport, reseed.error);
  const result: AutoRepairResult = {
    initialReport,
    repairAttempted: true,
    reseedOk: reseed.ok,
    finalReport,
    isHealthy,
  };
  if (reseed.error) result.reseedError = reseed.error;
  return result;
}

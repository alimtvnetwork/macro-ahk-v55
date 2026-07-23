/**
 * Plan 22 · gap #7 — toast rendering pipeline for structured failure payloads.
 *
 * Single sink that turns a `DiagnosticError` into a rendered toast: it logs
 * through `reportDiagnostic` (so the diagnostics sink always sees the failure)
 * and forwards the composed `title + body + footerCode` string, plus a level
 * derived from severity, to `showToast`. Call sites should prefer this helper
 * over calling `showToast(formatDiagnosticToast(err).body, ...)` directly so
 * the mapping stays in one place and cannot regress silently.
 */
import { showToast, type ToastOpts } from '../toast';
import { reportDiagnostic } from '../error-utils';
import { emitDiagnosticToastEvent } from '../telemetry/diagnostic-toast-telemetry';
import type { DiagnosticError } from './diagnostic-error';
import type { ErrorSeverity } from './error-codes';
import type { DiagnosticToast } from './format';

export type ToastLevel = 'error' | 'warn' | 'info';

/**
 * Map the registry severity to the toast level surface. `fatal` and `error`
 * collapse to `error` (persistent, red); `warn` and `info` map 1:1.
 */
export function severityToToastLevel(severity: ErrorSeverity): ToastLevel {
  if (severity === 'fatal' || severity === 'error') return 'error';
  if (severity === 'warn') return 'warn';
  return 'info';
}

/**
 * Compose the multi-line toast string surfaced to the user. Kept separate so
 * tests can assert the exact wire format without spying on `showToast`.
 */
export function composeToastMessage(toast: DiagnosticToast): string {
  return toast.title + '\n' + toast.body + '\n' + toast.footerCode;
}

export interface ShowDiagnosticToastResult {
  readonly level: ToastLevel;
  readonly message: string;
  readonly toast: DiagnosticToast;
  /**
   * End-to-end correlation id emitted with the telemetry event. Copied
   * from `opts.requestDetail.correlationId` when provided by the caller
   * so it matches the originating request context; otherwise a fresh id
   * is generated so every toast is still traceable.
   */
  readonly correlationId: string;
}

/**
 * Log + render a diagnostic as a toast. Returns the composed payload so
 * callers can assert or attach extra UI (e.g. history modal open) without
 * a second format pass.
 *
 * `opts` (plan 22, gap #7 follow-up) is forwarded verbatim to `showToast` so
 * call sites that need `{ noStop: true, requestDetail: {...} }` can migrate
 * from raw `showToast` without losing the persistent-toast + HTTP-detail
 * surface (e.g. rename-api's NO_BEARER, HTTP-error, 401-recovery paths).
 *
 * When `opts.requestDetail.correlationId` is set (e.g. the HTTP client
 * already tagged the request), it is propagated verbatim into the
 * telemetry event so support engineers can join the toast against the
 * originating request logs. When absent, a fresh id is generated and
 * stamped back onto the returned result for callers that want to log it.
 */
export function showDiagnosticToast(
  err: DiagnosticError,
  opts?: ToastOpts,
): ShowDiagnosticToastResult {
  const { toast } = reportDiagnostic(err);
  const level = severityToToastLevel(toast.severity);
  const message = composeToastMessage(toast);
  showToast(message, level, opts);
  const evt = emitDiagnosticToastEvent({
    code: err.code,
    severity: toast.severity,
    level: level,
    title: toast.title,
    opts: opts,
  });
  return {
    level: level,
    message: message,
    toast: toast,
    correlationId: evt.correlationId,
  };
}



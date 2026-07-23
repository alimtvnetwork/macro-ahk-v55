/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../../types/riseup-namespace.d.ts" />
/// <reference path="./globals.d.ts" />
/* eslint-enable @typescript-eslint/triple-slash-reference */

/**
 * MacroController, Error & Logging Utilities
 *
 * Centralizes error message extraction and structured logging wrappers.
 * Each helper delegates to `window.RiseupAsiaMacroExt.Logger` when the SDK
 * namespace is present and shape-valid at runtime, falling back to direct
 * console output with the same prefix.
 *
 * Global type declarations used:
 *   - `RiseupAsiaMacroExtNamespace` (interface): shape of the SDK root
 *   - `RiseupAsiaMacroExt` (const): bare global, may be undefined
 *   - `Window.RiseupAsiaMacroExt` (optional): window-scoped alias
 *   - `RiseupAsiaLogArg` (type): structured logger argument union
 *   - `CaughtError` (type alias for unknown): try/catch leaf
 *
 * All are declared globally in:
 *   standalone-scripts/types/riseup-namespace.d.ts        (canonical source)
 *   standalone-scripts/macro-controller/src/globals.d.ts  (Window augmentation)
 *
 * The triple-slash references above guarantee these declarations are visible
 * to this file regardless of which tsconfig include set compiles it, so
 * TS2304 ("cannot find name") and TS2339 ("property does not exist on Window")
 * cannot regress.
 */

/** Alias for the structured logger surface we call. */
type SdkLogger = NonNullable<RiseupAsiaMacroExtNamespace['Logger']>;

/**
 * Extract a human-readable message from any caught value.
 * Handles Error instances, strings, and arbitrary objects.
 */
export function toErrorMessage(e: CaughtError): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e !== null && e !== undefined) return String(e);
  return 'Unknown error';
}

/**
 * Safely read the SDK namespace from `window.RiseupAsiaMacroExt`.
 * Returns undefined when the SDK has not been bootstrapped yet.
 */
function readSdkNamespace(): RiseupAsiaMacroExtNamespace | undefined {
  try {
    if (typeof window === 'undefined') return undefined;
    return window.RiseupAsiaMacroExt;
  } catch {
    return undefined;
  }
}

/** True when `value` is a non-null object. */
function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** True when `value` is callable. */
function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * Runtime shape guard for the logger surface we invoke.
 *
 * === Logger method contract (pinned by `log-diagnostic-logger-shapes.test.ts`) ===
 *
 * `logDiagnostic` / `logDiagnosticFromCode` accept `window.RiseupAsiaMacroExt.Logger`
 * ONLY when it is a non-null object that exposes BOTH of these callable methods:
 *
 *   REQUIRED (checked here, both must be `typeof === 'function'`):
 *     - `error(scope: string, message: string, error?: unknown): void`
 *         Human-readable line. Receives the DiagnosticError as the 3rd arg so
 *         the SDK can attach a stack.
 *     - `console(scope: string, tag: string, payload: RiseupAsiaLogArg): void`
 *         Structured record. Called with `tag = 'diagnostic-report'` and the
 *         masked `DiagnosticReport` as `payload`. This is what the diagnostics
 *         ZIP exporter indexes by `code`.
 *
 *   OPTIONAL (probed per call site with `hasLoggerMethod`, may be absent):
 *     - `warn(scope, message)`         used by `logWarn`
 *     - `debug(scope, message)`        used by `logDebug`
 *     - `stackTrace(scope, message, error?)`  used by `logStackTrace`
 *     - `info(scope, message)`         reserved, not called by this module
 *
 * REJECTED shapes (fall back to `console.error` + `console.log`, never silently
 * swallowed): `null`, `undefined`, non-objects, arrays, plain `{}`, any logger
 * missing `error` OR `console`, and any logger where either required method is
 * not `typeof === 'function'`. Extra unknown methods (forward-compat additions
 * like `metric`, `trace`) are accepted and ignored.
 */
function isSdkLogger(value: unknown): value is SdkLogger {
  if (!isObjectRecord(value)) return false;
  return isFunction(value.error) && isFunction(value.console);
}

/** Resolve the SDK logger, or undefined if the namespace is not ready. */
function getLogger(): SdkLogger | undefined {
  const ns = readSdkNamespace();
  if (!ns) return undefined;
  return isSdkLogger(ns.Logger) ? ns.Logger : undefined;
}

/** Build the standard log prefix. */
function prefix(scope: string): string {
  return '[RiseupAsia] [' + scope + '] ';
}

/** Structured error logging, delegates to RiseupAsiaMacroExt.Logger.error(). */
export function logError(scope: string, message: string, error?: CaughtError): void {
  const logger = getLogger();
  if (logger) { logger.error(scope, message, error); return; }
  const base = prefix(scope) + message;
  // eslint-disable-next-line no-restricted-syntax -- fallback when RiseupAsiaMacroExt.Logger is not yet registered
  if (error !== undefined) { console.error(base, error); } else { console.error(base); }

}

/** Type guard for a method on the logger object without double-casting. */
function hasLoggerMethod(logger: object, name: string): boolean {
  return isFunction((logger as Record<string, unknown>)[name]);
}

/** Structured debug logging, delegates to RiseupAsiaMacroExt.Logger.debug(). */
export function logDebug(scope: string, message: string): void {
  const logger = getLogger();
  if (logger && hasLoggerMethod(logger, 'debug')) {
    logger.debug(scope, message); return;
  }
  console.debug(prefix(scope) + message);
}

/** Structured warn logging, delegates to RiseupAsiaMacroExt.Logger.warn(). */
export function logWarn(scope: string, message: string): void {
  const logger = getLogger();
  if (logger && hasLoggerMethod(logger, 'warn')) {
    logger.warn(scope, message); return;
  }
  console.warn(prefix(scope) + message);
}

/** General structured console output, delegates to RiseupAsiaMacroExt.Logger.console(). */
export function logConsole(scope: string, message: string, ...args: RiseupAsiaLogArg[]): void {
  const logger = getLogger();
  if (logger) { logger.console(scope, message, ...args); return; }
  const base = prefix(scope) + message;
  if (args.length > 0) { console.log(base, ...args); } else { console.log(base); }
}

/** Stack trace logging, delegates to RiseupAsiaMacroExt.Logger.stackTrace(). */
export function logStackTrace(scope: string, message: string, error?: CaughtError): void {
  const logger = getLogger();
  if (logger && hasLoggerMethod(logger, 'stackTrace')) {
    logger.stackTrace(scope, message, error); return;
  }
  const base = prefix(scope) + message;
  const stack = (error instanceof Error && error.stack) ? error.stack : new Error().stack || '';
  // eslint-disable-next-line no-restricted-syntax -- fallback when RiseupAsiaMacroExt.Logger is not yet registered
  console.error(base + '\n' + stack);

}


/* ============================================================================
 * Plan 26, step 6: Diagnostic logging overload
 *
 * Route every `DiagnosticError` through a single sink so the diagnostics ZIP
 * exporter (step 18) can index by `code`. We deliberately emit TWO calls to
 * the SDK logger:
 *   1. `logger.error(scope, message, error)` — carries stack + message for
 *      humans reading logs.
 *   2. `logger.console(scope, 'diagnostic-report', report)` — carries the
 *      masked JSON report as a structured record. `RiseupAsiaLogArg` accepts
 *      nested string/number/boolean/null objects, which matches the
 *      `DiagnosticReport` shape after masking.
 *
 * If the SDK logger is not yet ready, we fall through to `console.error` +
 * `console.log` with the same payloads so nothing is ever silently swallowed
 * (violates the no-silent-failure rule in the coding guidelines).
 * ========================================================================== */
import {
  DiagnosticError,
  DiagnosticMetaError,
  isDiagnosticError,
  throwDiagnostic,
  toDiagnosticId,
  type DiagnosticContext,
  type DiagnosticContextValue,
  type DiagnosticReport,
} from './errors/diagnostic-error';

import {
  formatDiagnosticToast,
  formatDiagnosticToastPlain,
  type DiagnosticToast,
} from './errors/format';
import { ERROR_CODES, getErrorCodeEntry, type ErrorCodeEntry } from './errors/error-codes';

/**
 * Plan 26, step 7: Re-export the diagnostic surface from this module so every
 * legacy caller of `error-utils` gets `DiagnosticError` + `throwDiagnostic` +
 * `formatDiagnosticToast` from a single import path, and can migrate away
 * from bare `new Error(...)` without hunting for the new module.
 *
 * Legacy `logError/logWarn/logDebug/logConsole/logStackTrace` remain exported
 * above for back-compat with in-flight call sites; new code MUST prefer
 * `throwDiagnostic` (fail path) or `logDiagnostic` (log-only path).
 */
export {
  DiagnosticError,
  DiagnosticMetaError,
  isDiagnosticError,
  throwDiagnostic,
  toDiagnosticId,
  formatDiagnosticToast,
  formatDiagnosticToastPlain,
  ERROR_CODES,
  getErrorCodeEntry,
};
export type { DiagnosticContext, DiagnosticContextValue, DiagnosticReport, DiagnosticToast, ErrorCodeEntry };


/** Convert a DiagnosticReport into a RiseupAsiaLogArg-compatible plain object. */
function reportToLogArg(report: DiagnosticReport): RiseupAsiaLogArg {
  const out: Record<string, RiseupAsiaLogArg> = {
    code: report.code,
    area: report.area,
    action: report.action,
    severity: report.severity,
    message: report.message,
    timestamp: report.timestamp,
    context: JSON.parse(JSON.stringify(report.context)) as RiseupAsiaLogArg,
  };
  if (report.cause) {
    out.cause = report.cause.stack
      ? { name: report.cause.name, message: report.cause.message, stack: report.cause.stack }
      : { name: report.cause.name, message: report.cause.message };
  }
  return out;
}

/**
 * Log a DiagnosticError through the SDK logger, emitting both a human
 * `error` line and a structured `console` record indexable by error code.
 * Returns the serialized report so callers can attach it to toasts/UI.
 */
export function logDiagnostic(err: DiagnosticError): DiagnosticReport {
  const report = err.toReport();
  const scope = report.area;
  const logger = getLogger();
  if (logger) {
    logger.error(scope, '[' + report.code + '] ' + report.message, err);
    logger.console(scope, 'diagnostic-report', reportToLogArg(report));
    return report;
  }
  const base = prefix(scope) + '[' + report.code + '] ' + report.message;
  // eslint-disable-next-line no-restricted-syntax -- fallback when RiseupAsiaMacroExt.Logger is not yet registered
  console.error(base, err);

  console.log(prefix(scope) + 'diagnostic-report', report);
  return report;
}

/**
 * Convenience overload: construct + log a DiagnosticError in one call. Throws
 * `DiagnosticMetaError` synchronously if `code` is unknown or `context` is
 * incomplete, matching `DiagnosticError`'s constructor contract.
 *
 * Logger contract: routes through `window.RiseupAsiaMacroExt.Logger` when it
 * exposes callable `error(scope, message, error?)` AND `console(scope, tag,
 * payload)` methods (see `isSdkLogger` above for the full accepted/rejected
 * matrix). Any other shape, including a stub missing either required method,
 * falls back to `console.error` + `console.log` so the diagnostic is never
 * silently swallowed.
 */
export function logDiagnosticFromCode(
  code: string,
  context: DiagnosticContext,
  cause?: unknown,
): DiagnosticReport {
  const err = new DiagnosticError(code, context, cause);
  return logDiagnostic(err);
}

/**
 * Step 7 helper: single entry point that logs a DiagnosticError AND returns a
 * ready-to-render toast payload. UI callers should prefer this over calling
 * `formatDiagnosticToast` directly so nothing bypasses the diagnostics sink.
 */
export function reportDiagnostic(err: DiagnosticError): { report: DiagnosticReport; toast: DiagnosticToast } {
  const report = logDiagnostic(err);
  const toast = formatDiagnosticToast(err);
  return { report, toast };
}

/**
 * Step 7 back-compat bridge: wrap a caught legacy value into a DiagnosticError
 * under a caller-provided code. Preserves the original as `cause` so stack
 * traces survive migration. Callers MUST pass a registered code, incomplete
 * context still triggers `DiagnosticMetaError` from the constructor.
 */
export function wrapCaught(
  code: string,
  context: DiagnosticContext,
  caught: CaughtError,
): DiagnosticError {
  if (isDiagnosticError(caught)) return caught;
  return new DiagnosticError(code, context, caught);
}


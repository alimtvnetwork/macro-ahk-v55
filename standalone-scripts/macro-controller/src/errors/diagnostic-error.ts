/**
 * DiagnosticError: the single Error subclass every migrated call site throws.
 *
 * Plan 26 / step 3. Wraps a frozen `code` from `ERROR_CODES` with a fully
 * captured `context` object. Enforces two invariants at throw time so bugs
 * surface immediately, not deep inside a toast:
 *
 *   I1. `code` MUST exist in the registry.
 *   I2. Every key listed in the registry's `requiredContextKeys`, AND every
 *       `{placeholder}` in `humanTemplate`, MUST be present (non-undefined)
 *       on the supplied `context`.
 *
 * If either invariant fails we throw a meta-diagnostic (`DIAGNOSTIC_META_E001`)
 * synchronously; that gives the developer a loud, greppable failure instead
 * of a silently malformed toast.
 *
 * The class is intentionally serializable: `toReport()` returns a plain JSON
 * object suitable for the diagnostics ZIP (step 18) and for structured
 * logging via `Logger.error(code, context, cause?)` (step 6).
 *
 * Sensitive keys (bearer tokens, passwords, cookies, raw SQL) are masked
 * before serialization to honor the verbose-logging rules.
 */

import {
  ERROR_CODES,
  extractTemplatePlaceholders,
  getErrorCodeEntry,
  type ErrorCodeEntry,
  type ErrorSeverity,
} from './error-codes';

/** Value shape accepted in a diagnostic context. Kept narrow on purpose. */
export type DiagnosticContextValue =
  | string
  | number
  | boolean
  | null
  | readonly (string | number | boolean | null)[]
  | Readonly<Record<string, string | number | boolean | null>>;

export type DiagnosticContext = Readonly<Record<string, DiagnosticContextValue>>;

/**
 * Coerce any optional identifier-shaped value (typically `string | number |
 * null | undefined`) into a valid `DiagnosticContextValue`.
 *
 * Rules:
 *   - `undefined` becomes the sentinel `'(unset)'` so missing IDs are visible.
 *   - `null` is preserved (null is a valid DiagnosticContextValue).
 *   - strings/numbers/booleans pass through unchanged.
 *   - anything else is stringified via `String(v)`.
 *
 * Prefer this over ad-hoc `x ?? ''` coercions at call sites so that
 * "unset" is distinguishable from "empty string" in the diagnostic ZIP.
 */
export function toDiagnosticId(
  value: string | number | boolean | null | undefined,
  fallback: string = '(unset)',
): DiagnosticContextValue {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return String(value);
}


/** JSON report shape emitted by `toReport()`. */
export interface DiagnosticReport {
  readonly code: string;
  readonly area: string;
  readonly action: string;
  readonly severity: ErrorSeverity;
  readonly message: string;
  readonly context: Record<string, DiagnosticContextValue>;
  readonly cause?: { readonly name: string; readonly message: string; readonly stack?: string };
  readonly timestamp: string;
}

const SENSITIVE_KEY_PATTERN = /(token|password|cookie|secret|authorization|bearer|apikey|api_key|rawSql|sqlText)/i;
const MASK = '[REDACTED]';

/** Meta-error thrown when a caller violates I1 or I2. */
export class DiagnosticMetaError extends Error {
  public readonly code = 'DIAGNOSTIC_META_E001';
  constructor(reason: string) {
    super(`[DIAGNOSTIC_META_E001] ${reason}`);
    this.name = 'DiagnosticMetaError';
  }
}

/**
 * DiagnosticError — throw this everywhere in the macro-controller after the
 * per-area migrations in steps 8..13 land. Legacy `throw new Error('...')`
 * sites will be rejected by the ESLint rule added in step 15.
 */
export class DiagnosticError extends Error {
  public readonly code: string;
  public readonly area: string;
  public readonly action: string;
  public readonly severity: ErrorSeverity;
  public readonly context: DiagnosticContext;
  public readonly entry: ErrorCodeEntry;
  public readonly timestamp: string;
  public readonly cause?: unknown;

  constructor(code: string, context: DiagnosticContext, cause?: unknown) {
    const entry = getErrorCodeEntry(code);
    if (!entry) {
      throw new DiagnosticMetaError(
        `Unknown error code "${code}". Add it to ERROR_CODES before throwing.`,
      );
    }
    assertRequiredKeys(entry, context);
    const message = formatTemplate(entry.humanTemplate, context);
    super(`[${code}] ${message}`);
    this.name = 'DiagnosticError';
    this.code = code;
    this.area = entry.area;
    this.action = entry.action;
    this.severity = entry.severity;
    this.entry = entry;
    this.context = context;
    this.timestamp = new Date().toISOString();
    if (cause !== undefined) {
      this.cause = cause;
    }
  }

  /** Structured, sensitive-key-masked JSON report. */
  toReport(): DiagnosticReport {
    const maskedContext: Record<string, DiagnosticContextValue> = {};
    for (const [k, v] of Object.entries(this.context)) {
      maskedContext[k] = SENSITIVE_KEY_PATTERN.test(k) ? MASK : v;
    }
    const causeInfo = extractCauseInfo(this.cause);
    const report: DiagnosticReport = causeInfo
      ? {
          code: this.code,
          area: this.area,
          action: this.action,
          severity: this.severity,
          message: this.message,
          context: maskedContext,
          cause: causeInfo,
          timestamp: this.timestamp,
        }
      : {
          code: this.code,
          area: this.area,
          action: this.action,
          severity: this.severity,
          message: this.message,
          context: maskedContext,
          timestamp: this.timestamp,
        };
    return report;
  }
}

/**
 * Verify the registry entry and the caller's context agree, throwing a
 * DiagnosticMetaError with a precise reason otherwise.
 */
function assertRequiredKeys(entry: ErrorCodeEntry, context: DiagnosticContext): void {
  const missingRequired: string[] = [];
  for (const key of entry.requiredContextKeys) {
    if (!Object.prototype.hasOwnProperty.call(context, key) || context[key] === undefined) {
      missingRequired.push(key);
    }
  }
  if (missingRequired.length > 0) {
    throw new DiagnosticMetaError(
      `Error code "${entry.code}" is missing required context keys: ${missingRequired.join(', ')}.`,
    );
  }
  const placeholders = extractTemplatePlaceholders(entry.humanTemplate);
  const missingPlaceholders: string[] = [];
  for (const name of placeholders) {
    if (!Object.prototype.hasOwnProperty.call(context, name) || context[name] === undefined) {
      missingPlaceholders.push(name);
    }
  }
  if (missingPlaceholders.length > 0) {
    throw new DiagnosticMetaError(
      `Error code "${entry.code}" template references placeholders not supplied in context: ${missingPlaceholders.join(', ')}.`,
    );
  }
}

/** Interpolate `{name}` placeholders, leaving `{{n}}` alone. */
function formatTemplate(template: string, context: DiagnosticContext): string {
  return template.replace(/(^|[^{])\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_full, prefix: string, name: string) => {
    const value = context[name];
    return `${prefix}${stringifyValue(value)}`;
  });
}

function stringifyValue(v: DiagnosticContextValue | undefined): string {
  if (v === undefined || v === null) return String(v);
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return '[unserializable]';
  }
}

function extractCauseInfo(cause: unknown): DiagnosticReport['cause'] | undefined {
  if (cause instanceof Error) {
    return cause.stack
      ? { name: cause.name, message: cause.message, stack: cause.stack }
      : { name: cause.name, message: cause.message };
  }
  if (typeof cause === 'string') return { name: 'string', message: cause };
  return undefined;
}

/** Type guard for callers that want to branch on diagnostic vs plain errors. */
export function isDiagnosticError(e: unknown): e is DiagnosticError {
  return e instanceof DiagnosticError;
}

/** Registry-aware helper — throws the meta error if `code` is unknown. */
export function throwDiagnostic(code: string, context: DiagnosticContext, cause?: unknown): never {
  // Explicit reference so tree-shakers keep the registry alongside this module.
  if (!(code in ERROR_CODES)) {
    throw new DiagnosticMetaError(`Unknown error code "${code}".`);
  }
  throw new DiagnosticError(code, context, cause);
}

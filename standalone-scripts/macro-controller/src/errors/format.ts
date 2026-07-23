/**
 * formatDiagnosticToast: turn a `DiagnosticError` (or a registry `code` +
 * `context` pair) into a structured toast payload `{ title, body, footerCode }`.
 *
 * Plan 26 / step 4. The single place where user-facing error copy is
 * assembled. Every migrated call site in steps 7-12 renders diagnostic
 * toasts through this helper so wording, structure, and the trailing
 * `code=...` footer stay consistent.
 *
 * Wording contract (enforced by `assertProfessionalWording`, exercised by
 * `errors/__tests__/format.test.ts`):
 *  W1. No bare "Failed" without an object; must state what failed.
 *  W2. No profanity, no "oops", no "sorry", no exclamation storms.
 *  W3. Body MUST contain: (a) what was attempted, (b) why it was rejected,
 *      (c) the exact next fix the user can take.
 *  W4. Footer is always `code=<CODE>` so users can copy-paste it into an
 *      issue report and CI logs can be grepped.
 *
 * The helper is pure and synchronous. It does NOT display the toast; it
 * only produces the payload. UI callers pass the returned `body` to the
 * existing toast surface with `white-space: pre-line` so the newlines
 * render as separate lines.
 */

import {
  DiagnosticError,
  isDiagnosticError,
  type DiagnosticContext,
} from './diagnostic-error';
import { getErrorCodeEntry, type ErrorSeverity } from './error-codes';

export interface DiagnosticToast {
  readonly title: string;
  readonly body: string;
  readonly footerCode: string;
  readonly severity: ErrorSeverity;
  /** Suggested toast lifetime in ms (fatal/error persist longer). */
  readonly durationMs: number;
}

/** Words banned from user-facing toast copy. */
const FORBIDDEN_WORDS = [
  'oops', 'sorry', 'shit', 'fuck', 'damn', 'stupid', 'ugh', 'whoops',
];

/**
 * Public entry: accepts either a live `DiagnosticError` (preferred at throw
 * sites) or a `(code, context)` pair (for programmatic previews and tests).
 */
export function formatDiagnosticToast(
  input: DiagnosticError | string,
  context?: DiagnosticContext,
): DiagnosticToast {
  const err = isDiagnosticError(input)
    ? input
    : new DiagnosticError(input, context ?? ({} as DiagnosticContext));

  const entry = err.entry;
  const title = buildTitle(entry.area, entry.action, entry.severity);
  const attempted = buildAttemptedLine(err);
  const rejected = buildRejectedLine(err);
  const nextFix = buildNextFixLine(err);
  const body = [attempted, rejected, nextFix].filter(function(s) { return s.length > 0; }).join('\n');
  const footerCode = 'code=' + err.code;
  const payload: DiagnosticToast = {
    title: title,
    body: body,
    footerCode: footerCode,
    severity: entry.severity,
    durationMs: entry.severity === 'warn' ? 8000 : entry.severity === 'info' ? 5000 : 15000,
  };

  assertProfessionalWording(payload);
  return payload;
}

/** Convenience: single string suitable for a legacy one-line toast surface. */
export function formatDiagnosticToastPlain(
  input: DiagnosticError | string,
  context?: DiagnosticContext,
): string {
  const t = formatDiagnosticToast(input, context);
  return t.title + '\n' + t.body + '\n' + t.footerCode;
}

// ────────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────────

function buildTitle(area: string, action: string, severity: ErrorSeverity): string {
  const icon = severity === 'fatal' ? '⛔' : severity === 'error' ? '❌' : severity === 'warn' ? '⚠️' : 'ℹ️';
  const human = humanizeArea(area) + ' — ' + humanizeAction(action);
  return icon + ' ' + human;
}

function humanizeArea(area: string): string {
  switch (area) {
    case 'PROMPT': return 'Prompt';
    case 'PROMPT_IO': return 'Prompt I/O';
    case 'SEED': return 'Prompt seeding';
    case 'HEALTH': return 'Prompt health';
    case 'REPAIR': return 'Prompt repair';
    case 'HISTORY': return 'Prompt history';
    case 'DB': return 'Database';
    case 'HTTP': return 'Network request';
    case 'SDK': return 'Marco SDK';
    case 'WS_MEMBERS': return 'Workspace members';
    case 'WS_MOVE': return 'Workspace move';
    case 'WS_CONTEXT': return 'Workspace context';
    case 'REMIX': return 'Remix';
    case 'RENAME': return 'Rename';
    case 'GITSYNC': return 'GitHub sync';
    case 'CREDIT': return 'Credits';
    case 'PROZERO': return 'Pro credit';
    case 'SETTINGS': return 'Settings';
    case 'SPLITTER': return 'Splitter';
    case 'TELEMETRY': return 'Telemetry';
    case 'UI': return 'UI';
    default: return area;
  }
}

function humanizeAction(action: string): string {
  // "VALIDATE" -> "Validate", "NOT_READY" -> "Not ready"
  return action
    .toLowerCase()
    .split('_')
    .map(function(w, i) {
      if (i === 0 && w.length > 0) return w.charAt(0).toUpperCase() + w.slice(1);
      return w;
    })
    .join(' ');
}

function buildAttemptedLine(err: DiagnosticError): string {
  // The DiagnosticError.message is already "[CODE] <template-with-vars>".
  // Strip the "[CODE] " prefix — we surface the code separately in the footer.
  const raw = err.message;
  const stripped = raw.startsWith('[' + err.code + '] ')
    ? raw.slice(('[' + err.code + '] ').length)
    : raw;
  return 'What happened: ' + stripped;
}

function buildRejectedLine(err: DiagnosticError): string {
  // Compact diagnostic context on one line. Skip verbose/repeat fields the
  // human sentence already surfaced (role/slug/status/url).
  const skip = new Set(['role', 'slug', 'status', 'url']);
  const parts: string[] = [];
  for (const [k, v] of Object.entries(err.context)) {
    if (skip.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === 'object') continue; // keep the toast one-line-per-key
    parts.push(k + '=' + String(v));
  }
  if (parts.length === 0) return '';
  return 'Details: ' + parts.join(', ');
}

function buildNextFixLine(err: DiagnosticError): string {
  const hint = err.entry.nextFixHint;
  if (!hint) return '';
  // The hint can itself reference {placeholders}. Interpolate the same way
  // DiagnosticError does for its message.
  const interpolated = hint.replace(/(^|[^{])\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    function(_full, prefix, name) {
      const value = err.context[name as keyof typeof err.context];
      return prefix + (value === undefined || value === null ? String(value) : String(value));
    });
  return 'Next: ' + interpolated;
}

/**
 * Fail loudly if a toast payload violates the wording contract. Runs on every
 * `formatDiagnosticToast` call so a regression can never reach the UI.
 */
function assertProfessionalWording(payload: DiagnosticToast): void {
  const haystack = (payload.title + '\n' + payload.body).toLowerCase();
  for (const w of FORBIDDEN_WORDS) {
    if (haystack.includes(w)) {
      throw new Error(
        '[DIAGNOSTIC_META_E002] Toast wording contract violated: forbidden word "' + w + '" in ' + payload.footerCode + '.',
      );
    }
  }
  // W1: reject bare "Failed" / "Error" as the entire body content.
  if (/^\s*(failed|error)\s*[.:!]?\s*$/i.test(payload.body)) {
    throw new Error(
      '[DIAGNOSTIC_META_E002] Toast body must state the object of the failure, not just "Failed" (' + payload.footerCode + ').',
    );
  }
}

/** Test-only export so the Vitest suite can drive the guard directly. */
export const _forTests = { assertProfessionalWording, FORBIDDEN_WORDS };

/**
 * Registry-aware convenience: build a toast payload from a bare code +
 * context, without constructing a DiagnosticError first. Useful for
 * previews and for callers that already have a validated context object.
 */
export function previewToast(code: string, context: DiagnosticContext): DiagnosticToast {
  const entry = getErrorCodeEntry(code);
  if (!entry) {
    throw new Error('[DIAGNOSTIC_META_E001] Unknown error code "' + code + '".');
  }
  return formatDiagnosticToast(code, context);
}

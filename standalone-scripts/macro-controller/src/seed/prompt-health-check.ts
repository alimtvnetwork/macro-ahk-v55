/**
 * Prompt Health Check — v4.170.5
 *
 * Runtime verifier that the `plan-default` and `next-default` rows in the
 * `Prompt` table (a) exist, (b) are flagged `IsDefault=1`, (c) carry a
 * non-empty `Name`+`Body`, (d) satisfy the drift-guard required tokens for
 * the role (e.g. `{{n}}`), and (e) have a valid `ReplaceKey` +
 * `ReplaceValues` shape.
 *
 * Any failure is:
 *   - logged via `logError('PromptHealth', ...)` with the exact reason,
 *   - emitted as `health.default.missing` / `health.default.schema-drift`
 *     telemetry via `emitPromptSeedEvent`,
 *   - surfaced to the user via a red `showToast(..., 'error')` banner,
 *   - and stashed on `window.__marcoPromptHealthReport` for support triage.
 *
 * Root cause this closes: seeding + on-demand recovery can still leave the
 * DB in a subtly broken state (row exists but body missing `{{n}}`, or
 * `IsDefault=0`, or `ReplaceKey` empty). Without a health check the user
 * only discovers this when a Plan/Next fire silently produces garbage. This
 * module makes the failure loud, at boot, with actionable info.
 */

import type { PromptRole } from '../types/prompt-role';
import type { PromptRow } from '../db/prompt-db';
import { getDefaultPromptForRole } from '../db/prompt-db';
import { extractParamTokens } from '../db/prompt-token-guard';
import { getRequiredTokensForRole } from './plan-next-prompts';
import { PLAN_NEXT_SEED_ROWS } from './plan-next-prompts';
import { logDiagnosticFromCode } from '../error-utils';
import { showToast } from '../toast';
import { emitPromptSeedEvent } from '../telemetry/prompt-seed-telemetry';

export interface PromptHealthIssue {
  role: PromptRole;
  slug: string;
  code:
    | 'query-failed'
    | 'row-missing'
    | 'not-flagged-default'
    | 'name-empty'
    | 'body-empty'
    | 'missing-required-token'
    | 'replace-key-invalid'
    | 'replace-values-invalid';
  detail: string;
}

export interface PromptHealthReport {
  ok: boolean;
  checkedAt: number;
  issues: PromptHealthIssue[];
}

const ROLES_TO_CHECK: PromptRole[] = ['plan', 'next'];

/**
 * Inspect a single DB row and push any schema/body violations into `issues`.
 * Pure function: no I/O, no side effects beyond mutating the passed array.
 */
function inspectRow(role: PromptRole, slug: string, row: PromptRow | undefined, issues: PromptHealthIssue[]): void {
  if (!row) {
    issues.push({ role, slug, code: 'row-missing', detail: 'no default row for role=' + role });
    return;
  }
  if (row.IsDefault !== 1) {
    issues.push({ role, slug: row.Slug, code: 'not-flagged-default', detail: 'row id=' + row.Id + ' has IsDefault=' + String(row.IsDefault) });
  }
  if (typeof row.Name !== 'string' || row.Name.trim().length === 0) {
    issues.push({ role, slug: row.Slug, code: 'name-empty', detail: 'Name is empty on row id=' + row.Id });
  }
  if (typeof row.Body !== 'string' || row.Body.trim().length === 0) {
    issues.push({ role, slug: row.Slug, code: 'body-empty', detail: 'Body is empty on row id=' + row.Id });
    return; // no point checking token drift on empty body
  }
  const required = getRequiredTokensForRole(role);
  const present = new Set(extractParamTokens(row.Body));
  const missing = required.filter(t => !present.has(t));
  if (missing.length > 0) {
    issues.push({
      role, slug: row.Slug, code: 'missing-required-token',
      detail: 'row id=' + row.Id + ' Body is missing required token(s): ' + missing.join(', '),
    });
  }
  if (typeof row.ReplaceKey !== 'string' || row.ReplaceKey.trim().length === 0) {
    issues.push({ role, slug: row.Slug, code: 'replace-key-invalid', detail: 'ReplaceKey empty/invalid on row id=' + row.Id });
  }
  if (!Array.isArray(row.ReplaceValues)) {
    issues.push({ role, slug: row.Slug, code: 'replace-values-invalid', detail: 'ReplaceValues is not an array on row id=' + row.Id });
  }
}

export interface RunHealthCheckOptions {
  /**
   * When true, suppress the red `showToast(...)` banner that publishReport
   * would normally raise on failure. Telemetry, logError, and the
   * `window.__marcoPromptHealthReport` handoff still fire. Used by the
   * auto-repair path to avoid a false-alarm toast that would immediately be
   * contradicted by a successful reseed.
   */
  silent?: boolean;
}

/**
 * Run the full health check across every role in `ROLES_TO_CHECK`. Never
 * throws: any thrown error inside the DB layer is captured as a
 * `query-failed` issue so the caller always receives a report.
 */
export async function runPromptHealthCheck(opts: RunHealthCheckOptions = {}): Promise<PromptHealthReport> {
  const issues: PromptHealthIssue[] = [];
  for (const role of ROLES_TO_CHECK) {
    const seedSlug = PLAN_NEXT_SEED_ROWS.find(r => r.role === role && r.isDefault)?.slug ?? (role + '-default');
    try {
      const res = await getDefaultPromptForRole(role);
      if (!res.ok) {
        issues.push({ role, slug: seedSlug, code: 'query-failed', detail: res.error ?? 'unknown query error' });
        continue;
      }
      inspectRow(role, seedSlug, res.value, issues);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      issues.push({ role, slug: seedSlug, code: 'query-failed', detail: 'threw: ' + message });
    }
  }
  const report: PromptHealthReport = { ok: issues.length === 0, checkedAt: Date.now(), issues };
  publishReport(report, opts.silent === true);
  return report;
}

/**
 * Emit telemetry, expose the report on `window.__marcoPromptHealthReport`,
 * and show an error toast when unhealthy. Split out from
 * `runPromptHealthCheck` so callers (tests, on-demand triggers) can reuse
 * the same surface without re-running the DB probes.
 */
function publishReport(report: PromptHealthReport, silent: boolean): void {
  try {
    window.__marcoPromptHealthReport = report;
  } catch (_err) {
    // window may be locked down in some sandboxes; safe to ignore.
  }

  if (report.ok) {
    emitPromptSeedEvent({ event: 'health.default.ok', role: 'generic', outcome: 'ok', detail: 'all defaults healthy' });
    return;
  }

  for (const issue of report.issues) {
    logDiagnosticFromCode('HEALTH_CHECK_E001', {
      role: issue.role,
      issueCount: 1,
      issueSummary: issue.code + ' slug=' + issue.slug + ' — ' + issue.detail,
    });
    const event = issue.code === 'row-missing' || issue.code === 'query-failed'
      ? 'health.default.missing'
      : 'health.default.schema-drift';
    emitPromptSeedEvent({
      event, role: issue.role, slug: issue.slug,
      outcome: 'failed', detail: issue.code + ': ' + issue.detail,
    });
  }

  if (silent) return;

  const rolesAffected = Array.from(new Set(report.issues.map(i => i.role))).join(', ');
  const codes = Array.from(new Set(report.issues.map(i => i.code))).join(', ');
  showToast(
    '❌ Prompt health check failed for ' + rolesAffected + ' (' + codes + '). ' +
    'Open the ⚙ gear on the affected chip and run "🔄 Re-seed defaults" to recover.',
    'error',
  );
}

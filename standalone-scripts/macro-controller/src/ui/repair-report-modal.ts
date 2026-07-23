/**
 * repair-report-modal.ts — v4.246.0
 *
 * Renders a detailed "what was changed or restored" report after the
 * chip-gear "🩹 Repair prompts (auto)" action completes. The report diffs
 * the pre-repair health issues against the post-repair issues so the user
 * can see exactly which rows were:
 *
 *   - ✅ Fixed         (issue present initially, absent afterwards)
 *   - ⚠️ Still broken   (issue still present after repair)
 *   - ➕ Newly flagged  (only appeared after repair — rare regression)
 *
 * Also surfaces the reseed outcome (ok / error) and the checked-at
 * timestamps. Report is stashed on `window.__marcoLastRepairReport` for
 * support triage and logged to the console via `log()`.
 */

import type { AutoRepairResult } from '../seed/prompt-health-auto-repair';
import type { PromptHealthIssue } from '../seed/prompt-health-check';
import { log } from '../logger';
import { logDiagnosticFromCode, toErrorMessage } from '../error-utils';
import { cPanelBg, cPanelText, cPrimary, cSuccess, lModalRadius, lModalShadow, tFont } from '../shared-state';

export interface RepairReportSummary {
  fixed: PromptHealthIssue[];
  stillBroken: PromptHealthIssue[];
  newlyFlagged: PromptHealthIssue[];
  reseedAttempted: boolean;
  reseedOk: boolean;
  reseedError?: string;
  isHealthy: boolean;
  initialCount: number;
  finalCount: number;
  checkedAt: number;
}

declare global {
  interface Window {
    __marcoLastRepairReport?: RepairReportSummary;
  }
}

function keyOf(issue: PromptHealthIssue): string {
  return issue.role + '|' + issue.slug + '|' + issue.code;
}

export function buildRepairReport(result: AutoRepairResult): RepairReportSummary {
  const before = new Map<string, PromptHealthIssue>();
  for (const issue of result.initialReport.issues) before.set(keyOf(issue), issue);
  const after = new Map<string, PromptHealthIssue>();
  for (const issue of result.finalReport.issues) after.set(keyOf(issue), issue);

  const fixed: PromptHealthIssue[] = [];
  for (const [key, issue] of before) if (!after.has(key)) fixed.push(issue);
  const stillBroken: PromptHealthIssue[] = [];
  for (const [key, issue] of after) if (before.has(key)) stillBroken.push(issue);
  const newlyFlagged: PromptHealthIssue[] = [];
  for (const [key, issue] of after) if (!before.has(key)) newlyFlagged.push(issue);

  const summary: RepairReportSummary = {
    fixed, stillBroken, newlyFlagged,
    reseedAttempted: result.repairAttempted,
    reseedOk: result.reseedOk,
    isHealthy: result.isHealthy,
    initialCount: result.initialReport.issues.length,
    finalCount: result.finalReport.issues.length,
    checkedAt: result.finalReport.checkedAt,
  };
  if (result.reseedError) summary.reseedError = result.reseedError;
  return summary;
}

function formatIssueLine(issue: PromptHealthIssue): string {
  return '  • [' + issue.role + '] ' + issue.slug + ' — ' + issue.code + ': ' + issue.detail;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- linear report formatter, complexity is from branch labels not logic
export function formatRepairReportText(report: RepairReportSummary): string {

  const lines: string[] = [];
  const headline = report.isHealthy
    ? '✅ Prompts healthy after repair'
    : '⚠️ Prompts still have issues after repair';
  lines.push(headline);
  lines.push('Initial issues: ' + report.initialCount + ' → after repair: ' + report.finalCount);
  if (report.reseedAttempted) {
    lines.push('Reseed attempted: ' + (report.reseedOk ? 'ok' : ('failed — ' + (report.reseedError ?? 'unknown'))));
  } else {
    lines.push('Reseed attempted: no (already healthy)');
  }
  lines.push('');
  lines.push('✅ Fixed / restored (' + report.fixed.length + '):');
  if (report.fixed.length === 0) lines.push('  (none)');
  else for (const issue of report.fixed) lines.push(formatIssueLine(issue));
  lines.push('');
  lines.push('⚠️ Still broken (' + report.stillBroken.length + '):');
  if (report.stillBroken.length === 0) lines.push('  (none)');
  else for (const issue of report.stillBroken) lines.push(formatIssueLine(issue));
  if (report.newlyFlagged.length > 0) {
    lines.push('');
    lines.push('➕ Newly flagged after repair (' + report.newlyFlagged.length + '):');
    for (const issue of report.newlyFlagged) lines.push(formatIssueLine(issue));
  }
  return lines.join('\n');
}

export function stashRepairReport(report: RepairReportSummary): void {
  try {
    if (typeof window !== 'undefined') window.__marcoLastRepairReport = report;
  } catch { /* window may be absent in tests */ }
  const text = formatRepairReportText(report);
  if (report.reseedAttempted && !report.reseedOk) {
    logDiagnosticFromCode('REPAIR_RESEED_E001', {
      initialCount: report.initialCount,
      reason: report.reseedError ?? 'unknown',
    });
  }
  if (!report.isHealthy) {
    logDiagnosticFromCode('REPAIR_RESIDUAL_E001', {
      finalCount: report.finalCount,
      fixedCount: report.fixed.length,
      stillBrokenCount: report.stillBroken.length,
      newlyFlaggedCount: report.newlyFlagged.length,
    });
  }
  log('[RepairReport]\n' + text, report.isHealthy ? 'success' : 'info');
}

/**
 * Render a modal dialog with the detailed repair report. Non-blocking:
 * the user dismisses with Close, ✕, ESC, or backdrop click. Safe to call
 * in environments without `document` (early boot, tests) — returns null.
 */
// eslint-disable-next-line max-lines-per-function -- self-contained modal builder; splitting fragments DOM lifecycle
export function showRepairReportModal(report: RepairReportSummary): HTMLElement | null {

  if (typeof document === 'undefined' || !document.body) return null;

  const backdrop = document.createElement('div');
  backdrop.dataset.role = 'repair-report-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483646;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.dataset.role = 'repair-report-modal';
  modal.style.cssText = 'background:' + cPanelBg + ';color:' + cPanelText + ';font-family:' + tFont + ';'
    + 'border-radius:' + lModalRadius + ';box-shadow:' + lModalShadow + ';'
    + 'max-width:min(720px,92vw);max-height:82vh;display:flex;flex-direction:column;'
    + 'border:1px solid rgba(148,163,184,0.25);';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(148,163,184,0.2);';
  const title = document.createElement('div');
  title.textContent = report.isHealthy ? '🩹 Repair report — healthy' : '🩹 Repair report — issues remain';
  title.style.cssText = 'font-size:14px;font-weight:700;color:' + (report.isHealthy ? cSuccess : cPrimary) + ';';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.style.cssText = 'background:transparent;border:0;color:' + cPanelText + ';font-size:18px;cursor:pointer;padding:2px 6px;';
  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.style.cssText = 'padding:14px 18px;overflow:auto;flex:1 1 auto;';

  const summaryLine = document.createElement('div');
  summaryLine.style.cssText = 'font-size:12px;opacity:0.85;margin-bottom:10px;';
  summaryLine.textContent = 'Issues before: ' + report.initialCount
    + ' • after: ' + report.finalCount
    + ' • reseed: ' + (report.reseedAttempted ? (report.reseedOk ? 'ok' : ('failed — ' + (report.reseedError ?? 'unknown'))) : 'skipped')
    + ' • ' + new Date(report.checkedAt).toLocaleString();
  body.appendChild(summaryLine);

  body.appendChild(renderIssueList('✅ Fixed / restored', report.fixed, cSuccess));
  body.appendChild(renderIssueList('⚠️ Still broken', report.stillBroken, '#f97316'));
  if (report.newlyFlagged.length > 0) {
    body.appendChild(renderIssueList('➕ Newly flagged after repair', report.newlyFlagged, '#ef4444'));
  }

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:10px 18px;border-top:1px solid rgba(148,163,184,0.2);';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = '📋 Copy report';
  copyBtn.style.cssText = 'background:transparent;border:1px solid rgba(148,163,184,0.4);color:' + cPanelText + ';padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;';
  copyBtn.addEventListener('click', () => {
    try {
      void navigator.clipboard.writeText(formatRepairReportText(report));
      copyBtn.textContent = '✓ Copied';
    } catch (caught) {
      const reason = toErrorMessage(caught);
      logDiagnosticFromCode('REPAIR_COPY_E001', { reason }, caught);
      copyBtn.textContent = 'Copy failed';
    }
  });
  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.textContent = 'Close';
  doneBtn.style.cssText = 'background:' + cPrimary + ';border:0;color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;';
  footer.append(copyBtn, doneBtn);

  modal.append(header, body, footer);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const dismiss = (): void => { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); document.removeEventListener('keydown', onKey); };
  const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') dismiss(); };
  closeBtn.addEventListener('click', dismiss);
  doneBtn.addEventListener('click', dismiss);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) dismiss(); });
  document.addEventListener('keydown', onKey);
  return backdrop;
}

function renderIssueList(heading: string, issues: PromptHealthIssue[], accent: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:10px;';
  const h = document.createElement('div');
  h.textContent = heading + ' (' + issues.length + ')';
  h.style.cssText = 'font-size:12px;font-weight:700;color:' + accent + ';margin-bottom:4px;';
  wrap.appendChild(h);
  if (issues.length === 0) {
    const none = document.createElement('div');
    none.textContent = '(none)';
    none.style.cssText = 'font-size:12px;opacity:0.6;padding-left:12px;';
    wrap.appendChild(none);
    return wrap;
  }
  const list = document.createElement('ul');
  list.style.cssText = 'margin:0;padding-left:20px;font-size:12px;line-height:1.55;';
  for (const issue of issues) {
    const li = document.createElement('li');
    li.style.cssText = 'margin:0;';
    const badge = document.createElement('code');
    badge.textContent = issue.code;
    badge.style.cssText = 'background:rgba(148,163,184,0.18);border-radius:3px;padding:0 4px;font-size:11px;margin-right:6px;';
    li.append('[' + issue.role + '] ' + issue.slug + ' ', badge, document.createTextNode(issue.detail));
    list.appendChild(li);
  }
  wrap.appendChild(list);
  return wrap;
}

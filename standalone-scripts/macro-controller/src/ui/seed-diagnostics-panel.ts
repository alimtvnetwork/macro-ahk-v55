/**
 * seed-diagnostics-panel.ts (v4.405.0)
 *
 * Read-only modal that shows the last Plan/Next prompt seeding boot pass:
 * every stage that ran, its status, any error reason, and any diagnostic
 * toasts related to seeding/prompt-load that fired since boot. Sourced
 * from `SeedStatusSnapshot` + `readDiagnosticToastTrace()`; never queries
 * the DB or the network, so it stays safe to open when the app is broken.
 */

import { readSeedStatusSnapshot } from '../seed/seed-status-store';
import type { SeedStageReport, SeedStageStatus } from '../seed/seed-status-store';
import { readDiagnosticToastTrace } from '../telemetry/diagnostic-toast-telemetry';
import type { DiagnosticToastEvent } from '../telemetry/diagnostic-toast-telemetry';
import {
  readPromptEditE005Entries,
  summarizeLatestByRole,
} from '../telemetry/prompt-edit-e005-store';
import type { PromptEditE005Summary } from '../telemetry/prompt-edit-e005-store';
import { buildStoredZip } from '../utils/mini-zip';
import { getSqlBridgeState } from '../db/sql-bridge';

const RELEVANT_CODES = new Set<string>([
  'DB_MACRO_INIT_E001',
  'SEED_ORPHAN_REPAIR_E001',
  'PROMPT_LOAD_E001',
  'PROMPT_EDIT_E005',
  'SEED_BUNDLE_E001',
  'SEED_RESEED_E001',
]);

const NOT_ACCEPTED = '(not yet accepted)';

const STATUS_COLOR: Record<SeedStageStatus, string> = {
  ok: '#22c55e',
  failed: '#ef4444',
  skipped: '#9ca3af',
};

export function openSeedDiagnosticsPanel(): void {
  const existing = document.getElementById('marco-seed-diag-panel');
  if (existing) { existing.remove(); return; }
  const backdrop = buildBackdrop();
  const modal = buildModal();
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

function buildBackdrop(): HTMLDivElement {
  const backdrop = document.createElement('div');
  backdrop.id = 'marco-seed-diag-panel';
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2147483000;display:flex;align-items:center;justify-content:center;';
  backdrop.onclick = (evt) => { if (evt.target === backdrop) backdrop.remove(); };
  return backdrop;
}

function buildModal(): HTMLDivElement {
  const modal = document.createElement('div');
  modal.style.cssText =
    'width:min(720px,92vw);max-height:82vh;overflow:auto;background:#0f172a;color:#e5e7eb;'
    + 'border:1px solid #334155;border-radius:8px;padding:16px;font-family:system-ui,sans-serif;font-size:12px;';
  modal.appendChild(buildHeader());
  modal.appendChild(buildE005Section());
  modal.appendChild(buildSnapshotSection());
  modal.appendChild(buildBridgeSection());
  modal.appendChild(buildErrorTraceSection('Recent PROMPT_LOAD_E001', 'PROMPT_LOAD_E001'));
  modal.appendChild(buildErrorTraceSection('Recent SEED_RESEED_E001', 'SEED_RESEED_E001'));
  modal.appendChild(buildTraceSection());
  return modal;
}

function buildE005Section(): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-bottom:12px;';
  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;';
  const title = sectionTitle('Latest PROMPT_EDIT_E005 by role');
  title.style.margin = '0';
  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = '\u2B07 Download E005 diagnostics ZIP';
  downloadBtn.setAttribute('data-testid', 'marco-download-e005-zip');
  downloadBtn.style.cssText =
    'background:#1d4ed8;color:#e5e7eb;border:0;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;';
  downloadBtn.onclick = () => { downloadE005DiagnosticsZip(); };
  headerRow.appendChild(title);
  headerRow.appendChild(downloadBtn);
  wrap.appendChild(headerRow);
  const summaries = summarizeLatestByRole();
  if (summaries.length === 0) {
    wrap.appendChild(muted('No PROMPT_EDIT_E005 snapshots recorded. The editor has not hit that failure since boot.'));
    return wrap;
  }
  for (const summary of summaries) wrap.appendChild(renderE005Summary(summary));
  return wrap;
}

function renderE005Summary(summary: PromptEditE005Summary): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'padding:6px 8px;border-left:2px solid #f59e0b;background:#111827;border-radius:3px;margin:4px 0;';
  const top = document.createElement('div');
  top.style.cssText = 'display:flex;justify-content:space-between;font-family:ui-monospace,monospace;';
  const codeSpan = document.createElement('span');
  codeSpan.textContent = 'role=' + summary.role + '  slug=' + summary.resolvedSlug;
  codeSpan.style.color = '#fbbf24';
  const timeSpan = document.createElement('span');
  timeSpan.textContent = formatLocal(summary.at);
  timeSpan.style.color = '#94a3b8';
  top.appendChild(codeSpan); top.appendChild(timeSpan);
  const detail = document.createElement('div');
  detail.style.cssText = 'color:#cbd5e1;margin-top:3px;font-family:ui-monospace,monospace;';
  detail.textContent =
    'owner=' + summary.slugOwnerRole
    + '  mismatch=' + summary.orphanRoleMismatch
    + '  site=' + summary.site;
  row.appendChild(top); row.appendChild(detail);
  if (summary.reason) {
    const reason = document.createElement('div');
    reason.style.cssText = 'color:#f87171;margin-top:2px;white-space:pre-wrap;';
    reason.textContent = summary.reason;
    row.appendChild(reason);
  }
  return row;
}

function buildE005SummaryText(summaries: PromptEditE005Summary[]): string {
  if (summaries.length === 0) return 'No PROMPT_EDIT_E005 snapshots recorded.\n';
  const lines: string[] = ['PROMPT_EDIT_E005 latest-by-role summary', ''];
  for (const summary of summaries) {
    lines.push('- role=' + summary.role);
    lines.push('    resolvedSlug     : ' + summary.resolvedSlug);
    lines.push('    slugOwnerRole    : ' + summary.slugOwnerRole);
    lines.push('    orphanMismatch   : ' + summary.orphanRoleMismatch);
    lines.push('    site             : ' + summary.site);
    lines.push('    at               : ' + summary.at);
    if (summary.reason) lines.push('    reason           : ' + summary.reason);
    lines.push('');
  }
  return lines.join('\n');
}

function downloadE005DiagnosticsZip(): void {
  const summaries = summarizeLatestByRole();
  const entries = readPromptEditE005Entries();
  const fullTrace = readDiagnosticToastTrace();
  const trace = fullTrace.filter((e) => String(e.code) === 'PROMPT_EDIT_E005');
  const loadE001 = fullTrace.filter((e) => String(e.code) === 'PROMPT_LOAD_E001');
  const reseedE001 = fullTrace.filter((e) => String(e.code) === 'SEED_RESEED_E001');
  const bridge = getSqlBridgeState();
  const seedSnap = readSeedStatusSnapshot();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zip = buildStoredZip([
    { path: 'summary.txt', content: buildE005SummaryText(summaries) },
    { path: 'entries.json', content: JSON.stringify(entries, null, 2) },
    { path: 'toast-trace.json', content: JSON.stringify(trace, null, 2) },
    { path: 'prompt-load-e001.json', content: JSON.stringify(loadE001, null, 2) },
    { path: 'seed-reseed-e001.json', content: JSON.stringify(reseedE001, null, 2) },
    { path: 'sql-bridge.json', content: JSON.stringify(bridge, null, 2) },
    { path: 'contract.md', content: buildContractMarkdown(bridge) },
    { path: 'seed-snapshot.json', content: JSON.stringify(seedSnap, null, 2) },
  ]);
  const url = URL.createObjectURL(zip);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'prompt-edit-e005-' + stamp + '.zip';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildContractMarkdown(bridge: ReturnType<typeof getSqlBridgeState>): string {
  const lines: string[] = [];
  lines.push('# rawSql v2 contract snapshot');
  lines.push('');
  lines.push('captured: ' + new Date().toISOString());
  lines.push('');
  lines.push('## Winning method per bucket');
  lines.push('');
  for (const bucket of ['SELECT', 'WRITE', 'ALTER'] as const) {
    lines.push('- ' + bucket + ': ' + (bridge.winning[bucket] ?? NOT_ACCEPTED));
  }
  lines.push('');
  lines.push('## Candidate probe order');
  lines.push('');
  for (const bucket of ['SELECT', 'WRITE', 'ALTER'] as const) {
    lines.push('- ' + bucket + ': ' + bridge.candidates[bucket].join(', '));
  }
  lines.push('');
  lines.push('## Observed contract-shape rejections (this session)');
  lines.push('');
  let any = false;
  for (const bucket of ['SELECT', 'WRITE', 'ALTER'] as const) {
    for (const r of bridge.rejections[bucket]) {
      any = true;
      lines.push('- [' + r.at + '] ' + bucket + '/' + r.method + ': ' + r.message);
    }
  }
  if (!any) lines.push('(none)');
  lines.push('');
  return lines.join('\n');
}

function buildErrorTraceSection(title: string, code: string): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:12px;';
  wrap.appendChild(sectionTitle(title));
  const events = readDiagnosticToastTrace().filter((e) => String(e.code) === code);
  if (events.length === 0) {
    wrap.appendChild(muted('No ' + code + ' events recorded.'));
    return wrap;
  }
  for (const evt of events.slice(-10).reverse()) wrap.appendChild(renderTraceRow(evt));
  return wrap;
}

function buildBridgeSection(): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:12px;';
  wrap.appendChild(sectionTitle('sql-bridge state (rawSql method-name adapter)'));
  const state = getSqlBridgeState();
  const grid = document.createElement('pre');
  grid.style.cssText = 'background:#111827;color:#cbd5e1;padding:8px;border-radius:4px;font-family:ui-monospace,monospace;font-size:11px;white-space:pre-wrap;margin:4px 0;';
  const lines = [
    'SELECT winning: ' + (state.winning.SELECT ?? '(not yet accepted)'),
    'WRITE  winning: ' + (state.winning.WRITE ?? '(not yet accepted)'),
    'ALTER  winning: ' + (state.winning.ALTER ?? '(not yet accepted)'),
  ];
  const rejCount = state.rejections.SELECT.length + state.rejections.WRITE.length + state.rejections.ALTER.length;
  lines.push('rejections observed: ' + rejCount);
  grid.textContent = lines.join('\n');
  wrap.appendChild(grid);
  return wrap;
}

function buildHeader(): HTMLDivElement {
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';
  const title = document.createElement('div');
  title.textContent = 'Plan/Next seeding diagnostics';
  title.style.cssText = 'font-size:14px;font-weight:600;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'background:#334155;color:#e5e7eb;border:0;padding:4px 10px;border-radius:4px;cursor:pointer;';
  closeBtn.onclick = () => { document.getElementById('marco-seed-diag-panel')?.remove(); };
  header.appendChild(title);
  header.appendChild(closeBtn);
  return header;
}

function buildSnapshotSection(): HTMLDivElement {
  const wrap = document.createElement('div');
  const snap = readSeedStatusSnapshot();
  if (!snap) {
    wrap.appendChild(sectionTitle('Last boot snapshot'));
    wrap.appendChild(muted('No seeding snapshot recorded yet. Reload the extension to capture one.'));
    return wrap;
  }
  wrap.appendChild(sectionTitle('Last boot snapshot'));
  const meta = document.createElement('div');
  meta.style.cssText = 'margin-bottom:8px;color:#94a3b8;';
  meta.textContent = 'at ' + formatLocal(snap.at) + '  overall=' + snap.overall;
  meta.style.color = STATUS_COLOR[snap.overall];
  wrap.appendChild(meta);
  for (const stage of snap.stages) wrap.appendChild(renderStageRow(stage));
  if (snap.orphanRepair && snap.orphanRepair.entries.length > 0) {
    wrap.appendChild(sectionTitle('Orphan repair entries'));
    for (const entry of snap.orphanRepair.entries) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:3px 6px;border-left:2px solid #475569;margin:2px 0;font-family:ui-monospace,monospace;';
      row.textContent = entry.slug + '  ' + entry.fromRole + ' -> ' + entry.toRole
        + '  [' + entry.outcome + ']' + (entry.reason ? '  reason=' + entry.reason : '');
      wrap.appendChild(row);
    }
  }
  return wrap;
}

function renderStageRow(stage: SeedStageReport): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:baseline;padding:4px 0;border-top:1px solid #1e293b;';
  const dot = document.createElement('span');
  dot.textContent = '\u25CF';
  dot.style.cssText = 'color:' + STATUS_COLOR[stage.status] + ';font-size:14px;line-height:1;';
  const name = document.createElement('span');
  name.textContent = stage.stage;
  name.style.cssText = 'min-width:220px;font-family:ui-monospace,monospace;';
  const detail = document.createElement('span');
  detail.style.cssText = 'flex:1;color:#cbd5e1;';
  detail.textContent = buildStageDetail(stage);
  row.appendChild(dot); row.appendChild(name); row.appendChild(detail);
  return row;
}

function buildStageDetail(stage: SeedStageReport): string {
  const parts: string[] = [stage.status];
  if (stage.reason) parts.push('reason=' + stage.reason);
  if (stage.metrics) {
    for (const [key, value] of Object.entries(stage.metrics)) parts.push(key + '=' + value);
  }
  return parts.join('  ');
}

function buildTraceSection(): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:14px;';
  wrap.appendChild(sectionTitle('Recent diagnostic toasts (seed / prompt-load)'));
  const events = readDiagnosticToastTrace().filter((e) => RELEVANT_CODES.has(String(e.code)));
  if (events.length === 0) {
    wrap.appendChild(muted('No relevant diagnostic toasts in the trace.'));
    return wrap;
  }
  const recent = events.slice(-20).reverse();
  for (const evt of recent) wrap.appendChild(renderTraceRow(evt));
  return wrap;
}

function renderTraceRow(evt: DiagnosticToastEvent): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'padding:5px 6px;border-left:2px solid #475569;margin:3px 0;background:#111827;border-radius:3px;';
  const top = document.createElement('div');
  top.style.cssText = 'display:flex;justify-content:space-between;gap:8px;';
  const codeSpan = document.createElement('span');
  codeSpan.textContent = String(evt.code);
  codeSpan.style.cssText = 'font-family:ui-monospace,monospace;color:' + toastColor(evt.level) + ';';
  const timeSpan = document.createElement('span');
  timeSpan.textContent = formatLocal(evt.at);
  timeSpan.style.cssText = 'color:#94a3b8;';
  top.appendChild(codeSpan); top.appendChild(timeSpan);
  const body = document.createElement('div');
  body.style.cssText = 'color:#cbd5e1;margin-top:2px;white-space:pre-wrap;';
  body.textContent = evt.title + (evt.detail ? '\n' + evt.detail : '');
  row.appendChild(top); row.appendChild(body);
  return row;
}

function toastColor(level: string): string {
  if (level === 'error') return '#ef4444';
  if (level === 'warn') return '#f59e0b';
  if (level === 'success') return '#22c55e';
  return '#93c5fd';
}

function sectionTitle(text: string): HTMLDivElement {
  const node = document.createElement('div');
  node.textContent = text;
  node.style.cssText = 'font-size:12px;font-weight:600;color:#c4b5fd;margin:10px 0 4px;';
  return node;
}

function muted(text: string): HTMLDivElement {
  const node = document.createElement('div');
  node.textContent = text;
  node.style.cssText = 'color:#94a3b8;padding:6px 0;';
  return node;
}

function formatLocal(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

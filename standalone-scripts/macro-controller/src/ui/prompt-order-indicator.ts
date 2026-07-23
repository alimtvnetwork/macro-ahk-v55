/**
 * Prompt Order Indicator
 *
 * Renders a compact clickable badge that shows the current effective prompt
 * order and flags any slugs that violate DEFAULT_PROMPT_ORDER. Clicking the
 * badge opens a fixed-position popover listing every slug in effective order
 * with per-row status: OK / OUT-OF-ORDER / UNKNOWN / MISSING, plus a summary
 * of terminal-7 tail compliance.
 */

import {
  DEFAULT_PROMPT_ORDER,
  getEffectivePromptOrder,
  getPromptOrderSource,
} from './prompt-drag-order';

export type ViolationKind = 'ok' | 'out-of-order' | 'unknown' | 'missing';

export interface OrderRow {
  slug: string;
  effectiveIndex: number | null;
  defaultIndex: number | null;
  status: ViolationKind;
}

export interface OrderComplianceReport {
  rows: OrderRow[];
  terminalOk: boolean;
  expectedTerminal: string[];
  actualTerminal: string[];
  violationCount: number;
}

const TERMINAL_COUNT = 7;

/**
 * Compare the effective order against DEFAULT_PROMPT_ORDER and classify each
 * slug. A slug is OUT-OF-ORDER when its position among default-known slugs
 * disagrees with the canonical relative order.
 */
export function analyzePromptOrderCompliance(): OrderComplianceReport {
  const effective = getEffectivePromptOrder();
  const defaults = DEFAULT_PROMPT_ORDER.slice();
  const defaultRank = new Map<string, number>();
  defaults.forEach((slug, idx) => defaultRank.set(slug, idx));

  const rows: OrderRow[] = [];
  const known = effective.filter((slug) => defaultRank.has(slug));
  const knownRanks = known.map((slug) => defaultRank.get(slug) ?? -1);

  effective.forEach((slug, idx) => {
    const dIdx = defaultRank.get(slug);
    if (dIdx === undefined) {
      rows.push({ slug, effectiveIndex: idx, defaultIndex: null, status: 'unknown' });
      return;
    }
    const knownPos = known.indexOf(slug);
    const outOfOrder = !isMonotonicAt(knownRanks, knownPos);
    rows.push({
      slug,
      effectiveIndex: idx,
      defaultIndex: dIdx,
      status: outOfOrder ? 'out-of-order' : 'ok',
    });
  });

  const seenInEffective = new Set(effective);
  defaults.forEach((slug, dIdx) => {
    if (!seenInEffective.has(slug)) {
      rows.push({ slug, effectiveIndex: null, defaultIndex: dIdx, status: 'missing' });
    }
  });

  const expectedTerminal = defaults.slice(defaults.length - TERMINAL_COUNT);
  const actualTerminal = effective.slice(Math.max(0, effective.length - TERMINAL_COUNT));
  const terminalOk = arraysEqual(expectedTerminal, actualTerminal);
  const violationCount = rows.filter((r) => r.status !== 'ok').length + (terminalOk ? 0 : 1);
  return { rows, terminalOk, expectedTerminal, actualTerminal, violationCount };
}

function isMonotonicAt(ranks: number[], pos: number): boolean {
  const prev = pos > 0 ? ranks[pos - 1] : undefined;
  const curr = ranks[pos];
  if (curr === undefined) return true;
  if (prev !== undefined && prev >= curr) return false;
  return true;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** Build the clickable indicator badge (replaces the plain order-source badge). */
export function buildPromptOrderIndicator(): HTMLElement {
  const info = getPromptOrderSource();
  const report = analyzePromptOrderCompliance();
  const badge = document.createElement('span');
  badge.setAttribute('data-prompt-order-source', info.source);
  badge.setAttribute('data-prompt-order-violations', String(report.violationCount));
  badge.setAttribute('role', 'button');
  badge.setAttribute('tabindex', '0');
  const isSaved = info.source === 'localStorage';
  const hasViolations = report.violationCount > 0;
  const icon = hasViolations ? '⚠' : '✓';
  const srcLabel = isSaved ? 'LS' : 'DEFAULT';
  badge.textContent = icon + ' ord: ' + srcLabel + ' (' + info.count + ')' +
    (hasViolations ? ' · ' + report.violationCount + ' issue' + (report.violationCount === 1 ? '' : 's') : '');
  badge.title = 'Click to inspect effective prompt order vs DEFAULT_PROMPT_ORDER';
  applyBadgeStyle(badge, hasViolations, isSaved);
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    openOrderPopover(badge);
  });
  badge.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOrderPopover(badge); }
  });
  return badge;
}

function applyBadgeStyle(badge: HTMLElement, hasViolations: boolean, isSaved: boolean): void {
  const bg = hasViolations
    ? 'rgba(239,68,68,0.28)'
    : (isSaved ? 'rgba(59,130,246,0.25)' : 'rgba(107,114,128,0.25)');
  const fg = hasViolations ? '#fecaca' : (isSaved ? '#93c5fd' : '#d1d5db');
  const border = hasViolations ? '1px solid rgba(239,68,68,0.55)' : '1px solid transparent';
  badge.style.cssText = 'font-size:9px;font-weight:600;color:' + fg + ';background:' + bg +
    ';padding:1px 6px;border-radius:3px;margin-left:4px;cursor:pointer;letter-spacing:0.3px;border:' + border + ';';
}

let openPopover: HTMLElement | null = null;

function openOrderPopover(anchor: HTMLElement): void {
  closeOrderPopover();
  const report = analyzePromptOrderCompliance();
  const info = getPromptOrderSource();
  const pop = document.createElement('div');
  pop.setAttribute('data-prompt-order-popover', '1');
  const rect = anchor.getBoundingClientRect();
  pop.style.cssText = [
    'position:fixed',
    'left:' + Math.max(8, Math.round(rect.left)) + 'px',
    'top:' + Math.round(rect.bottom + 6) + 'px',
    'z-index:2147483000',
    'width:360px',
    'max-height:60vh',
    'overflow:auto',
    'background:#0f0720',
    'border:1px solid #7c3aed',
    'border-radius:6px',
    'box-shadow:0 8px 24px rgba(0,0,0,0.5)',
    'color:#e5e7eb',
    'font-size:11px',
    'padding:8px 10px',
  ].join(';') + ';';
  pop.appendChild(buildPopoverHeader(info, report));
  pop.appendChild(buildTerminalSummary(report));
  pop.appendChild(buildRowsList(report));
  document.body.appendChild(pop);
  openPopover = pop;
  setTimeout(() => document.addEventListener('click', outsideClickHandler, { once: true }), 0);
}

function buildPopoverHeader(
  info: ReturnType<typeof getPromptOrderSource>,
  report: OrderComplianceReport,
): HTMLElement {
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:700;color:#c4b5fd;';
  title.textContent = 'Prompt Order · ' + (info.source === 'localStorage' ? 'localStorage' : 'DEFAULT');
  const count = document.createElement('div');
  const ok = report.violationCount === 0;
  count.style.cssText = 'font-size:10px;color:' + (ok ? '#86efac' : '#fca5a5') + ';';
  count.textContent = ok ? '✓ compliant' : '⚠ ' + report.violationCount + ' issue(s)';
  head.appendChild(title);
  head.appendChild(count);
  return head;
}

function buildTerminalSummary(report: OrderComplianceReport): HTMLElement {
  const box = document.createElement('div');
  const ok = report.terminalOk;
  box.style.cssText = 'font-size:10px;margin-bottom:6px;padding:4px 6px;border-radius:4px;background:' +
    (ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.14)') + ';color:' + (ok ? '#bbf7d0' : '#fecaca') + ';';
  box.textContent = (ok ? '✓' : '⚠') + ' Terminal-7 tail ' + (ok ? 'matches' : 'MISMATCH') +
    ' — expected: ' + report.expectedTerminal.join(' → ');
  return box;
}

function buildRowsList(report: OrderComplianceReport): HTMLElement {
  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
  report.rows.forEach((row) => list.appendChild(buildRow(row)));
  return list;
}

function buildRow(row: OrderRow): HTMLElement {
  const line = document.createElement('div');
  line.setAttribute('data-order-row-status', row.status);
  const palette = statusPalette(row.status);
  line.style.cssText = 'display:flex;justify-content:space-between;gap:8px;padding:2px 6px;border-radius:3px;background:' +
    palette.bg + ';color:' + palette.fg + ';font-family:ui-monospace,monospace;';
  const left = document.createElement('span');
  const eIdx = row.effectiveIndex === null ? '—' : String(row.effectiveIndex + 1).padStart(2, '0');
  left.textContent = palette.icon + ' ' + eIdx + '  ' + row.slug;
  const right = document.createElement('span');
  right.style.cssText = 'opacity:0.75;font-size:9px;';
  const dIdx = row.defaultIndex === null ? 'unknown' : 'def#' + (row.defaultIndex + 1);
  right.textContent = row.status === 'ok' ? dIdx : row.status.toUpperCase() + ' · ' + dIdx;
  line.appendChild(left);
  line.appendChild(right);
  return line;
}

function statusPalette(status: ViolationKind): { bg: string; fg: string; icon: string } {
  if (status === 'ok') return { bg: 'transparent', fg: '#d1d5db', icon: '·' };
  if (status === 'out-of-order') return { bg: 'rgba(234,179,8,0.15)', fg: '#fde68a', icon: '↕' };
  if (status === 'unknown') return { bg: 'rgba(107,114,128,0.18)', fg: '#e5e7eb', icon: '?' };
  return { bg: 'rgba(239,68,68,0.16)', fg: '#fecaca', icon: '×' };
}

function outsideClickHandler(): void {
  closeOrderPopover();
}

function closeOrderPopover(): void {
  if (openPopover && openPopover.parentNode) openPopover.parentNode.removeChild(openPopover);
  openPopover = null;
}

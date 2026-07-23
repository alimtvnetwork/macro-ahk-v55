/**
 * Prompt diff renderer — unified line-diff for the Plan/Next editor.
 *
 * Root problem: users could not see what would actually change before
 * hitting Save, so accidental edits shipped with no visual warning. This
 * module produces a compact +/- unified diff between the currently-saved
 * body and the textarea buffer, updated live while the editor is open.
 *
 * Kept intentionally pure (no DOM globals at import time, no logging) so
 * it can be unit-tested under jsdom without extension bootstrapping.
 */
import { cPanelBgAlt, cPanelFgDim } from '../shared-state';

/** Diff op codes. Names are self-describing per boolean-principles rule. */
export const DIFF_OP_EQUAL = 'equal' as const;
export const DIFF_OP_ADD = 'add' as const;
export const DIFF_OP_REMOVE = 'remove' as const;

export type DiffOp =
  typeof DIFF_OP_EQUAL |
  typeof DIFF_OP_ADD |
  typeof DIFF_OP_REMOVE;

export interface DiffLine {
  op: DiffOp;
  text: string;
}

/** Diff two strings line by line using LCS. Returns a linear op stream. */
export function diffLines(before: string, after: string): DiffLine[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const table = buildLcsTable(beforeLines, afterLines);
  return walkLcsTable(table, beforeLines, afterLines);
}

function buildLcsTable(a: readonly string[], b: readonly string[]): number[][] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const row = table[i] as number[];
      const prevRow = table[i - 1] as number[];
      row[j] = a[i - 1] === b[j - 1]
        ? (prevRow[j - 1] as number) + 1
        : Math.max(prevRow[j] as number, row[j - 1] as number);
    }
  }
  return table;
}

function walkLcsTable(table: number[][], a: readonly string[], b: readonly string[]): DiffLine[] {
  const out: DiffLine[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { out.push({ op: DIFF_OP_EQUAL, text: a[i - 1] as string }); i -= 1; j -= 1; continue; }
    const up = (table[i - 1] as number[])[j] as number;
    const left = (table[i] as number[])[j - 1] as number;
    if (up >= left) { out.push({ op: DIFF_OP_REMOVE, text: a[i - 1] as string }); i -= 1; }
    else { out.push({ op: DIFF_OP_ADD, text: b[j - 1] as string }); j -= 1; }
  }
  while (i > 0) { out.push({ op: DIFF_OP_REMOVE, text: a[i - 1] as string }); i -= 1; }
  while (j > 0) { out.push({ op: DIFF_OP_ADD, text: b[j - 1] as string }); j -= 1; }
  return out.reverse();
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export function summarizeDiff(lines: readonly DiffLine[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const line of lines) {
    if (line.op === DIFF_OP_ADD) added += 1;
    else if (line.op === DIFF_OP_REMOVE) removed += 1;
    else unchanged += 1;
  }
  return { added, removed, unchanged };
}

const COLOR_ADD_BG = 'rgba(34,197,94,0.14)';
const COLOR_ADD_FG = '#4ade80';
const COLOR_REMOVE_BG = 'rgba(239,68,68,0.14)';
const COLOR_REMOVE_FG = '#f87171';

/** Build a unified-diff pane. Pure DOM; caller mounts it. */
export function renderDiffPane(before: string, after: string): HTMLElement {
  const pane = document.createElement('div');
  pane.dataset.testid = 'prompt-editor-diff-pane';
  pane.style.cssText = 'max-height:220px;overflow:auto;background:' + cPanelBgAlt + ';border:1px solid rgba(124,58,237,0.3);border-radius:6px;padding:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.45;';
  const diff = diffLines(before, after);
  const stats = summarizeDiff(diff);
  pane.appendChild(buildDiffHeader(stats));
  if (stats.added === 0 && stats.removed === 0) {
    pane.appendChild(buildEmptyRow());
    return pane;
  }
  for (const line of diff) pane.appendChild(buildDiffRow(line));
  return pane;
}

function buildDiffHeader(stats: DiffStats): HTMLElement {
  const header = document.createElement('div');
  header.dataset.testid = 'prompt-editor-diff-stats';
  header.style.cssText = 'font-size:10px;color:' + cPanelFgDim + ';margin-bottom:6px;';
  header.textContent = '+' + stats.added + ' / -' + stats.removed + ' (unchanged ' + stats.unchanged + ')';
  return header;
}

function buildEmptyRow(): HTMLElement {
  const row = document.createElement('div');
  row.dataset.testid = 'prompt-editor-diff-empty';
  row.style.cssText = 'color:' + cPanelFgDim + ';font-style:italic;';
  row.textContent = 'No differences vs saved body.';
  return row;
}

function buildDiffRow(line: DiffLine): HTMLElement {
  const row = document.createElement('div');
  row.dataset.diffOp = line.op;
  row.style.cssText = rowCssFor(line.op);
  row.textContent = prefixFor(line.op) + line.text;
  return row;
}

function prefixFor(op: DiffOp): string {
  if (op === DIFF_OP_ADD) return '+ ';
  if (op === DIFF_OP_REMOVE) return '- ';
  return '  ';
}

function rowCssFor(op: DiffOp): string {
  if (op === DIFF_OP_ADD) return 'white-space:pre-wrap;background:' + COLOR_ADD_BG + ';color:' + COLOR_ADD_FG + ';padding:0 4px;';
  if (op === DIFF_OP_REMOVE) return 'white-space:pre-wrap;background:' + COLOR_REMOVE_BG + ';color:' + COLOR_REMOVE_FG + ';padding:0 4px;';
  return 'white-space:pre-wrap;color:' + cPanelFgDim + ';padding:0 4px;';
}

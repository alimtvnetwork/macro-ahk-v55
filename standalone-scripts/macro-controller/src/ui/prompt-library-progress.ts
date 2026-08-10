import { ModalRefs, CSS_DISPLAY_NONE, CSS_MARGIN_BOTTOM_10, CSS_BG_MUTED_1, CSS_BORDER_DEFAULT, CSS_BORDER_RADIUS_6, ATTR_ARIA_VALUENOW, ATTR_ARIA_VALUETEXT, CSS_CURSOR_POINTER } from './prompt-library-types';
import type { ImportProgress } from './prompt-io';
import { ImportErrorSourceType } from "../types/enums";

export function buildImportProgressElement(): {
  wrap: HTMLDivElement;
  label: HTMLSpanElement;
  bar: HTMLDivElement;
  counter: HTMLSpanElement;
} {
  const wrap = document.createElement('div');
  wrap.dataset.testid = 'library-import-progress';
  wrap.hidden = true;
  wrap.style.cssText = [
    CSS_DISPLAY_NONE, CSS_MARGIN_BOTTOM_10, 'padding:8px 10px',
    CSS_BG_MUTED_1, CSS_BORDER_DEFAULT, CSS_BORDER_RADIUS_6,
    'font-size:11px', 'color:#c9d3e6',
  ].join(';');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
  const label = document.createElement('span');
  label.dataset.testid = 'library-import-progress-label';
  label.textContent = 'Preparing import…';
  label.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  const counter = document.createElement('span');
  counter.dataset.testid = 'library-import-progress-counter';
  counter.textContent = '0/0';
  counter.style.cssText = 'font-variant-numeric:tabular-nums;color:#9aa7bd;flex-shrink:0;';
  row.appendChild(label);
  row.appendChild(counter);

  const track = document.createElement('div');
  track.style.cssText = 'height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;';
  const bar = document.createElement('div');
  bar.dataset.testid = 'library-import-progress-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute(ATTR_ARIA_VALUENOW, '0');
  bar.style.cssText = 'height:100%;width:0%;background:#7cc4ff;transition:width 120ms ease-out;';
  track.appendChild(bar);

  wrap.appendChild(row);
  wrap.appendChild(track);

  return { wrap, label, bar, counter };
}

export function showImportProgress(refs: ModalRefs): void {
  const p = refs.importProgress;
  if (!p) return;
  p.wrap.hidden = false;
  p.wrap.style.display = 'block';
  p.label.textContent = 'Preparing import…';
  p.counter.textContent = '0/0';
  p.bar.style.width = '0%';
  p.bar.setAttribute(ATTR_ARIA_VALUENOW, '0');
  p.bar.setAttribute(ATTR_ARIA_VALUETEXT, 'Preparing import');
}

export function hideImportProgress(refs: ModalRefs): void {
  const p = refs.importProgress;
  if (!p) return;
  p.wrap.hidden = true;
  p.wrap.style.display = 'none';
}

export function updateImportProgress(refs: ModalRefs, progress: ImportProgress): void {
  const p = refs.importProgress;
  if (!p) return;
  if (progress.phase === 'entries') {
    p.label.textContent = 'Committed ' + String(progress.entriesCommitted)
      + '/' + String(progress.totalEntries) + ' entries';
    p.counter.textContent = String(progress.entriesCommitted) + '/' + String(progress.totalEntries);
    const pct = progress.totalRevisions > 0 ? 15 : 100;
    p.bar.style.width = String(pct) + '%';
    p.bar.setAttribute(ATTR_ARIA_VALUENOW, String(pct));
    p.bar.setAttribute(ATTR_ARIA_VALUETEXT, p.label.textContent);

    return;
  }
  if (progress.phase === 'revisions') {
    const total = Math.max(1, progress.totalRevisions);
    const pct = Math.min(100, Math.round((progress.insertedRevisions / total) * 100));
    const slugSuffix = progress.slug ? ' (' + progress.slug + ')' : '';
    p.label.textContent = 'Inserting revisions' + slugSuffix;
    p.counter.textContent = String(progress.insertedRevisions) + '/' + String(progress.totalRevisions);
    p.bar.style.width = String(pct) + '%';
    p.bar.setAttribute(ATTR_ARIA_VALUENOW, String(pct));
    p.bar.setAttribute(
      ATTR_ARIA_VALUETEXT,
      'Inserted ' + String(progress.insertedRevisions) + ' of '
      + String(progress.totalRevisions) + ' revisions'
      + ' (' + String(progress.groupsDone) + '/' + String(progress.totalGroups) + ' prompts)',
    );

    return;
  }
  p.label.textContent = 'Import complete';
  p.counter.textContent = String(progress.insertedRevisions) + '/' + String(progress.totalRevisions);
  p.bar.style.width = '100%';
  p.bar.setAttribute(ATTR_ARIA_VALUENOW, '100');
  p.bar.setAttribute(ATTR_ARIA_VALUETEXT, 'Import complete');
}

export function renderPartialImportErrors(
  refs: ModalRefs,
  entryErrors: readonly string[],
  parseErrors: readonly string[],
): void {
  const panel = refs.partialErrorsPanel;
  if (!panel) return;
  panel.textContent = '';
  const total = entryErrors.length + parseErrors.length;
  if (total === 0) {
    panel.hidden = true;
    panel.style.display = 'none';

    return;
  }
  const header = document.createElement('div');
  header.style.cssText = 'font-weight:600;margin-bottom:6px;';
  header.textContent = 'Partial import: ' + String(total) + ' entr' + (total === 1 ? 'y' : 'ies') + ' failed';
  panel.appendChild(header);

  const details = document.createElement('details');
  details.open = total <= 5;
  const summary = document.createElement('summary');
  summary.style.cssText = 'cursor:pointer;margin-bottom:6px;color:#f5b7b7;';
  summary.textContent = details.open ? 'Hide details' : 'Show details';
  details.addEventListener('toggle', () => { summary.textContent = details.open ? 'Hide details' : 'Show details'; });
  details.appendChild(summary);

  const list = document.createElement('ul');
  list.dataset.testid = 'library-import-partial-errors-list';
  list.style.cssText = ['margin:0', 'padding:0 0 0 18px', 'max-height:180px', 'overflow-y:auto', 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace', 'font-size:11.5px'].join(';');
  const appendRow = (source: ImportErrorSourceType, message: string): void => {
    const li = document.createElement('li');
    li.style.cssText = 'margin:2px 0;white-space:pre-wrap;word-break:break-word;';
    const tag = document.createElement('span');
    tag.textContent = source === 'parse' ? '[parse] ' : '[entry] ';
    tag.style.cssText = 'color:#f5b7b7;font-weight:600;';
    li.appendChild(tag);
    li.appendChild(document.createTextNode(message));
    list.appendChild(li);
  };
  for (const m of parseErrors) appendRow('parse', m);
  for (const m of entryErrors) appendRow('entry', m);
  details.appendChild(list);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = 'Dismiss';
  dismiss.dataset.testid = 'library-import-partial-errors-dismiss';
  dismiss.style.cssText = ['margin-top:8px', 'padding:4px 10px', 'background:#3a2530', 'color:#f2c9c9', 'border:1px solid #6b2b3a', CSS_BORDER_RADIUS_6, CSS_CURSOR_POINTER, 'font-size:11.5px'].join(';');
  dismiss.addEventListener('click', () => { clearPartialImportErrors(refs); });

  panel.appendChild(details);
  panel.appendChild(dismiss);
  panel.hidden = false;
  panel.style.display = 'block';
}

export function clearPartialImportErrors(refs: ModalRefs): void {
  const panel = refs.partialErrorsPanel;
  if (!panel) return;
  panel.textContent = '';
  panel.hidden = true;
  panel.style.display = 'none';
}

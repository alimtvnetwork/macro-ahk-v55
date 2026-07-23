/**
 * Next Selector Control (v4.170.5)
 *
 * A compact "▶ Next: [dropdown ▾] [✎]" widget hosted on the Repeat strip so
 * the user can pick which Next-role prompt is the active default and edit it
 * inline, right where they set the repeat count. The dropdown reflects the
 * `Prompt` table for role='next' and writes selections back via
 * `setDefaultPromptForRole`, which is exactly what `stageNextPrompt` reads
 * from at chip-click time. No hidden state, no duplicate source of truth.
 *
 * Failure mode: every DB call is wrapped in try/catch and errors are logged
 * through `logError('NextSelector', ...)`. The widget stays mounted even if
 * the DB read fails; it renders an inline "(unavailable)" hint so the user
 * still sees why the control is inert (guideline 33).
 */

import { log } from '../logger';
import { logError } from '../error-utils';
import { showPasteToast } from './prompt-utils';
import { cPanelFg, cPrimaryLight } from '../shared-state';
import { listPromptsByRole, setDefaultPromptForRole, type PromptRow } from '../db/prompt-db';
import { openPromptEditor } from './prompt-editor';

const CSS_SELECT =
  'padding:2px 4px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.4);'
  + 'border-radius:4px;color:' + cPanelFg + ';font:11px system-ui,-apple-system,sans-serif;'
  + 'cursor:pointer;max-width:180px;';
const CSS_EDIT_BTN =
  'padding:2px 6px;background:rgba(124,58,237,0.25);border:1px solid rgba(124,58,237,0.5);'
  + 'border-radius:4px;color:' + cPanelFg + ';cursor:pointer;font-size:11px;line-height:1.4;';
const CSS_LABEL = 'font-weight:600;color:' + cPrimaryLight + ';flex:0 0 auto;';
const CSS_HINT = 'font-size:10px;opacity:0.7;color:' + cPanelFg + ';';

interface RenderRefs {
  select: HTMLSelectElement;
  editBtn: HTMLButtonElement;
  hint: HTMLSpanElement;
}

async function populate(refs: RenderRefs): Promise<void> {
  refs.select.innerHTML = '';
  refs.hint.textContent = '';
  refs.select.disabled = true;
  refs.editBtn.disabled = true;

  let rows: PromptRow[] = [];
  try {
    const listed = await listPromptsByRole('next');
    if (!listed.ok) {
      logError('NextSelector', 'listPromptsByRole failed', new Error(listed.error ?? 'list failed'));
      refs.hint.textContent = '(unavailable)';
      return;
    }
    rows = listed.value ?? [];
  } catch (err) {
    logError('NextSelector', 'listPromptsByRole threw', err);
    refs.hint.textContent = '(unavailable)';
    return;
  }

  if (rows.length === 0) {
    refs.hint.textContent = '(no prompts)';
    return;
  }

  for (const row of rows) {
    const opt = document.createElement('option');
    opt.value = String(row.Id);
    const marker = row.IsDefault ? '★ ' : '';
    opt.textContent = marker + row.Name;
    if (row.IsDefault) opt.selected = true;
    refs.select.appendChild(opt);
  }
  refs.select.disabled = false;
  refs.editBtn.disabled = false;
}

async function onSelectionChanged(refs: RenderRefs): Promise<void> {
  const raw = refs.select.value;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) return;
  try {
    const result = await setDefaultPromptForRole(id, 'next');
    if (!result.ok) {
      logError('NextSelector', 'setDefaultPromptForRole failed', new Error(result.error ?? 'set default failed'));
      showPasteToast('❌ Could not switch Next prompt', true);
      return;
    }
    log('NextSelector: default next prompt set to Id=' + id, 'info');
    showPasteToast('▶ Next prompt switched', false);
    await populate(refs);
  } catch (err) {
    logError('NextSelector', 'setDefaultPromptForRole threw', err);
    showPasteToast('❌ Could not switch Next prompt', true);
  }
}

async function onEditClicked(refs: RenderRefs): Promise<void> {
  const raw = refs.select.value;
  const id = Number.parseInt(raw, 10);
  try {
    if (Number.isFinite(id) && id > 0) {
      await openPromptEditor({ role: 'next', promptId: id });
    } else {
      await openPromptEditor({ role: 'next' });
    }
    // Refresh names/labels in case the user renamed the prompt.
    await populate(refs);
  } catch (err) {
    logError('NextSelector', 'openPromptEditor threw', err);
    showPasteToast('❌ Prompt editor failed to open', true);
  }
}

/**
 * Build the widget. The returned element is a self-contained inline group
 * that the caller (typically `repeat-loop-ui.ts`) drops into its row.
 */
export function buildNextSelectorControl(): HTMLElement {
  const wrap = document.createElement('span');
  wrap.dataset.role = 'next-selector';
  wrap.style.cssText = 'display:inline-flex;align-items:center;gap:4px;flex:0 0 auto;';

  const label = document.createElement('span');
  label.textContent = '▶ Next:';
  label.style.cssText = CSS_LABEL;
  wrap.appendChild(label);

  const select = document.createElement('select');
  select.title = 'Choose which Next prompt to stage from the ▶ Next chips';
  select.style.cssText = CSS_SELECT;
  select.dataset.role = 'next-selector-select';
  wrap.appendChild(select);

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.title = 'Edit the selected Next prompt';
  editBtn.textContent = '✎';
  editBtn.style.cssText = CSS_EDIT_BTN;
  editBtn.dataset.role = 'next-selector-edit';
  wrap.appendChild(editBtn);

  const hint = document.createElement('span');
  hint.style.cssText = CSS_HINT;
  hint.dataset.role = 'next-selector-hint';
  wrap.appendChild(hint);

  const refs: RenderRefs = { select, editBtn, hint };

  select.addEventListener('change', function () { void onSelectionChanged(refs); });
  editBtn.addEventListener('click', function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    void onEditClicked(refs);
  });

  void populate(refs);
  return wrap;
}

/** Test-only helpers. */
export const __testables = { populate, onSelectionChanged, onEditClicked };

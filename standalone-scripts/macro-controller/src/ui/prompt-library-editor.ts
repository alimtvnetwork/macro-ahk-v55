import { ServiceResult } from '../utils/result-wrapper';
import { logError } from '../error-utils';
import { log } from '../logger';
import { type PromptRow, upsertPrompt } from '../db/prompt-db';
import { REPLACE_KEY_DEFAULT, REPLACE_VALUES_DEFAULT } from '../db/prompt-defaults';
import { ModalRefs, LOG_SCOPE, CSS_BORDER_RADIUS_6, CSS_CURSOR_POINTER } from './prompt-library-types';
import { buildTokenRow, buildValuesRow } from './prompt-library-token-inputs';

export interface EditorEls {
  wrap: HTMLDivElement;
  nameInput: HTMLInputElement;
  bodyInput: HTMLTextAreaElement;
  tokenInput: HTMLInputElement;
  tokenPreview: HTMLSpanElement;
  tokenError: HTMLSpanElement;
  valuesInput: HTMLInputElement;
  valuesError: HTMLSpanElement;
  saveBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
}

function btnCss(bg: string, fg: string): string {
  return [
    'background:' + bg, 'color:' + fg,
    'border:1px solid #3a465c', CSS_BORDER_RADIUS_6,
    'padding:4px 10px', 'font-size:11px', CSS_CURSOR_POINTER,
    'margin-left:6px',
  ].join(';');
}

export function buildEditorEl(row: PromptRow): EditorEls {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:8px 4px;border-top:1px solid #1c2536;background:#0b1220;';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = row.Name;
  nameInput.style.cssText = 'width:100%;box-sizing:border-box;background:#0f1522;color:#e6edf7;border:1px solid #2b3648;border-radius:6px;padding:4px 6px;font-size:12px;margin-bottom:6px;';
  const tokenEls = buildTokenRow((row as PromptRow & { ReplaceKey?: string }).ReplaceKey ?? REPLACE_KEY_DEFAULT);
  const initialValues = (row as PromptRow & { ReplaceValues?: string[] }).ReplaceValues ?? [...REPLACE_VALUES_DEFAULT];
  const valuesEls = buildValuesRow(initialValues);
  const bodyInput = document.createElement('textarea');
  bodyInput.value = row.Body;
  bodyInput.rows = 10;
  bodyInput.style.cssText = 'width:100%;box-sizing:border-box;background:#0f1522;color:#e6edf7;border:1px solid #2b3648;border-radius:6px;padding:6px;font-family:ui-monospace,monospace;font-size:11px;white-space:pre;';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;justify-content:flex-end;margin-top:6px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = btnCss('#2b3648', '#e6edf7');
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = btnCss('#2f4a2f', '#d6f5d6');
  bar.appendChild(cancelBtn); bar.appendChild(saveBtn);
  wrap.appendChild(nameInput); wrap.appendChild(tokenEls.row); wrap.appendChild(valuesEls.row); wrap.appendChild(bodyInput); wrap.appendChild(bar);

  return {
    wrap, nameInput, bodyInput,
    tokenInput: tokenEls.input, tokenPreview: tokenEls.preview, tokenError: tokenEls.error,
    valuesInput: valuesEls.input, valuesError: valuesEls.error,
    saveBtn, cancelBtn,
  };
}

export interface EditSavePayload {
  name: string;
  body: string;
  replaceKey: string;
  replaceValues: string[];
}

export async function handleEditSave(refs: ModalRefs, row: PromptRow, payload: EditSavePayload, renderAllRoles: (r: ModalRefs) => Promise<void>): Promise<void> {
  refs.status.textContent = 'Saving: ' + row.Slug + ' ...';
  try {
    const res = await upsertPrompt({
      id: row.Id, slug: row.Slug,
      name: payload.name, body: payload.body,
      role: row.Role,
      previousBody: row.Body,
      previousReplaceKey: row.ReplaceKey,
      replaceKey: payload.replaceKey,
      replaceValues: payload.replaceValues,
    });
    if (res.isFail) {
      refs.status.textContent = 'Save failed: ' + (res.error ?? 'unknown');
      logError(LOG_SCOPE, 'edit save failed', res);

      return;
    }

    log('PromptLibraryModal: edited id=' + row.Id + ' slug=' + row.Slug + ' key=' + payload.replaceKey + ' values=' + payload.replaceValues.length, 'info');
    await renderAllRoles(refs);
  } catch (err) {
    logError(LOG_SCOPE, 'edit save threw', err);
    refs.status.textContent = 'Save threw. See console.';
  }
}

export function openInlineEditor(refs: ModalRefs, rowEl: HTMLElement, row: PromptRow, renderAllRoles: (r: ModalRefs) => Promise<void>): void {
  const ed = buildEditorEl(row);
  rowEl.replaceWith(ed.wrap);
  const cancel = (): void => {
    refs.activeEditor = null; void renderAllRoles(refs); 
  };

  const save = (): void => {
    if (ed.tokenError.textContent) {
      refs.status.textContent = 'Invalid Token: ' + ed.tokenError.textContent;
      ed.tokenInput.focus();

      return;
    }

    if (ed.valuesError.textContent) {
      refs.status.textContent = 'Invalid N options: ' + ed.valuesError.textContent;
      ed.valuesInput.focus();

      return;
    }

    const parsedValues = ed.valuesInput.value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    void handleEditSave(refs, row, {
      name: ed.nameInput.value,
      body: ed.bodyInput.value,
      replaceKey: ed.tokenInput.value.trim(),
      replaceValues: parsedValues,
    }, renderAllRoles);
  };

  ed.cancelBtn.addEventListener('click', cancel);
  ed.saveBtn.addEventListener('click', save);
  refs.activeEditor = { row, save, cancel };
  ed.bodyInput.focus();
}

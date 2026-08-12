import type { PromptRow } from '../db/prompt-db';
import { getSeedBodyForSlug } from '../seed/plan-next-prompts';
import { openPromptEditor } from './prompt-editor';
import { ModalRefs, PREVIEW_MAX_CHARS, CSS_BORDER_RADIUS_6, CSS_CURSOR_POINTER } from './prompt-library-types';
import { handleSetDefault, handleDuplicate, handleDelete, handleResetToDefault } from './prompt-library-actions';
import { openInlineEditor } from './prompt-library-editor';

const HSL_FOREGROUND = 'hsl(var(--foreground))';
const HSL_MUTED = 'hsl(var(--muted))';

function btnCss(bg: string, fg: string): string {
  return [
    'background:' + bg, 'color:' + fg,
    'border:1px solid hsl(var(--border))', CSS_BORDER_RADIUS_6,
    'padding:4px 10px', 'font-size:11px', CSS_CURSOR_POINTER,
    'margin-left:6px',
  ].join(';');
}

export function buildRowLeft(refs: ModalRefs, row: PromptRow, container: HTMLElement, renderAllRoles: (r: ModalRefs) => Promise<void>): HTMLElement {
  const left = document.createElement('div');
  left.style.cssText = 'flex:1;min-width:0;padding-right:8px;cursor:pointer;';
  left.title = 'Click to toggle body preview';
  left.addEventListener('click', () => {
    togglePreview(refs, row, container, renderAllRoles); 
  });
  const isExpanded = refs.view.expandedIds.has(row.Id);
  const caret = isExpanded ? '▾ ' : '▸ ';
  const name = document.createElement('div');
  name.textContent = caret + (row.IsDefault ? '★ ' : '') + row.Name;
  name.style.cssText = 'font-weight:' + (row.IsDefault ? '600' : '400') + ';color:' + (row.IsDefault ? 'hsl(var(--warning))' : HSL_FOREGROUND) + ';';
  const slug = document.createElement('div');
  slug.textContent = row.Slug + '  ·  ' + row.Body.length + ' chars';
  slug.style.cssText = 'font-size:10px;color:hsl(var(--muted-foreground));margin-top:2px;';
  left.appendChild(name);
  left.appendChild(slug);

  return left;
}

export function buildRowRight(refs: ModalRefs, row: PromptRow, rowEl: HTMLElement, renderAllRoles: (r: ModalRefs) => Promise<void>): HTMLElement {
  const right = document.createElement('div');
  right.style.cssText = 'display:flex;flex-shrink:0;';

  const setDefaultBtn = document.createElement('button');
  setDefaultBtn.textContent = row.IsDefault ? 'Default' : 'Set default';
  setDefaultBtn.disabled = row.IsDefault === 1;
  setDefaultBtn.style.cssText = btnCss(row.IsDefault ? 'hsl(var(--primary))' : HSL_MUTED, HSL_FOREGROUND) + ';opacity:' + (row.IsDefault ? '0.6' : '1') + ';cursor:' + (row.IsDefault ? 'default' : 'pointer');
  setDefaultBtn.addEventListener('click', () => {
    void handleSetDefault(refs, row, renderAllRoles); 
  });

  const dupBtn = document.createElement('button');
  dupBtn.textContent = 'Duplicate';
  dupBtn.style.cssText = btnCss(HSL_MUTED, HSL_FOREGROUND);
  dupBtn.addEventListener('click', () => {
    void handleDuplicate(refs, row, renderAllRoles); 
  });

  const editBtn = document.createElement('button');
  editBtn.textContent = 'Edit';
  editBtn.title = 'Inline edit: rename or tweak body without leaving the library';
  editBtn.style.cssText = btnCss(HSL_MUTED, HSL_FOREGROUND);
  editBtn.addEventListener('click', () => {
    openInlineEditor(refs, rowEl, row, renderAllRoles); 
  });

  const quickEditBtn = document.createElement('button');
  quickEditBtn.textContent = 'Full editor';
  quickEditBtn.title = 'Open the full drift-guarded editor (shared with chip gears)';
  quickEditBtn.style.cssText = btnCss(HSL_MUTED, HSL_FOREGROUND);
  quickEditBtn.addEventListener('click', () => {
    void openPromptEditor({ role: row.Role, promptId: row.Id }); 
  });

  const delBtn = document.createElement('button');
  delBtn.textContent = 'Delete';
  delBtn.style.cssText = btnCss('hsl(var(--destructive))', 'hsl(var(--destructive))');
  delBtn.addEventListener('click', () => {
    void handleDelete(refs, row, renderAllRoles); 
  });

  const seedBody = getSeedBodyForSlug(row.Slug);
  const canReset = seedBody !== null && seedBody !== row.Body;

  right.appendChild(setDefaultBtn);
  right.appendChild(editBtn);
  right.appendChild(quickEditBtn);
  right.appendChild(dupBtn);
  if (canReset) {
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '↺ Reset';
    resetBtn.title = 'Restore this seeded prompt to its shipped default body';
    resetBtn.style.cssText = btnCss(HSL_MUTED, 'hsl(var(--warning))');
    resetBtn.addEventListener('click', () => {
      void handleResetToDefault(refs, row, renderAllRoles); 
    });
    right.appendChild(resetBtn);
  }

  right.appendChild(delBtn);

  return right;
}

export function buildRowEl(refs: ModalRefs, row: PromptRow, container: HTMLElement, renderAllRoles: (r: ModalRefs) => Promise<void>): HTMLElement {
  const rowEl = document.createElement('div');
  rowEl.dataset.promptId = String(row.Id);
  rowEl.dataset.promptSlug = row.Slug;
  rowEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 4px;border-top:1px solid hsl(var(--background));font-size:12px;';
  rowEl.appendChild(buildRowLeft(refs, row, container, renderAllRoles));
  rowEl.appendChild(buildRowRight(refs, row, rowEl, renderAllRoles));

  return rowEl;
}

export function buildPreviewEl(row: PromptRow): HTMLElement {
  const pre = document.createElement('pre');
  pre.dataset.testid = 'row-preview';
  pre.dataset.promptId = String(row.Id);
  const body = row.Body.length > PREVIEW_MAX_CHARS ? row.Body.slice(0, PREVIEW_MAX_CHARS) + ' ...(+' + (row.Body.length - PREVIEW_MAX_CHARS) + ' chars)' : row.Body;
  pre.textContent = body;
  pre.style.cssText = 'margin:0 4px 6px 4px;padding:6px 8px;background:hsl(var(--background));color:hsl(var(--foreground));border:1px solid hsl(var(--background));border-radius:6px;font-family:ui-monospace,monospace;font-size:10px;white-space:pre-wrap;max-height:180px;overflow:auto;';

  return pre;
}

export function buildRowContainer(refs: ModalRefs, row: PromptRow, renderAllRoles: (r: ModalRefs) => Promise<void>): HTMLElement {
  const container = document.createElement('div');
  container.dataset.promptContainer = String(row.Id);
  container.appendChild(buildRowEl(refs, row, container, renderAllRoles));
  if (refs.view.expandedIds.has(row.Id)) {
    container.appendChild(buildPreviewEl(row));
  }

  return container;
}

export function togglePreview(refs: ModalRefs, row: PromptRow, container: HTMLElement, renderAllRoles: (r: ModalRefs) => Promise<void>): void {
  const isOpen = refs.view.expandedIds.has(row.Id);
  if (isOpen) {
    refs.view.expandedIds.delete(row.Id);
  } else {
    refs.view.expandedIds.add(row.Id);
  }

  const fresh = buildRowContainer(refs, row, renderAllRoles);
  container.replaceWith(fresh);
}

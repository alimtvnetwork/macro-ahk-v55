import { ServiceResult } from '../utils/result-wrapper';
import { logError } from '../error-utils';
import { type PromptRow, listPromptsByRole } from '../db/prompt-db';
import type { PromptRole } from '../types/prompt-role';
import { ModalRefs, ROLES, ROLE_TOOLTIPS, SortMode, LOG_SCOPE } from './prompt-library-types';
import { buildRowContainer } from './prompt-library-row';

export function rolesToRender(view: ModalRefs['view']): PromptRole[] {
  if (view.filterRole === 'all') return ROLES;

  return [view.filterRole];
}

export function sortRows(rows: readonly PromptRow[], mode: SortMode): PromptRow[] {
  const copy = rows.slice();
  if (mode === 'name') return copy.sort((a, b) => a.Name.localeCompare(b.Name));
  if (mode === 'length') return copy.sort((a, b) => b.Body.length - a.Body.length);

  return copy.sort((a, b) => (b.IsDefault - a.IsDefault) || a.Name.localeCompare(b.Name));
}

export async function renderAllRoles(refs: ModalRefs): Promise<void> {
  refs.activeEditor = null;
  refs.body.replaceChildren();
  refs.status.textContent = 'Loading...';
  try {
    const roles = rolesToRender(refs.view);
    for (const role of roles) {
      const section = await buildRoleSection(refs, role, renderAllRoles);
      refs.body.appendChild(section);
    }
    refs.status.textContent = 'Loaded (' + refs.view.filterRole + ', sort=' + refs.view.sortMode + ').';
  } catch (err) {
    logError(LOG_SCOPE, 'renderAllRoles failed', err);
    refs.status.textContent = 'Error loading prompts. See console.';
  }
}

export async function buildRoleSection(refs: ModalRefs, role: PromptRole, refreshAllRoles: (r: ModalRefs) => Promise<void>): Promise<HTMLElement> {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin:10px 0 14px;border:1px solid #2b3648;border-radius:8px;padding:8px 10px;background:#0f1522;';
  const h = document.createElement('div');
  h.textContent = 'Role: ' + role;
  h.title = ROLE_TOOLTIPS[role];
  h.setAttribute('aria-label', 'Role: ' + role + '. ' + ROLE_TOOLTIPS[role]);
  h.style.cssText = 'font-size:12px;font-weight:600;color:#c9b7ff;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;cursor:help;';
  wrap.appendChild(h);

  const result = await listPromptsByRole(role);
  if (!result.isSuccess || !result.value) {
    const err = document.createElement('div');
    err.textContent = 'Load error: ' + (result.error ?? 'unknown');
    err.style.cssText = 'color:#f5a3a3;font-size:11px;';
    wrap.appendChild(err);

    return wrap;
  }
  const rows = result.value;
  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = '(no rows)';
    empty.style.cssText = 'color:#7a8699;font-size:11px;font-style:italic;';
    wrap.appendChild(empty);

    return wrap;
  }
  const sortedRows = sortRows(rows, refs.view.sortMode);
  for (const row of sortedRows) wrap.appendChild(buildRowContainer(refs, row, refreshAllRoles));

  return wrap;
}

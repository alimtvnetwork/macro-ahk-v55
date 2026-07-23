/**
 * Inline chip gear menu (Plan-23, step 3).
 *
 * A small ⚙ button that sits next to the "📋 Plan" / "▶ Next" labels in
 * the inline strips above the chat box, and opens a floating menu with:
 *   - Edit default prompt
 *   - Add new prompt for this role
 *   - Manage all prompts (opens the Library modal)
 *
 * Root cause it fixes: issue 04 — per-chip editing had no entry point on
 * the strip itself, forcing users into the Library modal. This helper is
 * shared by `next-inline-ui.ts` so both strips use the SAME menu contract.
 */

import type { PromptRole } from '../types/prompt-role';
import { VERSION } from '../shared-state';
import { openDefaultPromptEditor, openPromptEditor } from './prompt-editor';
import { openPromptHistoryPanel } from './prompt-history-panel';
import { logDiagnosticFromCode, toErrorMessage } from '../error-utils';
import type { DiagnosticContext } from '../errors/diagnostic-error';
import { showToast } from '../toast';
import { reseedPromptsOnDemand } from '../seed/reseed-command';
import { runPromptHealthCheckWithAutoRepair } from '../seed/prompt-health-auto-repair';
import { pickPromptFromRole } from './chip-gear-picker';
import { setDefaultPromptForRole, deletePromptById } from '../db/prompt-db';
import { exportPromptsToJson } from './prompt-io';

/**
 * Plan 26 step 9: coded diagnostic toast helper for chip-gear actions. Keeps
 * the friendly toast sentence, appends `[code=X]` so users can copy it into
 * bug reports, and routes structured context to the SDK logger via
 * `logDiagnosticFromCode` so the diagnostics ZIP indexes it.
 */
function reportGearFailure(
  code: string,
  context: DiagnosticContext,
  userSentence: string,
  cause?: unknown,
): void {
  logDiagnosticFromCode(code, context, cause);
  showToast(userSentence + '  [code=' + code + ']', 'error');
}

interface GearMenuItem {
  icon: string;
  label: string;
  onSelect: () => void;
}

const SUBMENU_MIN_WIDTH = 226;

function buildPromptActionItems(role: PromptRole, label: string): GearMenuItem[] {
  return [
    { icon: '✎', label: 'Edit default', onSelect: () => wrapAction('editDefault', role, () => openDefaultPromptEditor(role)) },
    { icon: '▣', label: 'Edit specific', onSelect: () => wrapAction('editSpecific', role, () => editSpecific(role, label)) },
    { icon: '★', label: 'Set active', onSelect: () => wrapAction('setActive', role, () => setActive(role, label)) },
    { icon: '+', label: 'Add new', onSelect: () => wrapAction('addNew', role, () => openPromptEditor({ role })) },
    { icon: '⌫', label: 'Delete custom', onSelect: () => wrapAction('deleteCustom', role, () => deleteCustom(role, label)) },
    { icon: '↺', label: 'History', onSelect: () => wrapAction('history', role, () => openPromptHistoryPanel({ role })) },
    { icon: '▤', label: 'Prompt Library', onSelect: () => wrapAction('manageLibrary', role, () => openLibraryModal()) },
    { icon: '⇩', label: 'Export JSON', onSelect: () => wrapAction('exportRole', role, () => exportPromptsToJson()) },
    { icon: '↻', label: 'Re-seed defaults', onSelect: () => wrapAction('reseed', role, () => runReseedAndOpen(role, false)) },
    { icon: '◆', label: 'Repair prompts', onSelect: () => wrapAction('repair', role, () => runRepairAndOpen(role)) },
    { icon: '!', label: 'Force reset defaults', onSelect: () => wrapAction('reseedForce', role, () => runReseedAndOpen(role, true)) },
    { icon: '◫', label: 'Seed diagnostics', onSelect: () => wrapAction('seedDiag', role, () => openSeedDiagnostics()) },
  ];
}

async function openSeedDiagnostics(): Promise<void> {
  const { openSeedDiagnosticsPanel } = await import('./seed-diagnostics-panel');
  openSeedDiagnosticsPanel();
}

function positionPromptActionsSubmenu(submenu: HTMLElement, trigger: HTMLElement): void {
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  const gap = 4;
  const prevDisplay = submenu.style.display;
  const prevVisibility = submenu.style.visibility;
  submenu.style.display = 'flex';
  submenu.style.visibility = 'hidden';
  const width = Math.max(SUBMENU_MIN_WIDTH, submenu.offsetWidth || SUBMENU_MIN_WIDTH);
  const height = submenu.offsetHeight || 240;
  const hasRightRoom = rect.right + gap + width + margin <= window.innerWidth;
  const left = hasRightRoom
    ? rect.right + gap
    : Math.max(margin, rect.left - gap - width);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  const top = Math.min(Math.max(margin, rect.top - 2), maxTop);
  submenu.style.left = String(Math.round(left)) + 'px';
  submenu.style.top = String(Math.round(top)) + 'px';
  submenu.style.visibility = prevVisibility;
  submenu.style.display = prevDisplay;
}

function setSubmenuOpen(submenu: HTMLElement, trigger: HTMLButtonElement, open: boolean): void {
  if (open) {
    submenu.hidden = false;
    positionPromptActionsSubmenu(submenu, trigger);
    submenu.style.display = 'flex';
  } else {
    submenu.style.display = 'none';
    submenu.hidden = true;
  }
  trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function buildPromptActionRow(item: GearMenuItem, role: PromptRole): HTMLButtonElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.style.cssText = 'width:100%;display:grid;grid-template-columns:16px minmax(0,1fr);align-items:center;gap:6px;padding:3px 7px;cursor:pointer;font-size:10.5px;line-height:1.25;color:#e5e7eb;border:0;background:transparent;border-radius:4px;text-align:left;font-family:inherit;';
  const icon = document.createElement('span');
  icon.textContent = item.icon;
  icon.style.cssText = 'width:16px;text-align:center;font-size:11px;line-height:1;';
  const label = document.createElement('span');
  label.textContent = item.label;
  label.style.cssText = 'min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  row.append(icon, label);
  row.onmouseover = () => { row.style.background = 'rgba(124,58,237,0.25)'; };
  row.onmouseout = () => { row.style.background = 'transparent'; };
  row.onclick = (event: Event) => {
    event.stopPropagation();
    item.onSelect();
  };
  row.dataset.role = role + '-prompt-action';
  return row;
}

function buildPromptActionsTrigger(input: BuildChipGearButtonInput, label: string): HTMLButtonElement {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.textContent = '⚙ ' + label + ' prompts  ›';
  trigger.title = label + ' prompt actions, Marco v' + VERSION;
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 7px;cursor:pointer;font-size:10.5px;font-weight:700;line-height:1.25;color:' + input.accent + ';border:0;background:rgba(255,255,255,0.04);border-radius:4px;text-align:left;font-family:inherit;';
  return trigger;
}

function buildPromptActionsSubmenu(
  input: BuildChipGearButtonInput,
  label: string,
  role: PromptRole,
  items: readonly GearMenuItem[],
): HTMLElement {
  const submenu = document.createElement('div');
  submenu.hidden = true;
  submenu.setAttribute('role', 'menu');
  submenu.setAttribute('aria-label', label + ' prompt actions');
  submenu.style.cssText = 'position:fixed;display:none;flex-direction:column;gap:1px;padding:5px;background:#1a1a2e;border:1px solid ' + input.accent + ';border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.55);z-index:2147483647;min-width:' + String(SUBMENU_MIN_WIDTH) + 'px;max-width:280px;';
  submenu.dataset.role = role + '-prompt-actions-submenu';
  for (const item of items) submenu.appendChild(buildPromptActionRow(item, role));
  return submenu;
}

function wirePromptActionsSubmenu(trigger: HTMLButtonElement, submenu: HTMLElement): void {
  let closeTimer: number | null = null;
  const clearCloseTimer = (): void => {
    if (closeTimer === null) return;
    window.clearTimeout(closeTimer);
    closeTimer = null;
  };
  const open = (): void => {
    clearCloseTimer();
    setSubmenuOpen(submenu, trigger, true);
  };
  const scheduleClose = (): void => {
    clearCloseTimer();
    closeTimer = window.setTimeout(() => setSubmenuOpen(submenu, trigger, false), 160);
  };
  trigger.onmouseenter = open;
  trigger.onmouseleave = scheduleClose;
  trigger.onfocus = open;
  trigger.onclick = (event: Event) => {
    event.stopPropagation();
    setSubmenuOpen(submenu, trigger, submenu.style.display !== 'flex');
  };
  trigger.onkeydown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
      submenu.querySelector<HTMLButtonElement>('button')?.focus();
    }
    if (event.key === 'Escape') setSubmenuOpen(submenu, trigger, false);
  };
  submenu.onmouseenter = open;
  submenu.onmouseleave = scheduleClose;
  submenu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setSubmenuOpen(submenu, trigger, false);
      trigger.focus();
    }
  });
}

export interface BuildChipGearButtonInput {
  role: PromptRole;
  /** Human-facing role label, e.g. "Plan" or "Next". */
  roleLabel: string;
  /** Color used for the button glyph — matches the strip's accent. */
  accent: string;
}

/**
 * Build the shared prompt-management action rows (Edit default / Add new /
 * Manage) intended to be injected at the TOP of the "More" popover on both
 * the Plan and Next inline strips. Returns a section element that already
 * contains a heading label + rows + a trailing divider — callers just
 * `popover.appendChild(section)` before the numeric chip grid.
 */
export function buildChipGearActionSection(input: BuildChipGearButtonInput): HTMLElement {
  const section = document.createElement('div');
  section.dataset.role = 'chip-gear-actions';
  section.style.cssText = 'grid-column:1 / -1;position:relative;display:flex;flex-direction:column;gap:2px;padding:2px 2px 6px 2px;border-bottom:1px solid rgba(148,163,184,0.25);margin-bottom:6px;';

  const label = input.roleLabel;
  const role = input.role;
  const items = buildPromptActionItems(role, label);
  const trigger = buildPromptActionsTrigger(input, label);
  const submenu = buildPromptActionsSubmenu(input, label, role, items);
  wirePromptActionsSubmenu(trigger, submenu);

  section.append(trigger, submenu);
  return section;
}

function wrapAction(name: string, role: PromptRole, action: () => Promise<void> | void): void {
  const handleFailure = (rejectionType: 'threw' | 'rejected', err: unknown): void => {
    reportGearFailure(
      'UI_ACTION_E001',
      { actionName: name, role, rejectionType, reason: toErrorMessage(err) },
      '❌ Action "' + name + '" failed',
      err,
    );
  };
  try {
    const r = action();
    if (r && typeof (r as Promise<void>).catch === 'function') {
      (r as Promise<void>).catch((err: unknown) => { handleFailure('rejected', err); });
    }
  } catch (err) {
    handleFailure('threw', err);
  }
}


interface PromptLibraryModule {
  openPromptLibraryModal?: () => void;
  openPromptLibrary?: () => void;
  default?: () => void;
}

async function openLibraryModal(): Promise<void> {
  try {
    const mod: PromptLibraryModule = await import('./prompt-library-modal');
    // The module exports a single opener; fall back to any of the common names.
    const opener = mod.openPromptLibraryModal ?? mod.openPromptLibrary ?? mod.default;
    if (typeof opener !== 'function') {
      reportGearFailure(
        'PROMPT_IO_E001',
        { op: 'resolveOpener', reason: 'prompt-library-modal exposes no known opener export' },
        '❌ Prompt Library unavailable',
      );
      return;
    }
    opener();
  } catch (err) {
    reportGearFailure(
      'PROMPT_IO_E001',
      { op: 'importModule', reason: toErrorMessage(err) },
      '❌ Prompt Library failed to open',
      err,
    );
  }
}

async function runReseedAndOpen(role: PromptRole, force: boolean): Promise<void> {
  if (force) {
    const ok = window.confirm(
      'Force reset will overwrite the "plan-default" and "next-default" prompt bodies with the shipped canonical text. '
      + 'Any edits you made to those two rows will be lost. Custom prompts you added are untouched.\n\nProceed?'
    );
    if (!ok) return;
  }
  showToast(force ? '⚠️ Forcing default reset…' : '🔄 Re-seeding defaults…', 'info');
  const result = await reseedPromptsOnDemand({ force });
  if (!result.ok) {
    const reason = result.error ?? 'unknown';
    reportGearFailure(
      'SEED_RESEED_E001',
      { force, role, reason },
      '❌ Re-seed failed: ' + reason,
    );
    return;
  }
  const suffix = force && typeof result.forcedUpdates === 'number'
    ? ' (' + String(result.forcedUpdates) + ' rows reset)'
    : '';
  showToast('✅ Prompt defaults re-seeded' + suffix + ' — opening default row', 'success');
  await openDefaultPromptEditor(role);
}

/**
 * Repair action: reruns the DB auto-repair logic (idempotent reseed +
 * verification probe), then opens the (restored) default DB row for the
 * given role in the editor so the user can immediately inspect it.
 */
async function runRepairAndOpen(role: PromptRole): Promise<void> {
  showToast('🩹 Repairing prompts…', 'info');
  const startedAt = Date.now();
  const result = await runPromptHealthCheckWithAutoRepair();
  const { buildRepairReport, stashRepairReport, showRepairReportModal } = await import('./repair-report-modal');
  const report = buildRepairReport(result);
  stashRepairReport(report);
  if (!result.isHealthy) {
    const durationMs = Date.now() - startedAt;
    reportGearFailure(
      'REPAIR_RUN_E001',
      {
        role,
        fixed: report.fixed.length,
        stillBroken: report.stillBroken.length,
        newlyFlagged: report.newlyFlagged.length,
        durationMs,
      },
      '⚠️ Repair incomplete: ' + report.fixed.length + ' fixed, ' + report.stillBroken.length + ' still broken. See report',
    );
  } else if (result.repairAttempted) {
    showToast('✅ Repaired ' + report.fixed.length + ' issue(s) — opening default row', 'success');
  } else {
    showToast('✅ Prompts already healthy — opening default row', 'info');
  }
  showRepairReportModal(report);
  await openDefaultPromptEditor(role);
}

async function editSpecific(role: PromptRole, roleLabel: string): Promise<void> {
  const picked = await pickPromptFromRole({ role, roleLabel, title: 'Edit which ' + roleLabel + ' prompt?', confirmLabel: 'Edit' });
  if (!picked) return;
  await openPromptEditor({ role, promptId: picked.Id });
}

async function setActive(role: PromptRole, roleLabel: string): Promise<void> {
  const picked = await pickPromptFromRole({ role, roleLabel, title: 'Set active ' + roleLabel + ' prompt', confirmLabel: 'Set active' });
  if (!picked) return;
  if (picked.IsDefault === 1) { showToast('Already active', 'info'); return; }
  const res = await setDefaultPromptForRole(picked.Id, role);
  if (!res.ok) {
    const reason = res.error ?? 'unknown';
    reportGearFailure(
      'DB_WRITE_E003',
      { role, promptId: picked.Id, reason },
      '❌ Failed to set active ' + roleLabel + ' prompt: ' + reason,
    );
    return;
  }
  showToast('✅ Active ' + roleLabel + ' prompt: ' + picked.Name, 'success');
}

async function deleteCustom(role: PromptRole, roleLabel: string): Promise<void> {
  const picked = await pickPromptFromRole({ role, roleLabel, title: 'Delete which custom ' + roleLabel + ' prompt?', excludeDefault: true, confirmLabel: 'Delete' });
  if (!picked) return;
  const ok = window.confirm('Delete "' + picked.Name + '" (' + picked.Slug + ')?\n\nThis cannot be undone from here (use History to restore).');
  if (!ok) return;
  const res = await deletePromptById(picked.Id);
  if (!res.ok) {
    const reason = res.error ?? 'unknown';
    reportGearFailure(
      'DB_WRITE_E004',
      { promptId: picked.Id, name: picked.Name, reason },
      '❌ Delete "' + picked.Name + '" failed: ' + reason,
    );
    return;
  }
  showToast('🗑 Deleted "' + picked.Name + '"', 'success');
}

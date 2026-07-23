/**
 * Plan Task UI — Inline accordion mirror of Task Next, but injects a
 * "plan this task in N steps" prompt instead of running a multi-task loop.
 *
 * Single source of truth for the Plan Task prompt template.
 */

import { cPanelFg, cPrimary, cPrimaryLight, cBtnMenuHover, lDropdownRadius } from '../shared-state';
import { pasteIntoEditor, showPasteToast } from './prompt-utils';
import type { PromptContext } from './prompt-loader';
import { getPromptsConfig } from './prompt-loader';
import { getByXPath } from '../xpath-utils';
import { logError } from '../error-utils';
import { substituteToken } from '../utils/token-substitute';
import { REPLACE_KEY_DEFAULT } from '../db/prompt-defaults';
import { PLAN_DEFAULT_BODY } from '../seed/plan-next-prompts';

// Plan sequence (v3.63.0): increasing-gap progression requested by user 2026-06-19.
// 2,3,5,8,10,12,14,15,18,20,22,25,28,30,32,35,38,40,42,45,48,50,52,55,58,60,70,80,100,150,200
const PLAN_TASK_STEP_COUNTS = [
  2, 3, 5, 8, 10, 12, 14, 15, 18, 20,
  22, 25, 28, 30, 32, 35, 38, 40, 42, 45,
  48, 50, 52, 55, 58, 60, 70, 80, 100, 150, 200,
];

/**
 * Build the canonical Plan Task prompt for N steps by substituting `{{n}}`
 * in the shared `PLAN_DEFAULT_BODY` (single source of truth in
 * `seed/plan-next-prompts.ts`, mirrored from
 * `standalone-scripts/prompts/14-plan-steps/prompt.md`).
 */
export function buildPlanTaskPrompt(n: number): string {
  return PLAN_DEFAULT_BODY.split('{{n}}').join(String(n));
}

function adapterGetByXPath(xpath: string): Element | null {
  const node = getByXPath(xpath);
  return node instanceof Element ? node : null;
}

/**
 * Resolve the Plan prompt body. Step 15 of plan-14: prefer the user-editable
 * `plan-default` row from the Prompt table (with `{{n}}` substituted), and
 * fall back to `buildPlanTaskPrompt(n)` on any DB failure so the chip never
 * dies silently when the DB layer is unavailable (e.g. first-boot race).
 */
async function resolvePlanBody(n: number): Promise<string> {
  try {
    const mod = await import('../db/prompt-db');
    const result = await mod.getDefaultPromptForRole('plan');
    if (result.ok && result.value && typeof result.value.Body === 'string' && result.value.Body.length > 0) {
      const key = result.value.ReplaceKey || REPLACE_KEY_DEFAULT;
      return substituteToken(result.value.Body, key, n);
    }
    console.warn('[PlanTask] No plan-default row; falling back to hardcoded template');
  } catch (err) {
    logError('PlanTask', 'resolvePlanBody DB read failed; falling back to hardcoded template', err);
  }
  return buildPlanTaskPrompt(n);
}

function injectPlanPrompt(n: number): void {
  console.log('[PlanTask] Injecting plan prompt for ' + n + ' steps');
  void (async () => {
    const text = await resolvePlanBody(n);
    const outcome = await pasteIntoEditor(text, getPromptsConfig(), adapterGetByXPath, 'plan-chip');
    console.log('[PlanTask] Injection outcome: ' + outcome);
    // Success ('injected') and clipboard-fallback ('clipboard') already toast from prompt-utils.
    // Only show a caller-side toast on hard failure.
    if (String(outcome) === 'failed') showPasteToast('❌ Plan prompt: injection failed', true);
  })();
}

/** Render the Plan Task inline accordion into the container. */
export function renderPlanTaskSubmenu(container: HTMLElement, ctx: PromptContext): void {
  const { item, sub } = buildShell(ctx);
  appendGearRow(sub, ctx.promptsDropdown);
  appendPresetSteps(sub, ctx.promptsDropdown);
  appendCustomStepRow(sub, ctx.promptsDropdown);
  container.appendChild(item);
}

/**
 * Plan-23 step 2: per-chip prompt editor entry point. Placed at the top of
 * the Plan submenu so users no longer have to hunt through the Library modal
 * to edit / add a Plan prompt (see issue 04).
 */
function appendGearRow(sub: HTMLElement, dropdown: HTMLElement): void {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 12px;border-bottom:1px solid rgba(124,58,237,0.2);font-size:10px;color:' + cPrimaryLight + ';';
  const label = document.createElement('span');
  label.textContent = '⚙ Plan prompt';
  row.appendChild(label);

  const actions = document.createElement('span');
  actions.style.cssText = 'display:flex;gap:8px;';
  actions.appendChild(buildGearAction('Edit default', function () {
    void editDefaultPlanPrompt(dropdown);
  }));
  actions.appendChild(buildGearAction('Add new', function () {
    void addNewPlanPrompt(dropdown);
  }));
  row.appendChild(actions);
  sub.appendChild(row);
}

function buildGearAction(text: string, onClick: () => void): HTMLElement {
  const el = document.createElement('span');
  el.textContent = text;
  el.style.cssText = 'cursor:pointer;color:' + cPrimary + ';text-decoration:underline;';
  el.onclick = function (e: Event) {
    e.stopPropagation();
    try { onClick(); }
    catch (err) { logError('PlanTask', 'gear action "' + text + '" failed', err); }
  };
  return el;
}

async function editDefaultPlanPrompt(dropdown: HTMLElement): Promise<void> {
  const { openDefaultPromptEditor } = await import('./prompt-editor');
  await openDefaultPromptEditor('plan');
  dropdown.style.display = 'none';
}

async function addNewPlanPrompt(dropdown: HTMLElement): Promise<void> {
  const { openPromptEditor } = await import('./prompt-editor');
  await openPromptEditor({ role: 'plan' });
  dropdown.style.display = 'none';
}

function buildShell(ctx: PromptContext): { item: HTMLElement; sub: HTMLElement } {
  const item = document.createElement('div');
  item.style.cssText = 'border-bottom:1px solid rgba(124,58,237,0.3);';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 8px;cursor:pointer;font-size:11px;color:' + cPrimaryLight + ';font-weight:600;';
  row.textContent = '🧠 Plan Task';
  const arrow = document.createElement('span');
  arrow.textContent = '▸';
  arrow.style.cssText = 'font-size:10px;margin-left:4px;';
  row.appendChild(arrow);

  const sub = document.createElement('div');
  sub.setAttribute('data-plan-task-sub', '1');
  sub.style.cssText = 'display:none;position:static;margin:0 6px 6px 6px;max-height:240px;overflow-y:auto;background:rgba(0,0,0,0.18);border:1px solid ' + cPrimary + ';border-radius:' + lDropdownRadius + ';';
  item.appendChild(row);
  item.appendChild(sub);
  wireShellToggle(row, arrow, sub, ctx.promptsDropdown);
  return { item, sub };
}

function wireShellToggle(row: HTMLElement, arrow: HTMLElement, sub: HTMLElement, dropdown: HTMLElement): void {
  const show = function(): void {
    row.style.background = cBtnMenuHover;
    arrow.textContent = '▾';
    sub.style.display = 'block';
    keepInView(dropdown, sub);
  };
  const hide = function(): void {
    row.style.background = 'transparent';
    arrow.textContent = '▸';
    sub.style.display = 'none';
  };
  row.onclick = function(e: Event) {
    e.stopPropagation();
    if (sub.style.display === 'none') show(); else hide();
  };
  // RC-3 fix: do NOT auto-collapse on mouseleave. Outside-click handler in prompts-dropdown.ts
  // already closes the parent dropdown (and therefore this sub) when the user clicks away.
  // The previous 120ms timeout raced with preset clicks that crossed the panel border.
}

function keepInView(dropdown: HTMLElement, sub: HTMLElement): void {
  window.requestAnimationFrame(function() {
    const dr = dropdown.getBoundingClientRect();
    const sr = sub.getBoundingClientRect();
    if (sr.bottom > dr.bottom) dropdown.scrollTop += Math.ceil(sr.bottom - dr.bottom + 6);
  });
}

function renderPresetStepsInto(sub: HTMLElement, dropdown: HTMLElement, values: readonly number[]): void {
  for (const n of values) {
    const it = document.createElement('div');
    it.setAttribute('data-plan-preset', '1');
    it.style.cssText = 'padding:5px 12px;cursor:pointer;font-size:10px;color:' + cPanelFg + ';';
    it.textContent = 'Plan ' + n;
    it.onmouseover = function() { (this as HTMLElement).style.background = cBtnMenuHover; };
    it.onmouseout = function() { (this as HTMLElement).style.background = 'transparent'; };
    it.onclick = function(e: Event) {
      e.stopPropagation();
      injectPlanPrompt(n);
      dropdown.style.display = 'none';
    };
    sub.appendChild(it);
  }
}

function appendPresetSteps(sub: HTMLElement, dropdown: HTMLElement): void {
  // Render hardcoded defaults first so the submenu is populated even before
  // the DB read resolves — matches plan-14 cold-boot behavior.
  renderPresetStepsInto(sub, dropdown, PLAN_TASK_STEP_COUNTS);
  // Plan-15 Task 9: replace with DB-driven ReplaceValues when they diverge
  // from the plan-14 seed defaults. Silent fallback on any failure.
  void (async () => {
    try {
      const { resolveConfiguredChipValues } = await import('./configured-chip-values');
      const values = await resolveConfiguredChipValues('plan', PLAN_TASK_STEP_COUNTS);
      const isSame = values.length === PLAN_TASK_STEP_COUNTS.length
        && values.every((v, i) => v === PLAN_TASK_STEP_COUNTS[i]);
      if (isSame) return;
      // Remove existing preset rows we appended (all direct children so far).
      while (sub.firstChild) sub.removeChild(sub.firstChild);
      renderPresetStepsInto(sub, dropdown, values);
      // Re-append the custom-step row after refresh.
      appendCustomStepRow(sub, dropdown);
      console.log('[PlanTask] Chip values refreshed from DB: ' + values.join(','));
    } catch (err) {
      logError('PlanTask', 'chip refresh from DB failed', err);
    }
  })();
}

function appendCustomStepRow(sub: HTMLElement, dropdown: HTMLElement): void {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:5px 12px;border-top:1px solid rgba(124,58,237,0.2);';
  const lbl = document.createElement('span');
  lbl.textContent = 'Custom:';
  lbl.style.cssText = 'font-size:10px;color:' + cPrimaryLight + ';';
  row.appendChild(lbl);
  const inp = document.createElement('input');
  inp.type = 'number'; inp.min = '1'; inp.max = '999'; inp.placeholder = '#';
  inp.style.cssText = 'width:50px;padding:3px 5px;background:rgba(0,0,0,0.3);border:1px solid rgba(124,58,237,0.3);border-radius:4px;color:' + cPanelFg + ';font-size:10px;';
  inp.onclick = function(e: Event) { e.stopPropagation(); };
  row.appendChild(inp);
  const go = document.createElement('span');
  go.textContent = '▶'; go.title = 'Plan';
  go.style.cssText = 'cursor:pointer;font-size:11px;color:' + cPrimary + ';';
  go.onclick = function(e: Event) {
    e.stopPropagation();
    const n = parseInt(inp.value, 10);
    if (!n || n < 1 || n > 999) { showPasteToast('⚠️ Enter 1–999', true); return; }
    injectPlanPrompt(n);
    dropdown.style.display = 'none';
  };
  inp.onkeydown = function(e: KeyboardEvent) { if (e.key === 'Enter') { e.stopPropagation(); go.click(); } };
  row.appendChild(go);
  sub.appendChild(row);
}

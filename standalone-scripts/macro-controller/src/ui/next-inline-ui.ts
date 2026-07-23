/**
 * Inline strips above the Lovable chat textarea — order top→bottom:
 *   1) 📋 Plan  → click number → APPEND Plan-${N} prompt to chat (no submit)
 *   2) ▶ Next  → click number → APPEND Next-${N}-steps prompt to chat (no submit)
 *   3) 🔁 Repeat (mounted by repeat-loop-ui.ts) — the ONLY executor: submits + loops.
 *
 * Plan and Next are paste-only stagers. They never call submit, never loop,
 * never chain into Repeat. The user reviews/edits the staged text and presses
 * Enter (or 🔁 Repeat) themselves.
 *
 * Decoupling invariant: INLINE_AUTOCHAIN_DISABLED must remain true. See plan
 * `.lovable/plans/pending/09-three-strip-decoupled-plan-next-repeat.md`.
 */

import { log } from '../logger';
import { logError } from '../error-utils';
import { showPasteToast, pasteIntoEditor, findPasteTarget } from './prompt-utils';
import { DEFAULT_PROMPTS, getPromptsConfig } from './prompt-manager';
import { getByXPath } from '../xpath-utils';
import { taskNextState, findNextTasksPrompt, type TaskNextDeps } from './task-next-ui';
import { triggerPlanPasteFromInline, isSplitterRunning } from './task-splitter-ui';
import { setRepeatCount } from './repeat-loop-ui';
import { cPanelFg, cPrimaryLight } from '../shared-state';
import {
  applyInlineStripGroupCollapse,
  subscribeInlineStripGroupCollapse,
} from './inline-strip-group-collapse';
import { ensureInlineStripsFrame } from './inline-strips-frame';
import { substituteToken } from '../utils/token-substitute';
import { REPLACE_KEY_DEFAULT } from '../db/prompt-defaults';
import { buildChipGearActionSection } from './chip-gear-menu';
import { subscribePromptsChanged } from './prompts-changed-event';

/** Hard guard: Plan/Next strips MUST NOT auto-trigger Repeat or each other. */
export const INLINE_AUTOCHAIN_DISABLED = true;

const NEXT_PRESETS = [1, 2, 3, 4, 5, 8, 10, 15] as const;
const NEXT_PRESETS_HIGHLIGHT = new Set<number>([2, 5]);
const PLAN_PRESETS = [
  5, 10, 12, 15, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40, 42, 45, 48, 50,
  52, 55, 58, 60, 70, 80, 100, 125, 150, 200,
] as const;
const PLAN_PRESETS_HIGHLIGHT = new Set<number>([5, 10, 12, 15, 20, 25, 30, 50]);
const PLAN_MIN = 2;
const PLAN_MAX = 200;
const CSS_HINT_LABEL = 'font-size:10px;opacity:0.8;';
const CSS_CHIP_TRANSITION = 'transition:background 120ms ease, transform 120ms ease, box-shadow 120ms ease;';
const CSS_VISUALLY_HIDDEN = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';
const ATTR_ARIA_CONTROLS = 'aria-controls';
const ATTR_ARIA_EXPANDED = 'aria-expanded';
const ATTR_ARIA_HASPOPUP = 'aria-haspopup';
const ATTR_ARIA_LABEL = 'aria-label';
const ATTR_ROLE = 'role';
const ATTR_TABINDEX = 'tabindex';
const DATA_ACTION_OVERFLOW_ROLE = 'action-overflow';
const DATA_CHIP_OVERFLOW_ROLE = 'chip-overflow';
const DATA_TRAILING_ACTION_ENABLED = '1';
const MENU_ROLE = 'menu';
const MENU_ITEM_ROLE = 'menuitem';
const STYLE_DISPLAY_FLEX = 'flex';
const STYLE_DISPLAY_INLINE_BLOCK = 'inline-block';
const STYLE_DISPLAY_NONE = 'none';
const SEL_ENABLED_BUTTON = 'button:not([disabled])';
const SEL_FOCUSABLE_MENU_ITEM = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SEL_CHIP = '[data-chip="1"]';
const SEL_TRAILING_ACTION = '[data-trailing-action="1"]';

/**
 * Attach a smooth hover treatment to a preset chip. Uses the chip's own
 * background/border colors so Plan (amber) and Next (violet) each stay on
 * brand. Restores the exact original styles on mouseleave — no drift.
 */
function attachChipHover(button: HTMLButtonElement, hoverBg: string): void {
  const originalBg = button.style.background;
  const originalTransform = button.style.transform;
  button.addEventListener('mouseenter', () => {
    button.style.background = hoverBg;
    button.style.transform = 'translateY(-1px)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = originalBg;
    button.style.transform = originalTransform;
  });
}

interface NextPromptEntry {
  name?: string;
  slug?: string;
  text?: string;
  replaceKey?: string;
}

// v4.16+: buildGroupToggleButton removed — frame header owns the single
// minimize/maximize chevron. See inline-strips-frame.ts.


// ── Next stager (paste-only) ────────────────────────────────────────

function readEditorText(): string {
  const target = findPasteTarget(getPromptsConfig(), (xp) => getByXPath(xp) as Element | null);
  if (!target) return '';
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) return target.value || '';
  return (target as HTMLElement).innerText || (target as HTMLElement).textContent || '';
}

function substituteNextValue(text: string, key: string, n: number): string {
  return substituteToken(text, key, n);
}

function findNextVariant(entries: NextPromptEntry[], n: number): string | null {
  const slug = 'next-' + n + '-steps';
  for (const e of entries) {
    if ((e.slug || '').toLowerCase() === slug && e.text) {
      const key = e.replaceKey || REPLACE_KEY_DEFAULT;
      log('NextInline.resolve: using next variant ' + slug + ' with key=' + key + ' for N=' + n, 'info');
      return substituteNextValue(e.text, key, n);
    }
  }
  return null;
}

function findNextTemplate(entries: NextPromptEntry[], n: number, source: string): string | null {
  for (const e of entries) {
    if ((e.slug || '').toLowerCase() !== 'next-steps' || !e.text) continue;
      const key = e.replaceKey || REPLACE_KEY_DEFAULT;
    log('NextInline.resolve: using raw next template from ' + source + ' for N=' + n, 'info');
    return substituteNextValue(e.text, key, n);
  }
  return null;
}

function resolveNextVariantText(deps: TaskNextDeps, n: number): string | null {
  const entries = (deps.getPromptsConfig().entries || []) as NextPromptEntry[];
  const variant = findNextVariant(entries, n);
  if (variant) return variant;
  const template = findNextTemplate(entries, n, 'loaded prompts') || findNextTemplate(DEFAULT_PROMPTS, n, 'DEFAULT_PROMPTS');
  if (template) return template;

  // Fallback: legacy single static "Next Tasks" prompt
  const legacy = findNextTasksPrompt(deps);
  return legacy && legacy.text ? legacy.text : null;
}

/**
 * DB-first resolver for the Next chip (plan-14 step 16). Mirrors
 * `resolvePlanBody` in `plan-task-ui.ts`: prefer the user-editable
 * `next-default` row from the Prompt table (with `{{n}}` substituted).
 * Falls back to the JSON-library resolver on any DB miss/error so the
 * chip never dies silently. Every fallback path logs why.
 */
async function resolveNextTextDbFirst(deps: TaskNextDeps, n: number): Promise<string | null> {
  try {
    const mod = await import('../db/prompt-db');
    // v4.402.0: run through the sql-bridge retry helper so a stale cached
    // method-name that surfaces as PROMPT_LOAD_E001 heals in one click
    // instead of the user seeing "Unsupported method: QUERY" and giving up.
    // Imported lazily to keep next-inline-ui module init side-effect free
    // (the eager import previously broke tests that mock ../ui/prompt-loader).
    const bridge = await import('../db/sql-bridge');
    const result = await bridge.runWithBridgeRetry(
      function() { return mod.getDefaultPromptForRole('next'); },
      function(r) { return r.ok ? undefined : (r.error ?? 'getDefaultPromptForRole !ok'); },
    );
    if (result.ok && result.value && typeof result.value.Body === 'string' && result.value.Body.length > 0) {
      const key = result.value.ReplaceKey || REPLACE_KEY_DEFAULT;
      log('NextInline.resolve: using DB next-default (' + result.value.Body.length + ' chars, key=' + key + ') for N=' + n, 'info');
      return substituteToken(result.value.Body, key, n);
    }
    log('NextInline.resolve: no next-default row in DB; falling back to JSON library', 'info');
  } catch (err) {
    logError('NextInline', 'resolveNextTextDbFirst DB read failed; falling back to JSON library', err);
  }
  return resolveNextVariantText(deps, n);
}


/**
 * Paste-only stager for the Next strip. Appends the Next-${N}-steps prompt
 * body to whatever is already in the chat box. Never submits, never loops.
 */
export async function stageNextPrompt(deps: TaskNextDeps, n: number): Promise<void> {
  if (taskNextState.running || isSplitterRunning()) {
    showPasteToast('⏸ Another run is in progress', true);
    return;
  }
  const text = await resolveNextTextDbFirst(deps, n);
  if (!text) {
    showPasteToast('❌ Next ' + n + ': prompt not found in library', true);
    logError('NextInline', 'next-' + n + '-steps prompt missing');
    return;
  }
  const existing = readEditorText();
  const combined = existing.trim().length > 0
    ? existing.replace(/\s+$/, '') + '\n\n' + text
    : text;
  try {
    const outcome = await pasteIntoEditor(combined, getPromptsConfig(), (xp) => getByXPath(xp) as Element | null, 'next-chip');
    if (String(outcome) === 'failed') {
      showPasteToast('❌ Next ' + n + ': paste failed', true);
      return;
    }
    log('NextInline.stage: appended Next ' + n + ' (' + text.length + ' chars) — no submit', 'info');
    showPasteToast('📝 Next ' + n + ' staged — press Enter to send', false);
  } catch (e) {
    logError('NextInline', 'stageNextPrompt threw', e);
    showPasteToast('❌ Next ' + n + ': paste threw', true);
  }
}

// ── Plan strip (paste-only, unchanged behaviour) ─────────────────────

function planClickHandler(n: number): void {
  if (taskNextState.running || isSplitterRunning()) {
    showPasteToast('⏸ Another run is in progress', true);
    return;
  }
  const clamped = Math.max(PLAN_MIN, Math.min(PLAN_MAX, n));
  // v4.34.0: clicking a Plan preset also mirrors the number into the
  // Repeat count textbox so the user can immediately hit 🔁 Repeat
  // without retyping it. Repeat still requires an explicit Run click.
  try { setRepeatCount(clamped); }
  catch (e) { log('PlanInline: setRepeatCount failed - ' + (e instanceof Error ? e.message : String(e)), 'warn'); }
  void triggerPlanPasteFromInline(clamped);
}

function makePlanPresetButton(n: number, highlighted: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = String(n);
  b.title = 'Append "Plan ' + n + '" to the chat box (no submit)';
  const bg = highlighted ? 'rgba(245,158,11,0.55)' : 'rgba(245,158,11,0.12)';
  const hoverBg = highlighted ? 'rgba(245,158,11,0.75)' : 'rgba(245,158,11,0.28)';
  const border = highlighted ? '1px solid rgba(245,158,11,0.85)' : '1px solid rgba(245,158,11,0.3)';
  const weight = highlighted ? '700' : '500';
  b.style.cssText = 'padding:3px 8px;background:' + bg + ';border:' + border + ';border-radius:4px;color:' + cPanelFg + ';cursor:pointer;font-size:11px;font-weight:' + weight + ';line-height:1.4;flex-shrink:0;' + CSS_CHIP_TRANSITION;
  b.dataset['chip'] = '1';
  b.dataset['n'] = String(n);
  b.dataset['highlighted'] = highlighted ? '1' : '0';
  attachChipHover(b, hoverBg);
  b.onclick = function () { planClickHandler(n); };
  return b;
}

/**
 * Collapse trailing chips into a "⋯" overflow popover when the strip
 * runs out of horizontal space. Rebuilt on ResizeObserver ticks so the
 * overflow set adjusts live as the panel is resized (mirrors home-screen
 * app grid overflow menus). Chips are cloned via `buildChipByN` so the
 * popover copies get fresh click handlers.
 */
/**
 * Shared aria-live announcer. A single visually-hidden polite region is
 * appended to <body> and reused across every ⋯ popover so screen readers
 * hear "Menu opened, focused: 5 tasks", "5 tasks", "Menu closed", etc.
 * Setting the same string twice would be ignored, so we clear first.
 */
let _popoverAnnouncer: HTMLElement | null = null;
function getPopoverAnnouncer(): HTMLElement {
  if (_popoverAnnouncer && document.body.contains(_popoverAnnouncer)) {
    return _popoverAnnouncer;
  }
  const announcerElement = document.createElement('div');
  announcerElement.id = 'marco-popover-announcer';
  announcerElement.setAttribute(ATTR_ROLE, 'status');
  announcerElement.setAttribute('aria-live', 'polite');
  announcerElement.setAttribute('aria-atomic', 'true');
  // Visually-hidden but readable by AT.
  announcerElement.style.cssText = CSS_VISUALLY_HIDDEN;
  document.body.appendChild(announcerElement);
  _popoverAnnouncer = announcerElement;
  return announcerElement;
}
function announcePopover(message: string): void {
  const announcerElement = getPopoverAnnouncer();
  announcerElement.textContent = '';
  // Next tick so repeated identical text still triggers a live-region update.
  setTimeout(() => { announcerElement.textContent = message; }, 20);
}
function itemLabel(element: HTMLElement | null): string {
  if (!element) return '';
  return (
    element.getAttribute(ATTR_ARIA_LABEL)
    || element.getAttribute('title')
    || (element.textContent || '').trim()
    || 'item'
  );
}

function getVisibleMenuItems(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(SEL_FOCUSABLE_MENU_ITEM),
  ).filter(isVisibleMenuItem);
}

function isVisibleMenuItem(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.style.display === STYLE_DISPLAY_NONE || current.hasAttribute('hidden')) return false;
    if (current === document.body) break;
    current = current.parentElement;
  }
  return true;
}

function syncMenuItems(panel: HTMLElement): void {
  const menuItems = Array.from(panel.querySelectorAll<HTMLElement>(SEL_ENABLED_BUTTON));
  for (const menuItem of menuItems) {
    if (!menuItem.hasAttribute(ATTR_ROLE)) menuItem.setAttribute(ATTR_ROLE, MENU_ITEM_ROLE);
    menuItem.setAttribute(ATTR_TABINDEX, '-1');
  }
}

function focusFirstMenuItem(panel: HTMLElement): void {
  syncMenuItems(panel);
  getVisibleMenuItems(panel)[0]?.focus();
}

function announceMenuOpen(panel: HTMLElement, menuName: string): void {
  const label = itemLabel(getVisibleMenuItems(panel)[0] ?? null);
  const message = label
    ? `${menuName} opened. Focused: ${label}. Use arrow keys to navigate, Escape to close.`
    : `${menuName} opened. Escape to close.`;
  announcePopover(message);
}

function handleMenuFocusIn(panel: HTMLElement, event: FocusEvent): void {
  if (panel.style.display === STYLE_DISPLAY_NONE) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target === panel) return;
  const label = itemLabel(target);
  if (label) announcePopover(label);
}

function createDocumentFocusTrap(panel: HTMLElement, trigger: HTMLElement): (event: FocusEvent) => void {
  return (event: FocusEvent): void => {
    if (panel.style.display === STYLE_DISPLAY_NONE) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (panel.contains(target) || trigger.contains(target)) return;
    getVisibleMenuItems(panel)[0]?.focus();
  };
}

function createTrapActivator(focusTrap: (event: FocusEvent) => void): (active: boolean) => void {
  let isTrapInstalled = false;
  return (active: boolean): void => {
    if (active && !isTrapInstalled) document.addEventListener('focusin', focusTrap, true);
    if (!active && isTrapInstalled) document.removeEventListener('focusin', focusTrap, true);
    isTrapInstalled = active;
  };
}

function attachTriggerTabTrap(panel: HTMLElement, trigger: HTMLElement): void {
  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    if (panel.style.display === STYLE_DISPLAY_NONE) return;
    const menuItems = getVisibleMenuItems(panel);
    if (menuItems.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.shiftKey ? menuItems[menuItems.length - 1] : menuItems[0])?.focus();
  });
}

function focusMenuItemByDelta(event: KeyboardEvent, menuItems: HTMLElement[], currentIndex: number, delta: number): void {
  event.preventDefault();
  event.stopPropagation();
  const nextIndex = currentIndex < 0
    ? (delta > 0 ? 0 : menuItems.length - 1)
    : (currentIndex + delta + menuItems.length) % menuItems.length;
  menuItems[nextIndex]?.focus();
}

function focusTabbedMenuItem(event: KeyboardEvent, menuItems: HTMLElement[], currentIndex: number): void {
  event.preventDefault();
  event.stopPropagation();
  const lastIndex = menuItems.length - 1;
  const nextIndex = event.shiftKey
    ? (currentIndex <= 0 ? lastIndex : currentIndex - 1)
    : (currentIndex < 0 || currentIndex === lastIndex ? 0 : currentIndex + 1);
  menuItems[nextIndex]?.focus();
}

function handleMenuNavigation(event: KeyboardEvent, menuItems: HTMLElement[], currentIndex: number): boolean {
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    focusMenuItemByDelta(event, menuItems, currentIndex, 1);
    return true;
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    focusMenuItemByDelta(event, menuItems, currentIndex, -1);
    return true;
  }
  return false;
}

function handleMenuEdgeKey(event: KeyboardEvent, menuItems: HTMLElement[]): boolean {
  if (event.key === 'Home') {
    event.preventDefault();
    menuItems[0]?.focus();
    return true;
  }
  if (event.key === 'End') {
    event.preventDefault();
    menuItems[menuItems.length - 1]?.focus();
    return true;
  }
  return false;
}

function createMenuKeydownHandler(panel: HTMLElement, trigger: HTMLElement, onClose: () => void): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent): void => {
    if (panel.style.display === STYLE_DISPLAY_NONE) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      trigger.focus();
      return;
    }
    const menuItems = getVisibleMenuItems(panel);
    if (menuItems.length === 0) return;
    const activeElement = document.activeElement as HTMLElement | null;
    const currentIndex = activeElement ? menuItems.indexOf(activeElement) : -1;
    if (handleMenuNavigation(event, menuItems, currentIndex)) return;
    if (handleMenuEdgeKey(event, menuItems)) return;
    if (event.key === 'Tab') focusTabbedMenuItem(event, menuItems, currentIndex);
  };
}

/**
 * Shared keyboard-a11y wiring for the ⋯ popovers. Tags each focusable
 * descendant with role="menuitem" + tabindex=-1, and installs a single
 * keydown handler on the panel that provides:
 *   - ArrowDown / ArrowUp: cycle between menu items
 *   - Home / End: jump to first / last item
 *   - Tab / Shift+Tab: trapped cycling (never leaves the menu)
 *   - Escape: close and restore focus to the trigger (caller passes onClose)
 * Also emits polite aria-live announcements on open, close, and focus
 * changes within the menu so screen-reader users track state in compact
 * mode. Kept lightweight so the same helper works for the chip menu
 * (grid of numbers) and the trailing-action menu (column of buttons).
 */
function enhancePopoverA11y(
  panel: HTMLElement,
  trigger: HTMLElement,
  onClose: () => void,
  menuName: string = 'Menu',
): {
  syncItems: () => void;
  focusFirst: () => void;
  announceOpen: () => void;
  announceClose: () => void;
  setTrapActive: (active: boolean) => void;
} {
  const focusTrap = createDocumentFocusTrap(panel, trigger);
  const setTrapActive = createTrapActivator(focusTrap);
  panel.addEventListener('focusin', (event) => handleMenuFocusIn(panel, event));
  attachTriggerTabTrap(panel, trigger);
  panel.addEventListener('keydown', createMenuKeydownHandler(panel, trigger, onClose));

  return {
    syncItems: () => syncMenuItems(panel),
    focusFirst: () => focusFirstMenuItem(panel),
    announceOpen: () => announceMenuOpen(panel, menuName),
    announceClose: () => announcePopover(`${menuName} closed.`),
    setTrapActive,
  };
}

interface PopoverA11y {
  syncItems: () => void;
  focusFirst: () => void;
  announceOpen: () => void;
  announceClose: () => void;
  setTrapActive: (active: boolean) => void;
}

interface PopoverShell {
  wrap: HTMLElement;
  button: HTMLButtonElement;
  panel: HTMLElement;
}

interface HiddenChipPreset {
  n: number;
  hi: boolean;
}

interface OriginalActionPosition {
  parent: Node;
  next: Node | null;
}

function isPopoverOpen(panel: HTMLElement): boolean {
  return panel.style.display === STYLE_DISPLAY_FLEX;
}

function createOverflowButton(panelId: string, title: string, label: string, accent: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '⋯';
  button.title = title;
  button.setAttribute(ATTR_ARIA_LABEL, label);
  button.setAttribute(ATTR_ARIA_HASPOPUP, MENU_ROLE);
  button.setAttribute(ATTR_ARIA_EXPANDED, 'false');
  button.setAttribute(ATTR_ARIA_CONTROLS, panelId);
  button.style.cssText = 'padding:3px 10px;background:rgba(255,255,255,0.06);border:1px solid ' + accent + ';border-radius:4px;color:' + cPanelFg + ';cursor:pointer;font-size:13px;font-weight:700;line-height:1.2;' + CSS_CHIP_TRANSITION;
  return button;
}

function createOverflowPanel(panelId: string, label: string, cssText: string): HTMLElement {
  const panel = document.createElement('div');
  panel.id = panelId;
  panel.setAttribute(ATTR_ROLE, MENU_ROLE);
  panel.setAttribute(ATTR_ARIA_LABEL, label);
  panel.style.cssText = cssText;
  return panel;
}

function buildOverflowShell(config: {
  role: string;
  panelId: string;
  title: string;
  label: string;
  panelLabel: string;
  accent: string;
  wrapCss: string;
  panelCss: string;
}): PopoverShell {
  const wrap = document.createElement('span');
  wrap.dataset['role'] = config.role;
  wrap.style.cssText = config.wrapCss;
  const button = createOverflowButton(config.panelId, config.title, config.label, config.accent);
  const panel = createOverflowPanel(config.panelId, config.panelLabel, config.panelCss);
  wrap.append(button, panel);
  return { wrap, button, panel };
}

function positionPopoverFixed(panel: HTMLElement, button: HTMLElement): void {
  const rect = button.getBoundingClientRect();
  // Escape the strip body's `overflow:hidden` by promoting the panel to
  // fixed positioning anchored to the button rect. Left-align the panel to
  // the button's left edge so it drops down to the RIGHT side of the button
  // (grows rightward), keeping the numeric chips and actions clearly visible.
  panel.style.position = 'fixed';
  // Measure panel width off-screen so we can clamp to the viewport when the
  // button sits near the right edge (prevents horizontal clipping).
  const prevVis = panel.style.visibility;
  const prevDisp = panel.style.display;
  panel.style.visibility = 'hidden';
  panel.style.display = 'flex';
  panel.style.left = '-9999px';
  panel.style.right = 'auto';
  panel.style.top = '-9999px';
  panel.style.bottom = 'auto';
  const panelW = panel.offsetWidth;
  const panelH = panel.offsetHeight;
  panel.style.visibility = prevVis;
  panel.style.display = prevDisp;
  const marginX = 8;
  const desiredLeft = rect.left;
  const maxLeft = Math.max(marginX, window.innerWidth - panelW - marginX);
  const clampedLeft = Math.min(Math.max(marginX, desiredLeft), maxLeft);
  panel.style.left = String(Math.round(clampedLeft)) + 'px';
  panel.style.right = 'auto';
  // Content-aware vertical placement: flip up when there isn't enough
  // room below the button. Falls back to below when neither side fits.
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const gap = 4;
  const margin = 8;
  if (spaceBelow >= panelH + gap || spaceBelow >= spaceAbove) {
    panel.style.top = String(Math.round(rect.bottom + gap)) + 'px';
    panel.style.bottom = 'auto';
    panel.style.maxHeight = String(Math.max(120, Math.floor(spaceBelow - gap - margin))) + 'px';
  } else {
    panel.style.top = 'auto';
    panel.style.bottom = String(Math.max(0, Math.round(window.innerHeight - rect.top + gap))) + 'px';
    panel.style.maxHeight = String(Math.max(120, Math.floor(spaceAbove - gap - margin))) + 'px';
  }
  panel.style.overflowY = 'auto';
}

function setPopoverVisibility(panel: HTMLElement, button: HTMLElement, a11y: PopoverA11y, open: boolean): void {
  const wasOpen = isPopoverOpen(panel);
  if (open) positionPopoverFixed(panel, button);
  panel.style.display = open ? STYLE_DISPLAY_FLEX : STYLE_DISPLAY_NONE;
  button.setAttribute(ATTR_ARIA_EXPANDED, open ? 'true' : 'false');
  a11y.setTrapActive(open);
  if (open) {
    a11y.focusFirst();
    a11y.announceOpen();
  } else if (wasOpen) {
    a11y.announceClose();
  }
}

function wirePopoverButton(button: HTMLButtonElement, panel: HTMLElement, setOpen: (open: boolean) => void): void {
  button.onclick = (event) => {
    event.stopPropagation();
    setOpen(!isPopoverOpen(panel));
  };
  button.addEventListener('keydown', (event) => handlePopoverButtonKeydown(event, panel, setOpen));
}

function handlePopoverButtonKeydown(event: KeyboardEvent, panel: HTMLElement, setOpen: (open: boolean) => void): void {
  if (event.key === 'Escape' && isPopoverOpen(panel)) {
    event.stopPropagation();
    setOpen(false);
    return;
  }
  if ((event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') && !isPopoverOpen(panel)) {
    event.preventDefault();
    setOpen(true);
  }
}

function createOutsidePopoverCloser(container: HTMLElement, panel: HTMLElement, button: HTMLElement, setOpen: (open: boolean) => void): (event: Event) => void {
  return (event: Event): void => {
    if (!isPopoverOpen(panel)) return;
    const target = event.target;
    if (target instanceof Node && container.contains(target)) return;
    setOpen(false);
    button.focus();
  };
}

function observeOverflow(body: HTMLElement, recompute: () => void): void {
  const resizeObserver = new ResizeObserver(() => recompute());
  resizeObserver.observe(body);
  requestAnimationFrame(recompute);
}

function resetChipOverflow(body: HTMLElement, panel: HTMLElement, overflowWrap: HTMLElement): HTMLElement[] {
  // Only in-flow chips (skip those already cloned into the overflow panel/wrap).
  const allChips = Array.from(body.querySelectorAll<HTMLElement>(SEL_CHIP));
  const chips = allChips.filter((chip) => !overflowWrap.contains(chip));
  for (const chip of chips) chip.style.display = '';
  while (panel.firstChild) panel.removeChild(panel.firstChild);
  overflowWrap.style.display = STYLE_DISPLAY_NONE;
  return chips;
}

function collectHiddenChipPresets(body: HTMLElement, chips: HTMLElement[]): HiddenChipPreset[] {
  const hiddenPresets: HiddenChipPreset[] = [];
  for (let index = chips.length - 1; index >= 0; index--) {
    const chip = chips[index];
    if (!chip) continue;
    chip.style.display = STYLE_DISPLAY_NONE;
    const n = Number(chip.dataset['n'] || '0');
    const hi = chip.dataset['highlighted'] === '1';
    hiddenPresets.unshift({ n, hi });
    if (body.scrollWidth <= body.clientWidth + 1) break;
  }
  return hiddenPresets;
}

function fillChipOverflowPanel(panel: HTMLElement, hiddenPresets: HiddenChipPreset[], buildChipByN: (n: number, highlighted: boolean) => HTMLElement): void {
  for (const { n, hi } of hiddenPresets) panel.appendChild(buildChipByN(n, hi));
}

function recomputeChipOverflow(body: HTMLElement, shell: PopoverShell, buildChipByN: (n: number, highlighted: boolean) => HTMLElement, a11y: PopoverA11y): void {
  const chips = resetChipOverflow(body, shell.panel, shell.wrap);
  if (body.scrollWidth <= body.clientWidth + 1) return;
  shell.wrap.style.display = STYLE_DISPLAY_INLINE_BLOCK;
  fillChipOverflowPanel(shell.panel, collectHiddenChipPresets(body, chips), buildChipByN);
  a11y.syncItems();
}

function buildChipOverflowShell(accent: string): PopoverShell {
  const panelId = 'marco-chip-overflow-' + Math.random().toString(36).slice(2, 9);
  return buildOverflowShell({
    role: DATA_CHIP_OVERFLOW_ROLE,
    panelId,
    title: 'Show more sizes',
    label: 'Show more sizes',
    panelLabel: 'Additional sizes',
    accent,
    wrapCss: 'position:relative;display:none;flex-shrink:0;',
    panelCss: 'position:absolute;top:calc(100% + 4px);right:0;display:none;flex-wrap:wrap;gap:4px;padding:8px;background:#1a1a2e;border:1px solid ' + accent + ';border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,0.5);z-index:2147483646;max-width:320px;',
  });
}

function wireChipOverflowPopover(shell: PopoverShell): PopoverA11y {
  const a11y = enhancePopoverA11y(shell.panel, shell.button, () => setOpen(false), 'Sizes menu');
  const setOpen = (open: boolean): void => {
    setPopoverVisibility(shell.panel, shell.button, a11y, open);
  };
  wirePopoverButton(shell.button, shell.panel, setOpen);
  registerPointerPopoverCloser(createOutsidePopoverCloser(shell.wrap, shell.panel, shell.button, setOpen));
  return a11y;
}

export function installChipOverflow(
  body: HTMLElement,
  moreWrap: HTMLElement,
  buildChipByN: (n: number, highlighted: boolean) => HTMLElement,
  accent: string,
): () => void {
  const shell = buildChipOverflowShell(accent);
  body.insertBefore(shell.wrap, moreWrap);
  const a11y = wireChipOverflowPopover(shell);
  const recompute = (): void => recomputeChipOverflow(body, shell, buildChipByN, a11y);
  observeOverflow(body, recompute);
  return recompute;
}

function restoreActionOverflowPositions(original: Map<HTMLElement, OriginalActionPosition>): void {
  for (const [actionElement, position] of original) {
    const next = position.next && position.next.parentNode === position.parent ? position.next : null;
    try { position.parent.insertBefore(actionElement, next); } catch { /* parent detached */ }
  }
  original.clear();
}

function getTrailingActions(body: HTMLElement, wrap: HTMLElement): HTMLElement[] {
  return Array.from(
    body.querySelectorAll<HTMLElement>(SEL_TRAILING_ACTION),
  ).filter((actionElement) => !wrap.contains(actionElement));
}

function collectOverflowActions(body: HTMLElement, actions: HTMLElement[]): HTMLElement[] {
  const hiddenActions: HTMLElement[] = [];
  for (let index = actions.length - 1; index >= 0; index--) {
    const actionElement = actions[index];
    if (!actionElement) continue;
    actionElement.style.display = STYLE_DISPLAY_NONE;
    hiddenActions.unshift(actionElement);
    if (body.scrollWidth <= body.clientWidth + 1) break;
  }
  return hiddenActions;
}

function moveActionsToOverflowPanel(panel: HTMLElement, original: Map<HTMLElement, OriginalActionPosition>, actions: HTMLElement[]): void {
  for (const actionElement of actions) {
    original.set(actionElement, { parent: actionElement.parentNode as Node, next: actionElement.nextSibling });
    actionElement.style.display = '';
    panel.appendChild(actionElement);
  }
}

function recomputeActionOverflow(body: HTMLElement, shell: PopoverShell, original: Map<HTMLElement, OriginalActionPosition>, a11y: PopoverA11y, setOpen: (open: boolean) => void): void {
  restoreActionOverflowPositions(original);
  shell.wrap.style.display = STYLE_DISPLAY_NONE;
  setOpen(false);
  if (body.scrollWidth <= body.clientWidth + 1) return;
  const actions = getTrailingActions(body, shell.wrap);
  if (actions.length === 0) return;
  shell.wrap.style.display = STYLE_DISPLAY_INLINE_BLOCK;
  moveActionsToOverflowPanel(shell.panel, original, collectOverflowActions(body, actions));
  a11y.syncItems();
}

/**
 * Trailing-action overflow: when the strip gets too tight, relocate trailing
 * action buttons (`[data-trailing-action="1"]`) into a ⋯ actions popover on
 * the right, matching the home-screen kebab-menu pattern. Actions are moved
 * as-is (not cloned) so their original click handlers and attached dropups
 * keep working; they're restored to their original position when space
 * returns.
 */
export function installActionOverflow(
  body: HTMLElement,
  accent: string,
): () => void {
  const panelId = 'marco-action-overflow-' + Math.random().toString(36).slice(2, 9);
  const shell = buildOverflowShell({
    role: DATA_ACTION_OVERFLOW_ROLE,
    panelId,
    title: 'More actions',
    label: 'More actions',
    panelLabel: 'Additional actions',
    accent,
    wrapCss: 'position:relative;display:none;flex-shrink:0;margin-left:4px;',
    panelCss: 'position:absolute;top:calc(100% + 4px);right:0;display:none;flex-direction:column;gap:4px;padding:8px;background:#1a1a2e;border:1px solid ' + accent + ';border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,0.5);z-index:2147483646;min-width:200px;max-width:360px;',
  });
  body.appendChild(shell.wrap);
  const a11y = enhancePopoverA11y(shell.panel, shell.button, () => setOpen(false), 'Actions menu');
  const setOpen = (open: boolean): void => {
    setPopoverVisibility(shell.panel, shell.button, a11y, open);
  };
  wirePopoverButton(shell.button, shell.panel, setOpen);
  registerPointerPopoverCloser(createOutsidePopoverCloser(shell.wrap, shell.panel, shell.button, setOpen));
  const original = new Map<HTMLElement, OriginalActionPosition>();
  const recompute = (): void => {
    recomputeActionOverflow(body, shell, original, a11y, setOpen);
  };
  observeOverflow(body, recompute);
  return recompute;
}

function populatePlanDropup(panel: HTMLElement, values: readonly number[]): void {
  while (panel.firstChild) panel.removeChild(panel.firstChild);
  // v4.399: numbers on TOP so they're always visible when the popover flips
  // upward against the viewport bottom. Prompt-management actions render
  // below the grid.
  const chipGrid = document.createElement('div');
  chipGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,auto);gap:4px;margin-bottom:6px;';
  for (const n of values) {
    const b = makePlanPresetButton(n, PLAN_PRESETS_HIGHLIGHT.has(n));
    b.addEventListener('click', function () { panel.style.display = 'none'; });
    chipGrid.appendChild(b);
  }
  panel.appendChild(chipGrid);
  panel.appendChild(buildChipGearActionSection({ role: 'plan', roleLabel: 'Plan', accent: 'rgba(245,158,11,0.85)' }));
}

interface PlanDropupHandle {
  panel: HTMLElement;
  setOpen: (open: boolean) => void;
  a11y: PopoverA11y;
}

function createPlanDropupPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.id = 'marco-plan-dropup-' + Math.random().toString(36).slice(2, 9);
  panel.setAttribute(ATTR_ROLE, MENU_ROLE);
  panel.setAttribute(ATTR_ARIA_LABEL, 'Plan menu');
  panel.style.cssText = 'position:fixed;display:none;flex-direction:column;gap:4px;padding:7px;background:#1a1a2e;border:1px solid rgba(245,158,11,0.6);border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,0.5);z-index:2147483646;min-width:226px;max-width:300px;';
  panel.dataset['role'] = 'plan-dropup';
  return panel;
}

function wirePlanTriggerAria(trigger: HTMLButtonElement, panelId: string): void {
  trigger.setAttribute(ATTR_ARIA_HASPOPUP, MENU_ROLE);
  trigger.setAttribute(ATTR_ARIA_EXPANDED, 'false');
  trigger.setAttribute(ATTR_ARIA_CONTROLS, panelId);
}

function schedulePlanDropupDbRefresh(rePopulate: (values: readonly number[]) => void): void {
  void (async () => {
    try {
      const { resolveConfiguredChipValues } = await import('./configured-chip-values');
      const values = await resolveConfiguredChipValues('plan', [...PLAN_PRESETS]);
      rePopulate(values);
    } catch (err) {
      logError('NextInline', 'plan dropup DB refresh failed', err);
    }
  })();
}

function buildPlanDropup(anchor: HTMLElement, trigger: HTMLButtonElement): PlanDropupHandle {
  const panel = createPlanDropupPanel();
  const a11y = enhancePopoverA11y(panel, trigger, () => setOpen(false), 'Plan menu');
  const rePopulate = (values: readonly number[]): void => {
    populatePlanDropup(panel, values);
    if (isPopoverOpen(panel)) positionPopoverFixed(panel, trigger);
    a11y.syncItems();
  };
  rePopulate(PLAN_PRESETS);
  const setOpen = (open: boolean): void => setPopoverVisibility(panel, trigger, a11y, open);
  wirePlanTriggerAria(trigger, panel.id);
  schedulePlanDropupDbRefresh(rePopulate);
  anchor.appendChild(panel);
  registerPointerPopoverCloser(createOutsidePopoverCloser(anchor, panel, trigger, setOpen));
  return { panel, setOpen, a11y };
}

function buildSplitStrip(): HTMLElement {
  const root = document.createElement('div');
  // v4.29.1: tinted background (no border) so each strip keeps its color identity
  // while the outer frame owns the single visual boundary.
  root.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:4px 8px;background:rgba(124,58,237,0.10);border:none;border-radius:5px;font-family:system-ui,-apple-system,sans-serif;color:' + cPanelFg + ';font-size:11px;box-sizing:border-box;';

  const label = document.createElement('span');
  label.textContent = '📋 Plan';
  label.style.cssText = 'font-weight:600;color:#fbbf24;';
  root.appendChild(label);
  

  const body = document.createElement('span');
  body.dataset['role'] = 'plan-body';
  body.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:nowrap;flex:1;min-width:0;overflow:hidden;';

  const hint = document.createElement('span');
  hint.textContent = 'click a number to add (no submit)';
  hint.style.cssText = CSS_HINT_LABEL + 'flex-shrink:0;';
  body.appendChild(hint);

  for (const n of PLAN_PRESETS) {
    if (!PLAN_PRESETS_HIGHLIGHT.has(n)) continue;
    body.appendChild(makePlanPresetButton(n, true));
  }

  const moreWrap = document.createElement('span');
  moreWrap.style.cssText = 'position:relative;margin-left:auto;display:inline-block;flex-shrink:0;';
  moreWrap.dataset['trailingAction'] = DATA_TRAILING_ACTION_ENABLED;
  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.textContent = 'More ▾';
  moreBtn.title = 'Show all plan sizes';
  moreBtn.dataset['role'] = 'plan-more-btn';
  moreBtn.style.cssText = 'padding:4px 12px;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;color:#1a1a2e;background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 60%,#d97706 100%);box-shadow:0 1px 4px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.2);' + CSS_CHIP_TRANSITION;
  moreWrap.appendChild(moreBtn);
  const { panel, setOpen } = buildPlanDropup(moreWrap, moreBtn);
  wirePopoverButton(moreBtn, panel, setOpen);
  body.appendChild(moreWrap);

  root.appendChild(body);

  installChipOverflow(body, moreWrap, (n, hi) => makePlanPresetButton(n, hi), 'rgba(245,158,11,0.6)');
  installActionOverflow(body, 'rgba(245,158,11,0.6)');

  // v4.16+: per-strip toggle removed — the shared frame header owns the single
  // minimize/maximize chevron so we no longer have two competing controls.
  subscribeInlineStripGroupCollapse(function () { applyInlineStripGroupCollapse(); });
  applyInlineStripGroupCollapse();

  return root;
}

// ── Next strip (preset-row stager, paste-only) ──────────────────────

function makeNextPresetButton(deps: TaskNextDeps, n: number, highlighted: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = String(n);
  b.title = 'Append "Next ' + n + ' steps" to the chat box (no submit)';
  const bg = highlighted ? 'rgba(124,58,237,0.55)' : 'rgba(124,58,237,0.15)';
  const hoverBg = highlighted ? 'rgba(124,58,237,0.78)' : 'rgba(124,58,237,0.32)';
  const border = highlighted ? '1px solid rgba(124,58,237,0.85)' : '1px solid rgba(124,58,237,0.3)';
  const weight = highlighted ? '700' : '500';
  b.style.cssText = 'padding:3px 8px;background:' + bg + ';border:' + border + ';border-radius:4px;color:' + cPanelFg + ';cursor:pointer;font-size:11px;font-weight:' + weight + ';line-height:1.4;flex-shrink:0;' + CSS_CHIP_TRANSITION;
  b.dataset['chip'] = '1';
  b.dataset['n'] = String(n);
  b.dataset['highlighted'] = highlighted ? '1' : '0';
  attachChipHover(b, hoverBg);
  // v4.402.0: absorb rapid re-entrant clicks while the DB bridge retry loop
  // is in flight, so PROMPT_LOAD_E001 / PROMPT_EDIT_E005 cannot be re-fired
  // mid-recovery by an impatient double-click.
  b.onclick = function () {
    void import('./async-guard').then(function(mod) {
      const guarded = mod.guardAsyncClick(b, function() { return stageNextPrompt(deps, n); });
      void guarded();
    });
  };
  return b;
}

/**
 * Build the "More ▾" popover for the Next strip. Unlike Plan, Next shows
 * all presets inline, so the popover exists purely to host the shared
 * prompt-management actions (Edit default / Add new / Manage).
 */
function buildNextMorePopover(anchor: HTMLElement): HTMLElement {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:absolute;top:calc(100% + 4px);right:0;display:none;flex-direction:column;gap:4px;padding:7px;background:#1a1a2e;border:1px solid rgba(124,58,237,0.6);border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,0.5);z-index:2147483646;min-width:226px;max-width:300px;';
  panel.dataset['role'] = 'next-dropup';
  panel.appendChild(buildChipGearActionSection({ role: 'next', roleLabel: 'Next', accent: 'rgba(124,58,237,0.85)' }));
  anchor.appendChild(panel);
  attachDropupOutsideCloser(panel, anchor);

  return panel;
}

function buildNextStripLabel(): HTMLElement {
  const label = document.createElement('span');
  label.textContent = '▶ Next';
  label.style.cssText = 'font-weight:600;color:' + cPrimaryLight + ';cursor:pointer;';
  return label;
}

function buildNextStripBody(deps: TaskNextDeps): HTMLElement {
  const body = document.createElement('span');
  body.dataset['role'] = 'next-body';
  body.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:nowrap;flex:1;min-width:0;overflow:hidden;';
  const hint = document.createElement('span');
  hint.textContent = 'click a number to add (no submit)';
  hint.style.cssText = CSS_HINT_LABEL + 'flex-shrink:0;';
  body.appendChild(hint);
  for (const n of NEXT_PRESETS) {
    body.appendChild(makeNextPresetButton(deps, n, NEXT_PRESETS_HIGHLIGHT.has(n)));
  }
  return body;
}

function buildNextMoreWrap(): HTMLElement {
  const moreWrap = document.createElement('span');
  moreWrap.style.cssText = 'position:relative;margin-left:auto;display:inline-block;flex-shrink:0;';
  moreWrap.dataset['trailingAction'] = DATA_TRAILING_ACTION_ENABLED;
  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.textContent = 'More ▾';
  moreBtn.title = 'Edit / add / manage Next prompts';
  moreBtn.dataset['role'] = 'next-more-btn';
  moreBtn.style.cssText = 'padding:4px 12px;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;color:#ffffff;background:linear-gradient(135deg,#8b5cf6 0%,#7c3aed 60%,#6d28d9 100%);box-shadow:0 1px 4px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.2);' + CSS_CHIP_TRANSITION;
  moreWrap.appendChild(moreBtn);
  const panel = buildNextMorePopover(moreWrap);
  moreBtn.onclick = function (ev) {
    ev.stopPropagation();
    const willOpen = panel.style.display !== 'flex';
    if (willOpen) positionPopoverFixed(panel, moreBtn);
    panel.style.display = willOpen ? 'flex' : 'none';
  };
  return moreWrap;
}

async function refreshNextChipsFromDb(deps: TaskNextDeps, body: HTMLElement, moreWrap: HTMLElement, recomputeOverflow: () => void): Promise<void> {
  try {
    const { resolveConfiguredChipValues } = await import('./configured-chip-values');
    const values = await resolveConfiguredChipValues('next', [...NEXT_PRESETS]);
    const isSame = values.length === NEXT_PRESETS.length && values.every((v, i) => v === NEXT_PRESETS[i]);
    if (isSame) return;
    const chips = Array.from(body.querySelectorAll<HTMLElement>('[data-chip="1"]'));
    for (const c of chips) c.remove();
    const overflowAnchor = body.querySelector<HTMLElement>('[data-role="chip-overflow"]') || moreWrap;
    for (const n of values) {
      body.insertBefore(makeNextPresetButton(deps, n, NEXT_PRESETS_HIGHLIGHT.has(n)), overflowAnchor);
    }
    recomputeOverflow();
    log('NextInline: chips refreshed from DB - ' + values.join(','), 'info');
  } catch (err) {
    logError('NextInline', 'next chip DB refresh failed', err);
  }
}

function buildNextStrip(deps: TaskNextDeps): HTMLElement {
  const root = document.createElement('div');
  root.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:4px 8px;background:rgba(124,58,237,0.10);border:none;border-radius:5px;font-family:system-ui,-apple-system,sans-serif;color:' + cPanelFg + ';font-size:11px;box-sizing:border-box;';
  root.appendChild(buildNextStripLabel());
  const body = buildNextStripBody(deps);
  const moreWrap = buildNextMoreWrap();
  body.appendChild(moreWrap);
  root.appendChild(body);
  const recomputeOverflow = installChipOverflow(body, moreWrap, (n, hi) => makeNextPresetButton(deps, n, hi), 'rgba(124,58,237,0.6)');
  installActionOverflow(body, 'rgba(124,58,237,0.6)');
  void refreshNextChipsFromDb(deps, body, moreWrap, recomputeOverflow);
  subscribeInlineStripGroupCollapse(function () { applyInlineStripGroupCollapse(); });
  // v4.402.0: refresh the numbered chips whenever a prompt edit lands so a
  // user who just edited the Next default via the gear menu sees the new
  // active row on the next click without a reload.
  subscribePromptsChanged(function(detail) {
    if (detail.role && detail.role !== 'next') return;
    void refreshNextChipsFromDb(deps, body, moreWrap, recomputeOverflow);
  });
  return root;
}

// ── Mount above chat box ────────────────────────────────────────────

const INLINE_ID = 'marco-next-inline';
const SPLIT_ID = 'marco-split-inline';

function tryMountInline(deps: TaskNextDeps): boolean {
  if (!INLINE_AUTOCHAIN_DISABLED) {
    logError('NextInline', 'INLINE_AUTOCHAIN_DISABLED flipped — refusing to mount');
    return true;
  }
  if (document.getElementById(INLINE_ID) && document.getElementById(SPLIT_ID)) return true;
  const target = findPasteTarget(getPromptsConfig(), (xp) => getByXPath(xp) as Element | null);
  if (!target) return false;
  const host = (target.closest && target.closest('form')) || target.parentElement;
  if (!host || !host.parentElement) return false;

  // v4.16+: mount into shared frame so Plan/Next/Repeat share one visual unit
  // and one minimize/maximize control. See inline-strips-frame.ts.
  const framed = ensureInlineStripsFrame(host as HTMLElement);
  if (!framed) return false;
  const body = framed.body;

  // Order top→bottom inside the frame: Plan → Next → (Repeat appended after).
  if (!document.getElementById(SPLIT_ID)) {
    const splitStrip = buildSplitStrip();
    splitStrip.id = SPLIT_ID;
    splitStrip.style.margin = '0';
    body.appendChild(splitStrip);
  }
  if (!document.getElementById(INLINE_ID)) {
    const strip = buildNextStrip(deps);
    strip.id = INLINE_ID;
    strip.style.margin = '0';
    const splitStrip = document.getElementById(SPLIT_ID);
    if (splitStrip && splitStrip.nextSibling) {
      body.insertBefore(strip, splitStrip.nextSibling);
    } else {
      body.appendChild(strip);
    }
  }
  applyInlineStripGroupCollapse();
  log('NextInline: strips mounted (plan + next, paste-only) into unified frame', 'info');
  return true;
}

let _observer: MutationObserver | null = null;
let _pagehideRegistered = false;
const _dropupClosers: Array<(ev: MouseEvent) => void> = [];
// Pointer-based popover closers (mousedown/touchstart pair) — tracked
// separately so teardown removes both listener types cleanly.
const _pointerPopoverClosers: Array<(ev: Event) => void> = [];

/** Register outside-pointer closers for a ⋯ popover on both mousedown and touchstart. */
function registerPointerPopoverCloser(handler: (ev: Event) => void): void {
  document.addEventListener('mousedown', handler, true);
  document.addEventListener('touchstart', handler, true);
  _pointerPopoverClosers.push(handler);
}

function _teardownPointerPopoverClosers(): void {
  while (_pointerPopoverClosers.length) {
    const handler = _pointerPopoverClosers.pop();
    if (!handler) continue;
    document.removeEventListener('mousedown', handler, true);
    document.removeEventListener('touchstart', handler, true);
  }
}

/**
 * Register a document-level click closer that hides `panel` whenever the
 * click lands outside `anchor`. Extracted to satisfy sonarjs/no-identical-functions
 * (Plan and Next dropups previously duplicated this block).
 */
function attachDropupOutsideCloser(panel: HTMLElement, anchor: HTMLElement): void {
  const closer = (ev: MouseEvent): void => {
    if (panel.style.display === 'none') return;
    if (ev.target instanceof Node && anchor.contains(ev.target)) return;
    panel.style.display = 'none';
  };
  document.addEventListener('click', closer, true);
  _dropupClosers.push(closer);
}


function _registerNextInlineTeardownOnce(): void {
  if (_pagehideRegistered || typeof window === 'undefined') return;
  _pagehideRegistered = true;
  window.addEventListener('pagehide', function () {
    if (_observer) { _observer.disconnect(); _observer = null; }
    while (_dropupClosers.length) {
      const c = _dropupClosers.pop();
      if (c) document.removeEventListener('click', c, true);
    }
    _teardownPointerPopoverClosers();
  });
}

/** Test-only: reset teardown state and disconnect observers. */
export function __resetNextInlineForTests(): void {
  if (_observer) { _observer.disconnect(); _observer = null; }
  while (_dropupClosers.length) {
    const c = _dropupClosers.pop();
    if (c) document.removeEventListener('click', c, true);
  }
  _teardownPointerPopoverClosers();
  _pagehideRegistered = false;
}

/** Test-only: expose fixed-popover positioning for visual regression coverage. */
export function __positionPopoverFixedForTests(panel: HTMLElement, button: HTMLElement): void {
  positionPopoverFixed(panel, button);
}



/**
 * v4.11+: Plan and Next inline strips above the chat textarea are HIDDEN by
 * default. They have been folded into the prompts dropdown header. Set
 * `window.__MARCO_SHOW_LEGACY_INLINE_STRIPS__ = true` before mount to restore.
 * Tracking: .lovable/question-and-ambiguity/64-compact-plan-next-into-prompts-dropdown.md
 */
// v4.14.1: restored — user relies on inline Plan/Next strips above the chat.
// The dropdown tabs are an additional surface, not a replacement.
export const SHOW_LEGACY_INLINE_STRIPS = true;

function isLegacyStripsEnabled(): boolean {
  if (SHOW_LEGACY_INLINE_STRIPS) return true;
  const w = (typeof window !== 'undefined' ? window : {}) as Record<string, unknown>;
  return w['__MARCO_SHOW_LEGACY_INLINE_STRIPS__'] === true;
}

export function mountNextInlineStrip(deps: TaskNextDeps): void {
  if (!isLegacyStripsEnabled()) {
    // Strips suppressed — remove any pre-existing mounts so the UI is clean.
    const a = document.getElementById(INLINE_ID);
    if (a && a.parentElement) a.parentElement.removeChild(a);
    const b = document.getElementById(SPLIT_ID);
    if (b && b.parentElement) b.parentElement.removeChild(b);
    return;
  }
  if (tryMountInline(deps)) return;
  if (_observer) return;
  _registerNextInlineTeardownOnce();
  _observer = new MutationObserver(function () {
    if (typeof document === 'undefined' || !document.body) return;
    if (!document.getElementById(INLINE_ID) || !document.getElementById(SPLIT_ID)) tryMountInline(deps);
  });
  _observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Repeat Loop UI — chat-box repeat selector
 *
 * Ambiguity 126 — RESOLVED 2026-06-19. Repeats whatever text is currently
 * in the Lovable chat box: paste → submit → wait for completion → repeat N times.
 * Two mount points (floating macro panel section + inline strip above the chat
 * textarea) share count/wait/run state. The inline strip is hidden by the
 * shared Plan/Next/Repeat +/- group toggle; the panel keeps its local collapse.
 */

import { log } from '../logger';
import { trackedSetInterval, trackedClearInterval } from '../interval-registry';

import { showPasteToast, findPasteTarget } from './prompt-utils';
import { getPromptsConfig } from './prompt-manager';
import { getByXPath, isReturnButtonVisible } from '../xpath-utils';
import { findAddToTasksButton } from './task-next-ui';
import { cPanelFg, cPrimaryLight, cSectionBg } from '../shared-state';
import {
  applyInlineStripGroupCollapse,
  subscribeInlineStripGroupCollapse,
} from './inline-strip-group-collapse';
import { ensureInlineStripsFrame } from './inline-strips-frame';
import { extractEditorPlainText, replaceEditorText } from './editor-text';
import { captureChatSubmit } from '../capture/chat-submit-capture';
import { buildNextSelectorControl } from './next-selector-control';



export const PRESETS = [1, 2, 3, 4, 5, 8, 10, 12, 15, 20, 25, 30, 50, 60, 70, 75, 80, 100, 200] as const;
/**
 * Issue 06 (2026-07-18) — Plan-23 step 3. The repeat preset chip row rendered
 * every value inline, wrapping past the visible bounds of the inline strip
 * once the tail values (60..200) were added. `PRESET_INLINE_MAX` is the
 * inclusive threshold at or below which chips stay inline; values above it
 * are surfaced through a "More ▾" popover so the strip stays a single row.
 */
export const PRESET_INLINE_MAX = 50;
const DELAY_PRESETS_SEC = [5, 8, 12, 20, 25, 30, 60, 120] as const;
const POLL_MS = 500;
const MAX_WAIT_MS = 10 * 60 * 1000; // 10 min per submit
const STORAGE_KEY = 'marco-repeat-loop-prefs';

export const WAIT_MODE_SUBMIT_READY = 'submit-ready' as const;
export const WAIT_MODE_FIXED_DELAY = 'fixed-delay' as const;
export type RepeatWaitMode = typeof WAIT_MODE_SUBMIT_READY | typeof WAIT_MODE_FIXED_DELAY;

type RepeatPhase = 'idle' | 'submitting' | 'waiting-completion' | 'waiting-delay';

interface RepeatState {
  count: number;
  waitMode: RepeatWaitMode;
  /** Fixed delay between iterations, seconds (used when waitMode = WAIT_MODE_FIXED_DELAY). */
  delaySec: number;
  running: boolean;
  cancelled: boolean;
  completed: number;
  capturedText: string;
  /** Mounted controls subscribed to state changes (count/running/completed/collapsed). */
  subscribers: Set<() => void>;
  /** Current iteration phase — drives the live timer label. */
  phase: RepeatPhase;
  /** ms epoch when current phase started. */
  phaseStartedAt: number;
  /** ms epoch when current phase is expected to end (0 = unknown / open-ended). */
  phaseDeadlineAt: number;
  /** When true, controls render as a tiny chevron-only pill. Persisted. */
  collapsed: boolean;
}

export const repeatLoopState: RepeatState = {
  count: 10,
  waitMode: WAIT_MODE_SUBMIT_READY,
  delaySec: 15,
  running: false,
  cancelled: false,
  completed: 0,
  capturedText: '',
  subscribers: new Set(),
  phase: 'idle',
  phaseStartedAt: 0,
  phaseDeadlineAt: 0,
  collapsed: false,
};

// ── persistence (count + waitMode + delaySec only, never running state) ──
// Script runs in the page MAIN world where `chrome.storage` is unavailable,
// so we use synchronous localStorage — reliable, no async race with first render.
function persist(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const payload = {
      v: 2,
      count: repeatLoopState.count,
      waitMode: repeatLoopState.waitMode,
      delaySec: repeatLoopState.delaySec,
      collapsed: repeatLoopState.collapsed,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) { log('Repeat: persist failed — ' + (e instanceof Error ? e.message : String(e)), 'warn'); }
}

function hydrate(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    const o = parsed as { count?: unknown; waitMode?: unknown; delaySec?: unknown; collapsed?: unknown };
    if (typeof o.count === 'number' && o.count >= 1) {
      repeatLoopState.count = Math.max(1, Math.min(1000, Math.floor(o.count)));
    }
    if (o.waitMode === WAIT_MODE_SUBMIT_READY || o.waitMode === WAIT_MODE_FIXED_DELAY) {
      repeatLoopState.waitMode = o.waitMode;
    }
    if (typeof o.delaySec === 'number' && o.delaySec >= 1) {
      repeatLoopState.delaySec = Math.max(1, Math.min(3600, Math.floor(o.delaySec)));
    }
    if (typeof o.collapsed === 'boolean') {
      repeatLoopState.collapsed = o.collapsed;
    }
    log('Repeat: prefs hydrated — count=' + repeatLoopState.count + ', mode=' + repeatLoopState.waitMode + ', delay=' + repeatLoopState.delaySec + 's', 'info');
  } catch (e) { log('Repeat: hydrate failed — ' + (e instanceof Error ? e.message : String(e)), 'warn'); }
}
hydrate();

function notify(): void {
  for (const subscriber of repeatLoopState.subscribers) {
    try { subscriber(); } catch (e) { log('Repeat: subscriber failed — ' + (e instanceof Error ? e.message : String(e)), 'warn'); }
  }
}

function readEditorText(): string {
  const target = findPasteTarget(getPromptsConfig(), (xp) => getByXPath(xp) as Element | null);
  if (!target) return '';
  return extractEditorPlainText(target);
}

function setEditorText(text: string): boolean {
  const target = findPasteTarget(getPromptsConfig(), (xp) => getByXPath(xp) as Element | null);
  if (!target) return false;
  return replaceEditorText(target, text);
}

function sleep(ms: number): Promise<void> {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/** Wait for the submit button to be present and enabled. */
async function waitForSubmitReady(maxMs: number): Promise<HTMLElement | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (repeatLoopState.cancelled) return null;
    const btn = findAddToTasksButton();
    if (btn && !(btn as HTMLButtonElement).disabled) return btn;
    await sleep(POLL_MS);
  }
  return null;
}

/** Wait until Lovable finishes processing (submit becomes disabled then re-enabled, or Return button visible→hidden). */
async function waitForCompletion(maxMs: number): Promise<void> {
  const deadline = Date.now() + maxMs;
  // Brief wait for state transition into "processing"
  await sleep(800);
  while (Date.now() < deadline) {
    if (repeatLoopState.cancelled) return;
    const btn = findAddToTasksButton();
    const processing = isReturnButtonVisible() || !btn || (btn as HTMLButtonElement).disabled;
    if (!processing) return;
    await sleep(POLL_MS);
  }
}

async function waitBetweenIterations(): Promise<void> {
  if (repeatLoopState.waitMode === WAIT_MODE_FIXED_DELAY) {
    const ms = Math.max(1, repeatLoopState.delaySec) * 1000;
    const until = Date.now() + ms;
    setPhase('waiting-delay', ms);
    while (Date.now() < until && !repeatLoopState.cancelled) {
      await sleep(Math.min(POLL_MS, until - Date.now()));
    }
    return;
  }
  setPhase('waiting-completion', 0);
  await waitForCompletion(MAX_WAIT_MS);
}

function setPhase(phase: RepeatPhase, durationMs: number): void {
  repeatLoopState.phase = phase;
  repeatLoopState.phaseStartedAt = Date.now();
  repeatLoopState.phaseDeadlineAt = durationMs > 0 ? Date.now() + durationMs : 0;
  notify();
}

/**
 * Submit the chat form. Prefers form#chat-input.requestSubmit() over
 * clicking the submit button (v3.59.0 — Issue 127): the form-level
 * submit is the framework's contract and avoids breaking when Lovable
 * re-renders the button DOM (which the brittle XPath-based locator
 * could miss). Falls back to button.click() only when the form is
 * absent.
 */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function getRepeatChatForm(TAG: string): HTMLElement | null {
  try { return document.getElementById('chat-input'); }
  catch (e) {
    const m = errMsg(e);
    showPasteToast('⚠ ' + TAG + ': getElementById threw (' + m + ')', true);
    log('Repeat: getElementById threw — ' + m, 'warn');
    return null;
  }
}

function tryRepeatSubmitForm(TAG: string, form: HTMLElement | null): boolean {
  if (form instanceof HTMLFormElement) {
    try {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else {
        showPasteToast('⚠ ' + TAG + ': requestSubmit unsupported — using submit event', false);
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
      return true;
    } catch (e) {
      const m = errMsg(e);
      showPasteToast('⚠ ' + TAG + ': requestSubmit failed (' + m + ') — trying button', true);
      log('Repeat: form#chat-input.requestSubmit() threw — falling back to button click: ' + m, 'warn');
    }
  } else if (form) {
    showPasteToast('⚠ ' + TAG + ': #chat-input is <' + form.tagName.toLowerCase() + '>, not <form> — using button', true);
    log('Repeat: #chat-input is not <form> (got ' + form.tagName + ')', 'warn');
  } else {
    showPasteToast('⚠ ' + TAG + ': no #chat-input form — using button fallback', true);
  }
  return false;
}

function tryRepeatSubmitButton(TAG: string): boolean {
  let btn: HTMLElement | null = null;
  try { btn = findAddToTasksButton(); }
  catch (e) { log('Repeat: findAddToTasksButton threw — ' + errMsg(e), 'warn'); }
  if (!btn || (btn as HTMLButtonElement).disabled) {
    showPasteToast('❌ ' + TAG + ': no enabled submit button — submit failed', true);
    return false;
  }
  try {
    btn.click();
    showPasteToast('✅ ' + TAG + ': submitted via submit-button fallback', false);
    return true;
  } catch (e) {
    const m = errMsg(e);
    showPasteToast('❌ ' + TAG + ': button click threw (' + m + ')', true);
    log('Repeat: submit-button .click() threw — ' + m, 'warn');
    return false;
  }
}

function dispatchChatSubmit(): boolean {
  const TAG = 'Repeat';
  if (typeof document === 'undefined' || !document.body) {
    showPasteToast('❌ ' + TAG + ': submit aborted — document not ready', true);
    log('Repeat: submit aborted — document/body not available', 'warn');
    return false;
  }
  const form = getRepeatChatForm(TAG);
  if (tryRepeatSubmitForm(TAG, form)) return true;
  return tryRepeatSubmitButton(TAG);
}


/** Returns true if iteration submitted successfully; false if loop should break. */
async function submitOneIteration(): Promise<boolean> {
  setPhase('submitting', 0);
  if (!setEditorText(repeatLoopState.capturedText)) {
    showPasteToast('❌ Repeat: editor not found — stopped at ' + repeatLoopState.completed + '/' + repeatLoopState.count, true);
    return false;
  }
  const btn = await waitForSubmitReady(MAX_WAIT_MS);
  if (!btn) {
    if (!repeatLoopState.cancelled) {
      showPasteToast('❌ Repeat: submit button never ready — stopped at ' + repeatLoopState.completed + '/' + repeatLoopState.count, true);
    }
    return false;
  }
  if (!dispatchChatSubmit()) {
    showPasteToast('❌ Repeat: no form#chat-input nor submit button — stopped at ' + repeatLoopState.completed + '/' + repeatLoopState.count, true);
    return false;
  }
  repeatLoopState.completed++;
  log('Repeat: iteration ' + repeatLoopState.completed + '/' + repeatLoopState.count + ' submitted (form#chat-input)', 'info');
  showPasteToast('🔁 Repeat: ' + repeatLoopState.completed + '/' + repeatLoopState.count, false);
  void captureChatSubmit({
    source: 'repeat',
    text: repeatLoopState.capturedText,
    metaJson: JSON.stringify({ iteration: repeatLoopState.completed, total: repeatLoopState.count }),
  });
  notify();
  return true;
}

async function runRepeatLoopAsync(): Promise<void> {
  for (let i = repeatLoopState.completed; i < repeatLoopState.count; i++) {
    if (repeatLoopState.cancelled) break;
    const ok = await submitOneIteration();
    if (!ok) break;
    if (repeatLoopState.completed >= repeatLoopState.count) break;
    await waitBetweenIterations();
  }

  const wasCancelled = repeatLoopState.cancelled;
  const done = repeatLoopState.completed;
  const total = repeatLoopState.count;
  repeatLoopState.running = false;
  repeatLoopState.cancelled = false;
  repeatLoopState.phase = 'idle';
  repeatLoopState.phaseStartedAt = 0;
  repeatLoopState.phaseDeadlineAt = 0;
  notify();

  if (wasCancelled) {
    showPasteToast('⏹ Repeat: stopped at ' + done + '/' + total, false);
  } else if (done >= total) {
    showPasteToast('✅ Repeat: completed ' + total + ' submissions', false);
  }
}

export function startRepeatLoop(): void {
  if (repeatLoopState.running) {
    log('Repeat: already running', 'warn');
    return;
  }
  const text = readEditorText().trim();
  if (!text) {
    showPasteToast('❌ Repeat: chat box is empty — type or paste something first', true);
    return;
  }
  const n = Math.max(1, Math.min(1000, Math.floor(repeatLoopState.count) || 1));
  repeatLoopState.count = n;
  repeatLoopState.capturedText = text;
  repeatLoopState.completed = 0;
  repeatLoopState.cancelled = false;
  repeatLoopState.running = true;
  notify();
  log('RepeatLoop.start: source=repeat-strip N=' + n + ' chars=' + text.length, 'info');
  showPasteToast('🔁 Repeat: starting ' + n + ' submissions…', false);
  void runRepeatLoopAsync();
}

export function stopRepeatLoop(): void {
  if (!repeatLoopState.running) return;
  repeatLoopState.cancelled = true;
  log('Repeat: stop requested', 'warn');
  notify();
}

export function setRepeatCount(n: number): void {
  const v = Math.max(1, Math.min(1000, Math.floor(n) || 1));
  repeatLoopState.count = v;
  notify();
  persist();
}

export function setRepeatWaitMode(mode: RepeatWaitMode): void {
  repeatLoopState.waitMode = mode;
  notify();
  persist();
}

export function setRepeatDelaySec(sec: number): void {
  const v = Math.max(1, Math.min(3600, Math.floor(sec) || 1));
  repeatLoopState.delaySec = v;
  notify();
  persist();
}

export function setRepeatCollapsed(v: boolean): void {
  repeatLoopState.collapsed = v;
  notify();
  persist();
}

export function toggleRepeatCollapsed(): void {
  setRepeatCollapsed(!repeatLoopState.collapsed);
}

// ─────────────────────────────────────────────
// UI building blocks
// ─────────────────────────────────────────────

/**
 * Return the next preset value strictly greater than `current`, wrapping to
 * the lowest tail preset once `current` reaches or exceeds the top of the
 * ladder. Used by the count input's ArrowUp / wheel-up handler so that
 * stepping past 60 snaps to 70 / 75 / 80 / 100 / 200 (and wraps back to the
 * first tail preset >= PRESET_INLINE_MAX after the maximum).
 */
export function nextPresetAbove(current: number): number {
  for (const p of PRESETS) {
    if (p > current) return p;
  }
  // Wrap: find the first preset above the inline threshold to cycle within
  // the "tail" range (60, 70, 75, 80, 100, 200) rather than snapping to 1.
  for (const p of PRESETS) {
    if (p > PRESET_INLINE_MAX) return p;
  }
  return PRESETS[PRESETS.length - 1];
}

/**
 * Return the previous preset value strictly less than `current`, wrapping to
 * the largest tail preset when stepping down from the smallest preset.
 */
export function prevPresetBelow(current: number): number {
  let prev: number | null = null;
  for (const p of PRESETS) {
    if (p < current) prev = p;
    else break;
  }
  if (prev !== null) return prev;
  return PRESETS[PRESETS.length - 1];
}

function buildCountInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.max = '1000';
  input.value = String(repeatLoopState.count);
  input.style.cssText = 'width:60px;padding:3px 6px;background:rgba(0,0,0,0.3);border:1px solid rgba(124,58,237,0.3);border-radius:4px;color:' + cPanelFg + ';font-size:11px;';
  input.oninput = function () { setRepeatCount(parseInt(input.value, 10) || 1); };
  // Once the count reaches the tail range (>= PRESET_INLINE_MAX), snap
  // ArrowUp / ArrowDown / wheel steps through the preset ladder so values
  // beyond 60 cycle into 70, 75, 80, 100, 200 (and wrap) rather than
  // creeping by ±1 or stopping at the current max.
  input.addEventListener('keydown', function (e: KeyboardEvent) {
    const cur = repeatLoopState.count;
    if (cur < PRESET_INLINE_MAX) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setRepeatCount(nextPresetAbove(cur));
      input.value = String(repeatLoopState.count);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setRepeatCount(prevPresetBelow(cur));
      input.value = String(repeatLoopState.count);
    }
  });
  input.addEventListener('wheel', function (e: WheelEvent) {
    if (document.activeElement !== input) return;
    const cur = repeatLoopState.count;
    if (cur < PRESET_INLINE_MAX) return;
    e.preventDefault();
    const next = e.deltaY < 0 ? nextPresetAbove(cur) : prevPresetBelow(cur);
    setRepeatCount(next);
    input.value = String(repeatLoopState.count);
  }, { passive: false });
  return input;
}

const ARIA_EXPANDED = 'aria-expanded';

/**
 * Wire a trigger button to an anchored popover with the standard dismiss
 * contract (outside click, ESC, window pagehide). Returns `{ open, close }`
 * for programmatic use. Teardown mirrors project memory
 * `timer-and-observer-teardown` — no dangling listeners.
 */
function wireTogglePopover(
  wrap: HTMLElement,
  trigger: HTMLElement,
  pop: HTMLElement,
  displayValue: 'flex' | 'inline-flex' = 'flex',
): { open: () => void; close: () => void } {
  function open(): void {
    positionTogglePopoverFixed(trigger, pop);
    pop.hidden = false;
    pop.style.display = displayValue;
    trigger.setAttribute(ARIA_EXPANDED, 'true');
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('pagehide', close);
  }
  function close(): void {
    pop.hidden = true;
    pop.style.display = 'none';
    trigger.setAttribute(ARIA_EXPANDED, 'false');
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('pagehide', close);
  }
  function onDocClick(e: Event): void {
    const target = e.target as Node | null;
    if (!target || wrap.contains(target)) return;
    close();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  }
  trigger.addEventListener('click', function () {
    if (pop.hidden) open(); else close();
  });
  return { open, close };
}

function clampPopoverLeft(rect: DOMRect): number {
  const maxWidth = 340;
  const margin = 8;
  const maxLeft = Math.max(margin, window.innerWidth - maxWidth - margin);
  return Math.max(margin, Math.min(Math.round(rect.left), maxLeft));
}

function positionTogglePopoverFixed(trigger: HTMLElement, pop: HTMLElement): void {
  const rect = trigger.getBoundingClientRect();
  pop.style.position = 'fixed';
  pop.style.top = String(Math.round(rect.bottom + 4)) + 'px';
  pop.style.left = String(clampPopoverLeft(rect)) + 'px';
  pop.style.right = 'auto';
  pop.style.bottom = 'auto';
}

function makePresetButton(n: number, small: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = String(n);
  b.title = 'Set repeat count to ' + n;
  b.dataset.repeatPreset = String(n);
  const pad = small ? '2px 8px' : '2px 6px';
  b.style.cssText = 'padding:' + pad + ';background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);border-radius:4px;color:' + cPanelFg + ';cursor:pointer;font-size:10px;';
  b.onclick = function () { setRepeatCount(n); };
  return b;
}


/**
 * Attach a "More ▾" popover holding the overflow presets. Popover teardown
 * is registered on both `document` (click-away, ESC) and `window` (pagehide)
 * per project memory `timer-and-observer-teardown` — no dangling listeners.
 */
function buildMorePresetsPopover(overflow: readonly number[]): HTMLElement {
  const wrap = document.createElement('span');
  wrap.style.cssText = 'position:relative;display:inline-block;';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.textContent = 'More ▾';
  trigger.title = 'Show more repeat presets (' + overflow.join(', ') + ')';
  trigger.dataset.testid = 'repeat-more-trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute(ARIA_EXPANDED, 'false');
  trigger.style.cssText = 'padding:2px 6px;background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.4);border-radius:4px;color:' + cPanelFg + ';cursor:pointer;font-size:10px;';

  const pop = document.createElement('div');
  pop.dataset.testid = 'repeat-more-popover';
  pop.setAttribute('role', 'menu');
  pop.hidden = true;
  pop.style.cssText = 'position:absolute;top:calc(100% + 4px);left:0;z-index:2147483000;display:none;flex-wrap:wrap;gap:4px;padding:6px;min-width:120px;background:' + cSectionBg + ';border:1px solid rgba(124,58,237,0.4);border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.55);';

  const { close } = wireTogglePopover(wrap, trigger, pop, 'flex');
  for (const n of overflow) {
    const b = makePresetButton(n, true);
    b.addEventListener('click', function () { close(); });
    pop.appendChild(b);
  }
  pop.appendChild(buildMorePopoverSchemeDetails());

  wrap.appendChild(trigger);
  wrap.appendChild(pop);
  return wrap;
}


export function buildCountPresets(): DocumentFragment {
  const frag = document.createDocumentFragment();
  const inline: number[] = [];
  const overflow: number[] = [];
  for (const n of PRESETS) {
    if (n <= PRESET_INLINE_MAX) inline.push(n); else overflow.push(n);
  }
  for (const n of inline) {
    const chip = makePresetButton(n, false);
    chip.dataset['chip'] = '1';
    chip.dataset['n'] = String(n);
    chip.dataset['highlighted'] = '0';
    frag.appendChild(chip);
  }
  if (overflow.length > 0) frag.appendChild(buildMorePresetsPopover(overflow));
  return frag;
}

/**
 * Small "Scheme ⓘ" chip that surfaces the repeat interval ladder and its
 * wrap behavior directly in the strip so the user can see how 60+ values
 * are handled. Renders:
 *   - an inline summary chip labeled `≥50 · ↑↓ 60→70→75→80→100→200 ↺`
 *   - a click-through popover listing every preset with the tail range
 *     highlighted and both wrap arrows (top → 60, 1 → 200) called out.
 * Popover teardown mirrors `buildMorePresetsPopover` (document click-away,
 * ESC, window pagehide) per project memory `timer-and-observer-teardown`.
 */
function buildSchemeSummary(tailLadder: string, tail: readonly number[]): HTMLButtonElement {
  const summary = document.createElement('button');
  summary.type = 'button';
  summary.dataset.testid = 'repeat-scheme-summary';
  summary.setAttribute('aria-haspopup', 'true');
  summary.setAttribute(ARIA_EXPANDED, 'false');
  summary.textContent = 'ⓘ ≥' + PRESET_INLINE_MAX + ' · ↑↓ ' + tailLadder + ' ↺';
  summary.title =
    'Repeat interval scheme.\n' +
    'Below ' + PRESET_INLINE_MAX + ': arrow keys / wheel step by ±1.\n' +
    'At or above ' + PRESET_INLINE_MAX + ': arrow keys / wheel snap through the ladder ' + tailLadder + '.\n' +
    'Past ' + tail[tail.length - 1] + ' wraps back to ' + tail[0] + '; stepping down under 1 wraps to ' + tail[tail.length - 1] + '.\n' +
    'Numeric clamp stays [1, 1000] regardless.';
  summary.style.cssText = 'padding:2px 6px;background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.3);border-radius:4px;color:' + cPanelFg + ';cursor:pointer;font-size:10px;white-space:nowrap;';
  return summary;
}

function buildSchemePopover(tailLadder: string, tail: readonly number[], head: readonly number[]): HTMLDivElement {
  const pop = document.createElement('div');
  pop.dataset.testid = 'repeat-scheme-popover';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Repeat interval scheme');
  pop.hidden = true;
  pop.style.cssText = 'position:absolute;top:calc(100% + 4px);right:0;z-index:2147483000;display:none;flex-direction:column;gap:6px;padding:10px 12px;min-width:240px;max-width:320px;background:' + cSectionBg + ';border:1px solid rgba(124,58,237,0.45);border-radius:6px;box-shadow:0 8px 20px rgba(0,0,0,0.55);font-size:11px;color:' + cPanelFg + ';';

  const title = document.createElement('div');
  title.textContent = 'Repeat interval scheme';
  title.style.cssText = 'font-weight:600;color:' + cPrimaryLight + ';';
  pop.appendChild(title);

  const rowFine = document.createElement('div');
  rowFine.dataset.testid = 'repeat-scheme-fine-row';
  rowFine.textContent = 'Below ' + PRESET_INLINE_MAX + ' (' + head.join(', ') + '): ↑↓ / wheel = ±1.';
  pop.appendChild(rowFine);

  const rowLadder = document.createElement('div');
  rowLadder.dataset.testid = 'repeat-scheme-ladder-row';
  rowLadder.textContent = '≥' + PRESET_INLINE_MAX + ' snaps: ' + tailLadder + '.';
  rowLadder.style.cssText = 'color:' + cPrimaryLight + ';';
  pop.appendChild(rowLadder);

  const rowWrap = document.createElement('div');
  rowWrap.dataset.testid = 'repeat-scheme-wrap-row';
  rowWrap.textContent = 'Wrap: ' + tail[tail.length - 1] + ' → ' + tail[0] + ' (↑ past top), 1 → ' + tail[tail.length - 1] + ' (↓ past bottom).';
  pop.appendChild(rowWrap);

  const rowClamp = document.createElement('div');
  rowClamp.textContent = 'Numeric clamp: [1, 1000]. Typing bypasses snapping.';
  rowClamp.style.cssText = 'opacity:0.8;';
  pop.appendChild(rowClamp);

  return pop;
}

function buildMorePopoverSchemeDetails(): HTMLElement {
  const tail = PRESETS.filter(p => p > PRESET_INLINE_MAX);
  const head = PRESETS.filter(p => p <= PRESET_INLINE_MAX);
  const tailLadder = tail.join('→');
  const tailFirst = tail[0] ?? PRESET_INLINE_MAX;
  const tailLast = tail[tail.length - 1] ?? PRESET_INLINE_MAX;
  const details = document.createElement('div');
  details.dataset.testid = 'repeat-more-scheme-details';
  details.style.cssText = 'display:flex;flex-direction:column;gap:5px;flex:1 0 100%;margin-top:6px;padding-top:6px;border-top:1px solid rgba(124,58,237,0.25);font-size:10px;color:' + cPanelFg + ';line-height:1.35;';

  const title = document.createElement('div');
  title.textContent = 'Interval scheme';
  title.style.cssText = 'font-weight:600;color:' + cPrimaryLight + ';';
  details.appendChild(title);

  const fineRow = document.createElement('div');
  fineRow.dataset.testid = 'repeat-scheme-fine-row';
  fineRow.textContent = 'Below ' + PRESET_INLINE_MAX + ' (' + head.join(', ') + '): ↑↓ / wheel = ±1.';
  details.appendChild(fineRow);

  const ladderRow = document.createElement('div');
  ladderRow.dataset.testid = 'repeat-scheme-ladder-row';
  ladderRow.textContent = '≥' + PRESET_INLINE_MAX + ' snaps: ' + tailLadder + '.';
  ladderRow.style.cssText = 'color:' + cPrimaryLight + ';';
  details.appendChild(ladderRow);

  const wrapRow = document.createElement('div');
  wrapRow.dataset.testid = 'repeat-scheme-wrap-row';
  wrapRow.textContent = 'Wrap: ' + tailLast + ' → ' + tailFirst + ', 1 → ' + tailLast + '.';
  details.appendChild(wrapRow);

  return details;
}

export function buildRepeatSchemeLegend(): HTMLElement {
  const tail = PRESETS.filter(p => p > PRESET_INLINE_MAX);
  const head = PRESETS.filter(p => p <= PRESET_INLINE_MAX);
  const tailLadder = tail.join('→');

  const wrap = document.createElement('span');
  wrap.dataset.testid = 'repeat-scheme-legend';
  wrap.style.cssText = 'position:relative;display:inline-flex;align-items:center;gap:4px;margin-left:4px;padding-left:6px;border-left:1px solid rgba(124,58,237,0.25);';

  const summary = buildSchemeSummary(tailLadder, tail);
  const pop = buildSchemePopover(tailLadder, tail, head);
  wireTogglePopover(wrap, summary, pop, 'flex');

  wrap.appendChild(summary);
  wrap.appendChild(pop);
  return wrap;
}


interface WaitControls {
  wrap: HTMLElement;
  modeSel: HTMLSelectElement;
  delayInput: HTMLInputElement;
}

function buildWaitControls(): WaitControls {
  const wrap = document.createElement('span');
  wrap.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding-left:6px;border-left:1px solid rgba(124,58,237,0.25);';
  const waitLabel = document.createElement('span');
  waitLabel.textContent = 'wait';
  waitLabel.style.cssText = 'font-size:10px;opacity:0.8;';
  wrap.appendChild(waitLabel);

  const modeSel = document.createElement('select');
  modeSel.style.cssText = 'padding:2px 4px;background:rgba(0,0,0,0.3);border:1px solid rgba(124,58,237,0.3);border-radius:4px;color:' + cPanelFg + ';font-size:10px;';
  const optA = document.createElement('option'); optA.value = WAIT_MODE_SUBMIT_READY; optA.textContent = 'auto (submit ready)'; modeSel.appendChild(optA);
  const optB = document.createElement('option'); optB.value = WAIT_MODE_FIXED_DELAY; optB.textContent = 'fixed delay'; modeSel.appendChild(optB);
  modeSel.value = repeatLoopState.waitMode;
  modeSel.onchange = function () { setRepeatWaitMode(modeSel.value as RepeatWaitMode); };
  wrap.appendChild(modeSel);

  const delayInput = document.createElement('input');
  delayInput.type = 'number'; delayInput.min = '1'; delayInput.max = '3600';
  delayInput.value = String(repeatLoopState.delaySec);
  delayInput.title = 'Fixed delay between iterations (seconds)';
  delayInput.style.cssText = 'width:52px;padding:2px 4px;background:rgba(0,0,0,0.3);border:1px solid rgba(124,58,237,0.3);border-radius:4px;color:' + cPanelFg + ';font-size:10px;';
  delayInput.oninput = function () { setRepeatDelaySec(parseInt(delayInput.value, 10) || 1); };
  wrap.appendChild(delayInput);
  const sUnit = document.createElement('span'); sUnit.textContent = 's'; sUnit.style.cssText = 'font-size:10px;opacity:0.7;'; wrap.appendChild(sUnit);

  for (const s of DELAY_PRESETS_SEC) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = s + 's'; b.title = 'Set fixed delay to ' + s + 's';
    b.style.cssText = 'padding:1px 4px;background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.25);border-radius:3px;color:' + cPanelFg + ';cursor:pointer;font-size:9px;';
    b.onclick = function () { setRepeatWaitMode(WAIT_MODE_FIXED_DELAY); setRepeatDelaySec(s); };
    wrap.appendChild(b);
  }

  return { wrap, modeSel, delayInput };
}

interface ControlRefs {
  input: HTMLInputElement;
  modeSel: HTMLSelectElement;
  delayInput: HTMLInputElement;
  action: HTMLButtonElement;
  progress: HTMLElement;
}

function formatPhaseTimer(): string {
  const now = Date.now();
  const phase = repeatLoopState.phase;
  if (phase === 'idle') return '';
  if (phase === 'submitting') return '⏳ submitting…';
  if (phase === 'waiting-completion') {
    const elapsed = Math.max(0, Math.floor((now - repeatLoopState.phaseStartedAt) / 1000));
    return '⏱ waiting reply ' + elapsed + 's';
  }
  // waiting-delay (fixed delay): show countdown
  const remainMs = Math.max(0, repeatLoopState.phaseDeadlineAt - now);
  const remainSec = Math.ceil(remainMs / 1000);
  return '⏱ next in ' + remainSec + 's';
}

function renderControl(refs: ControlRefs): void {
  refs.input.value = String(repeatLoopState.count);
  refs.input.disabled = repeatLoopState.running;
  refs.modeSel.value = repeatLoopState.waitMode;
  refs.modeSel.disabled = repeatLoopState.running;
  refs.delayInput.value = String(repeatLoopState.delaySec);
  refs.delayInput.disabled = repeatLoopState.running || repeatLoopState.waitMode !== WAIT_MODE_FIXED_DELAY;
  refs.delayInput.style.opacity = repeatLoopState.waitMode === WAIT_MODE_FIXED_DELAY ? '1' : '0.45';
  const startGradient = 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 50%,#2563eb 100%)';
  const stopGradient = 'linear-gradient(135deg,#dc2626 0%,#b91c1c 50%,#7f1d1d 100%)';
  const startShadow = '0 2px 6px rgba(79,70,229,0.45), inset 0 1px 0 rgba(255,255,255,0.18)';
  const stopShadow = '0 2px 6px rgba(220,38,38,0.45), inset 0 1px 0 rgba(255,255,255,0.18)';
  if (repeatLoopState.running) {
    refs.action.textContent = '⏹ Stop';
    refs.action.style.background = stopGradient;
    refs.action.style.boxShadow = stopShadow;
    const timer = formatPhaseTimer();
    refs.progress.textContent = repeatLoopState.completed + '/' + repeatLoopState.count + (timer ? ' • ' + timer : '');
  } else {
    refs.action.textContent = '🔁 Repeat';
    refs.action.style.background = startGradient;
    refs.action.style.boxShadow = startShadow;
    refs.progress.textContent = repeatLoopState.completed > 0
      ? 'done ' + repeatLoopState.completed + '/' + repeatLoopState.count
      : '';
  }
}

function buildActionButton(): HTMLButtonElement {
  const action = document.createElement('button');
  action.type = 'button';
  const startGradient = 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 50%,#2563eb 100%)';
  action.style.cssText = 'padding:5px 14px;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:#fff;background:' + startGradient + ';margin-left:auto;box-shadow:0 2px 6px rgba(79,70,229,0.45), inset 0 1px 0 rgba(255,255,255,0.18);transition:transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;';
  action.onmouseenter = function () {
    action.style.filter = 'brightness(1.08)';
    action.style.transform = 'translateY(-1px)';
  };
  action.onmouseleave = function () {
    action.style.filter = '';
    action.style.transform = '';
  };
  action.onclick = function () {
    if (repeatLoopState.running) stopRepeatLoop();
    else startRepeatLoop();
  };
  return action;
}


function buildCollapseButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = 'Collapse repeat controls';
  btn.style.cssText = 'margin-left:4px;padding:2px 6px;background:transparent;border:1px solid rgba(124,58,237,0.3);border-radius:4px;color:' + cPanelFg + ';cursor:pointer;font-size:11px;line-height:1;';
  btn.textContent = '–';
  btn.onclick = function () { toggleRepeatCollapsed(); };
  return btn;
}

interface BuiltTopRow {
  row: HTMLElement;
  input: HTMLInputElement;
  action: HTMLButtonElement;
  progress: HTMLElement;
}

function buildTopRow(opts: { useLocalCollapse: boolean }): BuiltTopRow {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:nowrap;flex:1 1 auto;min-width:0;overflow:hidden;';

  const label = document.createElement('span');
  label.textContent = '🔁 Repeat';
  label.style.cssText = 'font-weight:600;color:' + cPrimaryLight + ';flex:0 0 auto;';
  row.appendChild(label);

  const input = buildCountInput();
  input.style.flex = '0 0 auto';
  row.appendChild(input);

  const presetsWrap = document.createElement('span');
  presetsWrap.style.cssText = 'position:relative;display:flex;align-items:center;gap:4px;flex-wrap:nowrap;flex:1 1 auto;min-width:0;';
  presetsWrap.appendChild(buildCountPresets());
  const chipOverflowSentinel = document.createElement('span');
  chipOverflowSentinel.style.cssText = 'display:none;flex-shrink:0;';
  presetsWrap.appendChild(chipOverflowSentinel);
  row.appendChild(presetsWrap);

  const progress = document.createElement('span');
  progress.style.cssText = 'font-size:10px;color:' + cPrimaryLight + ';flex:0 0 auto;min-width:42px;text-align:right;';
  row.appendChild(progress);

  const action = buildActionButton();
  action.style.marginLeft = '4px';
  action.style.flex = '0 0 auto';
  action.dataset['trailingAction'] = '1';
  row.appendChild(action);
  if (opts.useLocalCollapse) row.appendChild(buildCollapseButton());

  void (async () => {
    try {
      const mod = await import('./next-inline-ui');
      mod.installChipOverflow(presetsWrap, chipOverflowSentinel, buildRepeatChipForOverflow, 'rgba(124,58,237,0.6)');
      mod.installActionOverflow(row, 'rgba(124,58,237,0.6)');
    } catch (e) {
      log('Repeat: overflow install failed — ' + (e instanceof Error ? e.message : String(e)), 'warn');
    }
  })();

  return { row, input, action, progress };
}

function buildRepeatChipForOverflow(n: number, highlighted: boolean): HTMLElement {
  const chip = makePresetButton(n, true);
  chip.dataset['chip'] = '1';
  chip.dataset['n'] = String(n);
  chip.dataset['highlighted'] = highlighted ? '1' : '0';
  return chip;
}

function buildBottomRow(): { row: HTMLElement; wait: WaitControls } {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';
  row.appendChild(buildNextSelectorControl());
  const wait = buildWaitControls();
  wait.wrap.style.marginLeft = '0';
  wait.wrap.style.paddingLeft = '0';
  wait.wrap.style.borderLeft = 'none';
  row.appendChild(wait.wrap);
  return { row, wait };
}

function buildCollapsedPill(): HTMLButtonElement {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.title = 'Expand repeat controls';
  pill.style.cssText = 'display:none;align-items:center;gap:4px;padding:3px 8px;background:' + cSectionBg + ';border:1px solid rgba(124,58,237,0.3);border-radius:999px;color:' + cPrimaryLight + ';cursor:pointer;font:600 11px system-ui,-apple-system,sans-serif;flex:0 0 auto;';
  pill.onclick = function () { toggleRepeatCollapsed(); };
  return pill;
}

function applyRootStyle(root: HTMLElement, opts: { compact: boolean }): void {
  const pad = opts.compact ? '4px 8px' : '6px 8px';
  const rootBg = opts.compact ? 'rgba(124,58,237,0.10)' : cSectionBg;
  const rootBorder = opts.compact ? 'none' : '1px solid rgba(124,58,237,0.25)';
  const rootRadius = opts.compact ? '5px' : '6px';
  root.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:' + pad + ';background:' + rootBg + ';border:' + rootBorder + ';border-radius:' + rootRadius + ';font-family:system-ui,-apple-system,sans-serif;color:' + cPanelFg + ';font-size:11px;flex:1;box-sizing:border-box;';
}

function buildControl(opts: { compact: boolean; useLocalCollapse: boolean }): HTMLElement {
  const host = document.createElement('div');
  host.style.cssText = 'display:inline-flex;align-items:stretch;width:100%;';

  const root = document.createElement('div');
  applyRootStyle(root, opts);

  const top = buildTopRow({ useLocalCollapse: opts.useLocalCollapse });
  root.appendChild(top.row);
  const bottom = buildBottomRow();
  root.appendChild(bottom.row);

  const pill = buildCollapsedPill();
  host.appendChild(pill);
  host.appendChild(root);

  const refs: ControlRefs = {
    input: top.input, modeSel: bottom.wait.modeSel, delayInput: bottom.wait.delayInput,
    action: top.action, progress: top.progress,
  };
  const render = (): void => {
    renderControl(refs);
    const collapsed = opts.useLocalCollapse && repeatLoopState.collapsed;
    root.style.display = collapsed ? 'none' : 'flex';
    pill.style.display = collapsed ? 'inline-flex' : 'none';
    if (collapsed) {
      const status = repeatLoopState.running
        ? '🔁 ' + repeatLoopState.completed + '/' + repeatLoopState.count
        : '🔁 Repeat';
      pill.textContent = status + ' ▸';
    }
  };
  render();
  repeatLoopState.subscribers.add(render);
  // Tick teardown: previously used raw setInterval which:
  //   (a) escaped resetIntervalRegistry() sweeps on shutdown,
  //   (b) leaked the `render` subscriber after DOM removal.
  // Now: tracked timer + MutationObserver-free host-removal probe that also
  // unsubscribes render, and a pagehide safety net so navigation cannot
  // leave dangling closures alive.
  let tickId: ReturnType<typeof trackedSetInterval> | null = null;
  const teardown = (): void => {
    if (tickId !== null) { trackedClearInterval(tickId); tickId = null; }
    repeatLoopState.subscribers.delete(render);
    window.removeEventListener('pagehide', teardown);
  };
  tickId = trackedSetInterval('RepeatLoopUI.tick', function () {
    if (typeof document === 'undefined' || !document.body || !document.body.contains(host)) { teardown(); return; }
    if (repeatLoopState.running) render();
  }, 1000);
  window.addEventListener('pagehide', teardown, { once: true });
  return host;
}



/** Macro-panel section (compact, sits in the panel body). */
export function buildRepeatPanelSection(): HTMLElement {
  return buildControl({ compact: true, useLocalCollapse: true });
}

// ─────────────────────────────────────────────
// Inline strip above Lovable's chat textarea
// ─────────────────────────────────────────────

const INLINE_ID = 'marco-repeat-inline';

const INLINE_WRAP_ID = 'marco-repeat-inline-wrap';

function tryMountInline(): boolean {
  if (document.getElementById(INLINE_WRAP_ID)) return true;
  const target = findPasteTarget(getPromptsConfig(), (xp) => getByXPath(xp) as Element | null);
  if (!target) return false;
  // Mount above the closest form, falling back to the editor's parent.
  const host = (target.closest && target.closest('form')) || target.parentElement;
  if (!host || !host.parentElement) return false;

  // v4.16+: mount into shared frame body so Plan/Next/Repeat share one visual
  // unit and one minimize control. See inline-strips-frame.ts.
  const framed = ensureInlineStripsFrame(host as HTMLElement);
  if (!framed) return false;

  const wrap = document.createElement('div');
  wrap.id = INLINE_WRAP_ID;
  wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin:0;';
  const strip = buildControl({ compact: true, useLocalCollapse: false });
  strip.id = INLINE_ID;
  strip.style.margin = '0';
  wrap.appendChild(strip);
  framed.body.appendChild(wrap);
  applyInlineStripGroupCollapse();
  // Ensure collapse state applies again after any subsequent group-toggle
  // click, since Repeat used to have its own toggle.
  subscribeInlineStripGroupCollapse(function () { applyInlineStripGroupCollapse(); });
  log('Repeat: inline strip mounted into unified frame', 'info');
  return true;
}

let _inlineObserver: MutationObserver | null = null;

export function mountRepeatInlineStrip(): void {
  if (tryMountInline()) return;
  if (_inlineObserver) return;
  _inlineObserver = new MutationObserver(function () {
    if (typeof document === 'undefined' || !document.body) return;
    if (!document.getElementById(INLINE_WRAP_ID) && tryMountInline()) {
      // Keep observing — Lovable re-renders the chat shell on route changes
      // and we want to remount when it disappears.
    }
  });
  _inlineObserver.observe(document.body, { childList: true, subtree: true });
}

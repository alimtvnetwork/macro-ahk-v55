 
/**
 * MacroLoop Controller — Task Next Automation UI
 * Step 03e: Extracted from createUI() closure
 *
 * Automated multi-task prompt injection with configurable delays and retries.
 */

import { log, logSub } from '../logger';
import { Label, type PromptEntry, type ResolvedPromptsConfig } from '../types';
import { showPasteToast, pasteIntoEditor } from './prompt-utils';


import { logError } from '../error-utils';
import { getPersistentTaskQueue, resolveTaskQueueProjectId } from '../queue-control/task-queue-project-store';
import { REPLACE_KEY_DEFAULT } from '../db/prompt-defaults';
import { substituteToken } from '../utils/token-substitute';
/** Settings shape for Task Next */
export interface TaskNextSettings {
  [key: string]: TaskNextSettingValue;
  preClickDelayMs: number;
  postClickDelayMs: number;
  retryCount: number;
  retryDelayMs: number;
  buttonXPath: string;
  promptSlug: string;
  requireStartForMultiRun: boolean;
}

/** Concrete union of all setting value types — derived from TaskNextSettings */
export type TaskNextSettingValue = TaskNextSettings[keyof TaskNextSettings];

/** Mutable state for Task Next */
export const taskNextState: {
  settings: TaskNextSettings;
  running: boolean;
  cancelled: boolean;
  queue: {
    total: number;
    completed: number;
    running: boolean;
    startedAt: number;
  };
} = {
  settings: {
    preClickDelayMs: 500,
    postClickDelayMs: 2000,
    retryCount: 3,
    retryDelayMs: 1000,
    buttonXPath: '/html/body/div[3]/div/div[2]/main/div/div/div[1]/div/div[2]/div/form/div[2]/div/button[2]',
    promptSlug: Label.NextTasks,
    requireStartForMultiRun: true,
  },
  running: false,
  cancelled: false,
  queue: { total: 0, completed: 0, running: false, startedAt: 0 },
};

export interface TaskNextDeps {
  sendToExtension: (type: string, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
  getPromptsConfig: () => ResolvedPromptsConfig;
  getByXPath: (xpath: string) => Element | null;
}

export function loadTaskNextSettings(deps: TaskNextDeps, cb?: () => void) {
  deps.sendToExtension('KV_GET', { key: 'task_next_settings', projectId: '_global' }).then(function(resp) {
    if (resp && resp.value) {
      try {
        const saved = JSON.parse(resp.value as string);
        for (const k of Object.keys(saved)) {
          if (k !== 'requireStartForMultiRun' && Object.prototype.hasOwnProperty.call(taskNextState.settings, k)) {
            taskNextState.settings[k] = saved[k];
          }
        }
        taskNextState.settings.requireStartForMultiRun = true;
      } catch (e) { log('Task Next: failed to parse saved settings — ' + (e instanceof Error ? e.message : String(e)), 'warn'); }
    }
    if (cb) {
      cb();
    }
  });
}

export function saveTaskNextSettings(deps: TaskNextDeps) {
  deps.sendToExtension('KV_SET', { key: 'task_next_settings', value: JSON.stringify(taskNextState.settings), projectId: '_global' }).then(function() {
    log('Task Next settings saved', 'info');
  });
}

function matchPromptBySlug<T extends { slug?: string }>(entries: ReadonlyArray<T>, aliases: Set<string>): T | null {
  for (const entry of entries) {
    const entrySlug = (entry.slug || '').toLowerCase();
    if (aliases.has(entrySlug)) return entry;
  }
  return null;
}

function matchPromptById<T extends { id?: string }>(entries: ReadonlyArray<T>, aliases: Set<string>): T | null {
  for (const entry of entries) {
    const id = (entry.id || '').toLowerCase();
    for (const alias of aliases) {
      if (id === alias || id === 'default-' + alias || id.indexOf(alias) !== -1) return entry;
    }
  }
  return null;
}

function matchPromptByDerivedSlugOrKeywords<T extends { name?: string }>(entries: ReadonlyArray<T>, aliases: Set<string>): T | null {
  for (const entry of entries) {
    const derivedSlug = (entry.name || '').toLowerCase().replace(/\s+/g, '-');
    if (aliases.has(derivedSlug)) return entry;
  }
  for (const entry of entries) {
    const name = (entry.name || '').toLowerCase();
    if (name.indexOf('next') !== -1 && (name.indexOf('task') !== -1 || name.indexOf('step') !== -1)) return entry;
  }
  return null;
}

export function findNextTasksPrompt(deps: TaskNextDeps) {
  const promptsCfg = deps.getPromptsConfig();
  const entries = promptsCfg.entries || [];
  const targetSlug = taskNextState.settings.promptSlug || Label.NextTasks;
  const aliases = new Set<string>([targetSlug, 'next-tasks', 'next-steps']);

  const slugMap = entries.map(function(e) { return e.name + ' → slug=' + (e.slug || '⚠️ MISSING') + ', id=' + (e.id || '—'); });
  log('Task Next: Resolving target="' + targetSlug + '" (aliases=' + Array.from(aliases).join(',') + ') across ' + entries.length + ' entries:\n  ' + slugMap.join('\n  '), 'info');

  const found = matchPromptBySlug(entries, aliases)
    || matchPromptById(entries, aliases)
    || matchPromptByDerivedSlugOrKeywords(entries, aliases);
  if (found) {
    log('Task Next: Found prompt: "' + found.name + '" (slug=' + (found.slug || '—') + ', id=' + (found.id || '—') + ')', 'info');
    return found;
  }

  log('Task Next: ❌ No prompt matched target slug "' + targetSlug + '" (aliases: next-tasks/next-steps) across ' + entries.length + ' entries. ' +
    'Ensure a prompt with slug "next-tasks" or "next-steps", or name containing "Next" + "Tasks"/"Steps", exists. Returning null — aborting.', 'error');
  return null;
}



/** Try to find the button via user-configured XPath. */
function findButtonByXPath(): HTMLElement | null {
  try {
    const result = document.evaluate(taskNextState.settings.buttonXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    const btn = result.singleNodeValue;
    if (btn && (btn as HTMLElement).tagName && !(btn as HTMLButtonElement).disabled) return btn as HTMLElement;
  } catch (e) { log('Task Next: XPath evaluation failed — ' + (e instanceof Error ? e.message : String(e)), 'warn'); }
  return null;
}

/** Try to find the send/submit button via CSS selectors. */
function findButtonBySelectors(): HTMLElement | null {
  const sendSelectors = [
    'form button[type="submit"]',
    'form button:not([disabled]):last-of-type',
    'form button svg[data-testid="send-icon"]',
    'button[aria-label*="send" i]',
    'button[aria-label*="Send" i]',
    'button[data-testid*="send" i]',
    'form div[role="toolbar"] button:last-child',
    'form button:nth-child(2)',
  ];

  for (const selector of sendSelectors) {
    try {
      const el = document.querySelector(selector);
      if (!el) continue;

      const btn = el.tagName === 'BUTTON' ? el : el.closest('button');
      if (!btn || (btn as HTMLButtonElement).disabled) continue;

      log('Task Next: Found submit button via selector: ' + selector, 'info');
      return btn as HTMLElement;
    } catch (e) { logSub('Task Next: querySelector failed for "' + selector + '": ' + (e instanceof Error ? e.message : String(e)), 1); }
  }

  return null;
}

export function findAddToTasksButton(): HTMLElement | null {
  return findButtonByXPath() || findButtonBySelectors();
}

type TaskNextPromptSource = 'queue' | 'legacy';

interface TaskNextPromptSelection {
  readonly text: string;
  readonly source: TaskNextPromptSource;
  readonly remaining: number;
}

interface TaskNextPromptResult {
  readonly selection: TaskNextPromptSelection | null;
  readonly failed: boolean;
}

export async function dequeueTaskNextPrompt(): Promise<TaskNextPromptResult> {
  try {
    const projectId = resolveTaskQueueProjectId();
    const queue = getPersistentTaskQueue();
    const item = await queue.dequeue(projectId);
    if (!item) return { selection: null, failed: false };
    const remaining = await queue.count(projectId);
    log('Task Next: dequeued splitter task for project ' + projectId + ' (' + remaining + ' left)', 'info');
    return { selection: { text: item.text, source: 'queue', remaining }, failed: false };
  } catch (caught: CaughtError) {
    logError('Task Next queue', 'dequeue failed before single Next injection; aborting fallback', caught);
    showPasteToast('❌ Task Next: queue read failed', true);
    return { selection: null, failed: true };
  }
}

export function substituteTaskNextPromptText(prompt: Pick<PromptEntry, 'text' | 'replaceKey'>, n: number): string {
  return substituteToken(prompt.text, prompt.replaceKey || REPLACE_KEY_DEFAULT, n);
}

function selectLegacyTaskNextPrompt(deps: TaskNextDeps, n: number): TaskNextPromptSelection | null {
  const prompt = findNextTasksPrompt(deps);
  if (!prompt || !prompt.text) {
    logError('Task Next', '"Next Tasks" prompt not found — aborting');
    showPasteToast('❌ "Next Tasks" prompt not found', true);
    return null;
  }
  return { text: substituteTaskNextPromptText(prompt, n), source: 'legacy', remaining: 0 };
}

async function selectTaskNextPrompt(deps: TaskNextDeps, n: number): Promise<TaskNextPromptResult> {
  const queued = await dequeueTaskNextPrompt();
  if (queued.failed || queued.selection) return queued;
  return { selection: selectLegacyTaskNextPrompt(deps, n), failed: false };
}

function reportTaskNextPaste(selection: TaskNextPromptSelection): void {
  if (selection.source === 'queue') {
    showPasteToast('⏭ Task Next: pasted queued task (' + selection.remaining + ' left) — click Submit to send', false);
    return;
  }
  showPasteToast('⏭ Task Next: pasted — click Submit to send', false);
}



export async function runTaskNextLoop(deps: TaskNextDeps, count: number): Promise<void> {
  if (taskNextState.running) {
    log('Task Next: Already running', 'warn');
    return;
  }

  // PASTE-ONLY behaviour (v3.74.0): the Next button (and any "Next N steps"
  // preset) must only paste the prompt into the chat box. It must NOT click
  // the submit button and must NOT loop / chain follow-up tasks. Repeated
  // submissions belong exclusively to the `🔁 Repeat` control.
  const requested = Math.max(1, Math.floor(count) || 1);
  if (requested > 1) {
    log('Task Next: multi-run blocked; pasting once only. Use Repeat Start for repeats.', 'warn');
  }
  const result = await selectTaskNextPrompt(deps, requested);
  if (result.failed || !result.selection) {
    return;
  }

  const promptsCfg = deps.getPromptsConfig();
  const outcome = await pasteIntoEditor(result.selection.text, promptsCfg, deps.getByXPath);

  if (String(outcome) === 'failed') {
    logError('Task Next', 'Failed to inject prompt');
    showPasteToast('❌ Task Next: Injection failed', true);
    return;
  }

  log('Task Next: pasted ' + result.selection.source + ' prompt (no auto-submit)', 'info');
  reportTaskNextPaste(result.selection);
}

/**
 * Submit the chat form — same primitive as `repeat-loop-ui.dispatchChatSubmit`.
 * Prefers `form#chat-input.requestSubmit()` over clicking the submit button so
 * Lovable's own form-level handler runs (avoids brittle XPath drift).
 */
function tnErrMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function getTaskNextForm(TAG: string): HTMLElement | null {
  try { return document.getElementById('chat-input'); }
  catch (e) {
    const msg = tnErrMsg(e);
    showPasteToast('⚠ ' + TAG + ': getElementById threw (' + msg + ')', true);
    log('Task Next: getElementById threw — ' + msg, 'warn');
    return null;
  }
}

function tryTaskNextSubmitForm(TAG: string, form: HTMLElement | null): boolean {
  if (form instanceof HTMLFormElement) {
    try {
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else {
        showPasteToast('⚠ ' + TAG + ': requestSubmit unsupported — using submit event', false);
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
      return true;
    } catch (e) {
      const msg = tnErrMsg(e);
      showPasteToast('⚠ ' + TAG + ': requestSubmit failed (' + msg + ') — trying button', true);
      logError('Task Next', 'form#chat-input.requestSubmit() threw — falling back to button click', e);
    }
  } else if (form) {
    showPasteToast('⚠ ' + TAG + ': #chat-input is <' + form.tagName.toLowerCase() + '>, not <form> — using button', true);
    log('Task Next: #chat-input is not <form> (got ' + form.tagName + ')', 'warn');
  } else {
    showPasteToast('⚠ ' + TAG + ': no #chat-input form — using button fallback', true);
  }
  return false;
}

function tryTaskNextSubmitButton(TAG: string): boolean {
  let btn: HTMLElement | null = null;
  try { btn = findAddToTasksButton(); }
  catch (e) { logError('Task Next', 'findAddToTasksButton threw', e); }
  if (!btn || (btn as HTMLButtonElement).disabled) {
    showPasteToast('❌ ' + TAG + ': no enabled submit button — submit failed', true);
    return false;
  }
  try {
    btn.click();
    showPasteToast('✅ ' + TAG + ': submitted via submit-button fallback', false);
    return true;
  } catch (e) {
    const msg = tnErrMsg(e);
    showPasteToast('❌ ' + TAG + ': button click threw (' + msg + ')', true);
    logError('Task Next', 'submit-button .click() threw', e);
    return false;
  }
}

export function dispatchTaskNextSubmit(): boolean {
  const TAG = 'Task Next';
  if (typeof document === 'undefined' || !document.body) {
    showPasteToast('❌ ' + TAG + ': submit aborted — document not ready', true);
    log('Task Next: submit aborted — document/body not available', 'warn');
    return false;
  }
  const form = getTaskNextForm(TAG);
  if (tryTaskNextSubmitForm(TAG, form)) return true;
  return tryTaskNextSubmitButton(TAG);
}


/**
 * Sequential queue: paste prompt #1 → submit → await Lovable idle → paste #2 →
 * submit → await idle → … up to `count`. Cancellable via the existing Escape
 * handler (`setupTaskNextCancelHandler` flips `taskNextState.cancelled`).
 *
 * Fail-fast per `mem://constraints/no-retry-policy`: any failed cycle (paste,
 * submit, idle-timeout) aborts the rest and logs via `logError` with the
 * cycle index + total in the message.
 *
 * N === 1 delegates to the legacy paste-once `runTaskNextLoop` so the
 * split-button label keeps its v3.79.x behaviour (paste, do NOT submit).
 */
const TASK_NEXT_QUEUE_LABEL = 'Task Next queue';

type CycleStatus = 'ok' | 'paste-failed' | 'submit-failed' | 'idle-cancelled' | 'idle-timeout' | 'cancelled' | 'queue-empty';

async function resolveCyclePrompt(_deps: TaskNextDeps, legacyText: string): Promise<{ text: string; source: TaskNextPromptSource; remaining: number }> {
  const dequeued = await dequeueTaskNextPrompt();
  if (dequeued.failed) return { text: '', source: 'queue', remaining: -1 };
  if (dequeued.selection) return { text: dequeued.selection.text, source: 'queue', remaining: dequeued.selection.remaining };
  return { text: legacyText, source: 'legacy', remaining: 0 };
}

async function runTaskNextCycle(
  deps: TaskNextDeps,
  legacyPromptText: string,
  k: number,
  n: number,
  waitForLovableIdle: typeof import('./lovable-idle').waitForLovableIdle,
): Promise<CycleStatus> {
  if (taskNextState.cancelled) return 'cancelled';
  const cycleStart = Date.now();
  const chosen = await resolveCyclePrompt(deps, legacyPromptText);
  if (chosen.remaining === -1) return 'paste-failed';
  if (!chosen.text) return 'queue-empty';
  const promptsCfg = deps.getPromptsConfig();
  const outcome = pasteIntoEditor(chosen.text, promptsCfg, deps.getByXPath);
  if (String(outcome) === 'failed') return 'paste-failed';
  if (!dispatchTaskNextSubmit()) return 'submit-failed';
  const idleResult = await waitForLovableIdle({
    isCancelled: function() { return taskNextState.cancelled; },
  });
  if (idleResult === 'cancelled') return 'idle-cancelled';
  if (idleResult === 'timeout') return 'idle-timeout';
  taskNextState.queue.completed = k + 1;
  log('[TaskNextQueue] cycle ' + (k + 1) + '/' + n + ' done in ' + (Date.now() - cycleStart) + 'ms (source=' + chosen.source + ')', 'info');
  showPasteToast('🔁 Task Next queue: ' + (k + 1) + '/' + n + ' (' + chosen.source + ')', false);
  return 'ok';
}

function reportCycleStatus(status: CycleStatus, k: number, n: number): void {
  const at = (k + 1) + '/' + n;
  if (status === 'cancelled') {
    showPasteToast('🛑 Task Next queue cancelled at ' + k + '/' + n, false);
    log('[TaskNextQueue] cancelled at cycle ' + k + '/' + n, 'warn');
  } else if (status === 'queue-empty') {
    showPasteToast('✅ Task Next queue drained at ' + k + '/' + n + ' (no more items)', false);
    log('[TaskNextQueue] queue empty at cycle ' + k + '/' + n + ' — stopping', 'info');
  } else if (status === 'paste-failed') {
    logError('Task Next queue', 'cycle ' + at + ' — paste failed; aborting queue');
    showPasteToast('❌ Task Next queue: paste failed at ' + at, true);
  } else if (status === 'submit-failed') {
    logError(TASK_NEXT_QUEUE_LABEL, 'cycle ' + at + ' — no form#chat-input and no submit button; aborting queue');
    showPasteToast('❌ Task Next queue: submit failed at ' + at, true);
  } else if (status === 'idle-cancelled') {
    showPasteToast('🛑 Task Next queue cancelled at ' + at, false);
    log('[TaskNextQueue] cancelled mid-idle at cycle ' + at, 'warn');
  } else if (status === 'idle-timeout') {
    logError(TASK_NEXT_QUEUE_LABEL, 'cycle ' + at + ' — idle gate timed out after 10 min; aborting queue');
    showPasteToast('❌ Task Next queue: timed out waiting at ' + at, true);
  }
}

export async function runTaskNextQueue(deps: TaskNextDeps, count: number): Promise<void> {
  const n = Math.max(1, Math.floor(count) || 1);
  if (n === 1) { runTaskNextLoop(deps, 1); return; }
  if (taskNextState.running) {
    log('Task Next queue: already running — ignoring re-entry', 'warn');
    return;
  }
  const prompt = findNextTasksPrompt(deps);
  const legacyText = prompt && prompt.text ? substituteTaskNextPromptText(prompt, 1) : '';
  let queuedCount = 0;
  try {
    queuedCount = await getPersistentTaskQueue().count(resolveTaskQueueProjectId());
  } catch (caught: CaughtError) {
    logError(TASK_NEXT_QUEUE_LABEL, 'queue count probe failed before drain', caught);
  }
  if (!legacyText && queuedCount === 0) {
    logError(TASK_NEXT_QUEUE_LABEL, '"Next Tasks" prompt not found AND splitter queue empty — aborting queue of ' + n);
    showPasteToast('❌ No queued tasks and no "Next Tasks" prompt', true);
    return;
  }
  // Lazy import to dodge a circular dep (lovable-idle.ts → task-next-ui.ts for findAddToTasksButton).
  const { waitForLovableIdle } = await import('./lovable-idle');

  taskNextState.running = true;
  taskNextState.cancelled = false;
  taskNextState.queue = { total: n, completed: 0, running: true, startedAt: Date.now() };
  log('[TaskNextQueue] starting queue of ' + n + ' — Escape to cancel', 'info');
  showPasteToast('🔁 Task Next queue: 0/' + n + ' — Escape to cancel', false);

  try {
    for (let k = 0; k < n; k++) {
      const status = await runTaskNextCycle(deps, legacyText, k, n, waitForLovableIdle);
      if (status !== 'ok') { reportCycleStatus(status, k, n); break; }
    }
    if (!taskNextState.cancelled && taskNextState.queue.completed >= n) {
      showPasteToast('✅ Task Next queue finished ' + n + '/' + n, false);
      log('[TaskNextQueue] completed ' + n + '/' + n + ' in ' + (Date.now() - taskNextState.queue.startedAt) + 'ms', 'info');
    }
  } catch (err) {
    logError(TASK_NEXT_QUEUE_LABEL, 'unexpected failure at cycle ' + (taskNextState.queue.completed + 1) + '/' + n, err);
    showPasteToast('❌ Task Next queue: unexpected error at ' + (taskNextState.queue.completed + 1) + '/' + n, true);
  } finally {
    taskNextState.queue.running = false;
    taskNextState.running = false;
    taskNextState.cancelled = false;
  }
}


// Escape key cancel handler — call once at init.
// Idempotent: safe to call multiple times (subsequent calls are no-ops).
// Paired teardown on `pagehide` per mem://standards/timer-and-observer-teardown.
let _taskNextEscapeInstalled = false;
let _taskNextEscapeHandler: ((e: KeyboardEvent) => void) | null = null;
let _taskNextPagehideHandler: (() => void) | null = null;

export function setupTaskNextCancelHandler(): void {
  if (_taskNextEscapeInstalled) return;
  _taskNextEscapeInstalled = true;
  _taskNextEscapeHandler = function (e: KeyboardEvent): void {
    if (e.key === 'Escape' && taskNextState.running) {
      taskNextState.cancelled = true;
      log('Task Next: Cancel requested via Escape', 'info');
    }
  };
  document.addEventListener('keydown', _taskNextEscapeHandler);
  _taskNextPagehideHandler = function (): void {
    if (_taskNextEscapeHandler) {
      document.removeEventListener('keydown', _taskNextEscapeHandler);
      _taskNextEscapeHandler = null;
    }
    if (_taskNextPagehideHandler && typeof window !== 'undefined') {
      window.removeEventListener('pagehide', _taskNextPagehideHandler);
    }
    _taskNextEscapeInstalled = false;
    _taskNextPagehideHandler = null;
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', _taskNextPagehideHandler);
  }
}

/** Test-only: reset installer state so idempotency can be re-verified. */
export function __resetTaskNextCancelHandlerForTests(): void {
  if (_taskNextEscapeHandler) {
    document.removeEventListener('keydown', _taskNextEscapeHandler);
  }
  if (_taskNextPagehideHandler && typeof window !== 'undefined') {
    window.removeEventListener('pagehide', _taskNextPagehideHandler);
  }
  _taskNextEscapeInstalled = false;
  _taskNextEscapeHandler = null;
  _taskNextPagehideHandler = null;
}

// Settings modal lives in `./task-next-settings-modal.ts` (Plan-17 step 12).
// Import it directly from there; the re-export was removed to avoid a
// task-next-ui <-> task-next-settings-modal cycle.



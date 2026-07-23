/**
 * prompt-seed-telemetry.ts (v4.170.5)
 *
 * Structured logs and metrics around default-prompt seeding and editor
 * prefill. Every seeder decision (legacy body upgrade, INSERT OR IGNORE
 * outcome, direct upsert fallback, IsDefault promotion) and every editor
 * prefill branch (db-hit, self-heal reseed, direct-insert self-heal,
 * static seed prefill fallback) emits a single event through
 * `emitPromptSeedEvent` so operators can trace the exact code path a
 * user's chip click took.
 *
 * Emission surfaces (all best-effort, never throws to callers):
 *   1. `log('[PromptSeed:<event>] ...', level)` — visible in the standard
 *      MacroLoop activity log stream.
 *   2. `localStorage[StorageKey.PromptSeedTrace]` — bounded ring buffer
 *      of the last {@link PROMPT_SEED_TRACE_MAX} events for post-mortem.
 *   3. `window.dispatchEvent(new CustomEvent('marco:prompt-seed-trace'))`
 *      so tests / dev tools can subscribe without patching the module.
 *
 * We do NOT reach for RiseupAsiaMacroExt.Logger here: this module runs
 * in every world (main-world editor, worker-adjacent seeder) and must
 * remain SDK-agnostic. The existing `log()` helper is safe in both.
 */

import { log } from '../logger';
import { logError } from '../error-utils';
import { StorageKey } from '../types/storage-keys';
import type { PromptRole } from '../types/prompt-role';

export const PROMPT_SEED_TRACE_MAX = 50;

export type PromptSeedEventName =
  | 'seed.start'
  | 'seed.insert-or-ignore'
  | 'seed.legacy-upgrade'
  | 'seed.legacy-upgrade-skip'
  | 'seed.promote-default'
  | 'seed.promote-default-kept'
  | 'seed.complete'
  | 'seed.failed'
  | 'seed.audit-skip'
  | 'seed.audit-write'
  | 'editor.prefill.db-hit'
  | 'editor.prefill.reseed'
  | 'editor.prefill.direct-insert'
  | 'editor.prefill.direct-insert-failed'
  | 'editor.prefill.static-fallback'
  | 'editor.prefill.missing'
  | 'editor.prefill.drift'
  | 'reseed.start'
  | 'reseed.force'
  | 'reseed.complete'
  | 'health.default.ok'
  | 'health.default.missing'
  | 'health.default.schema-drift'
  | 'health.auto-repair.start'
  | 'health.auto-repair.recovered'
  | 'health.auto-repair.failed';

export type PromptSeedOutcome = 'ok' | 'skipped' | 'failed';

export interface PromptSeedEvent {
  /** ISO timestamp, always in UTC (see mem://localization/timezone). */
  at: string;
  event: PromptSeedEventName;
  role?: PromptRole;
  slug?: string;
  outcome: PromptSeedOutcome;
  /** Optional numeric metrics: rows inserted, ms elapsed, byte count, etc. */
  metrics?: Record<string, number>;
  /** Free-form context (error message, source path, legacy-body index). */
  detail?: string;
}

interface EmitInput {
  event: PromptSeedEventName;
  role?: PromptRole;
  slug?: string;
  outcome?: PromptSeedOutcome;
  metrics?: Record<string, number>;
  detail?: string;
}

function levelFor(outcome: PromptSeedOutcome): 'success' | 'warning' | 'error' | 'info' {
  if (outcome === 'failed') return 'error';
  if (outcome === 'skipped') return 'warning';
  return 'success';
}

function formatLine(evt: PromptSeedEvent): string {
  const parts: string[] = [];
  if (evt.role) parts.push('role=' + evt.role);
  if (evt.slug) parts.push('slug=' + evt.slug);
  parts.push('outcome=' + evt.outcome);
  if (evt.metrics) {
    for (const [k, v] of Object.entries(evt.metrics)) parts.push(k + '=' + String(v));
  }
  if (evt.detail) parts.push('detail=' + evt.detail);
  return '[PromptSeed:' + evt.event + '] ' + parts.join(' ');
}

function appendToTraceBuffer(evt: PromptSeedEvent): void {
  try {
    const raw = localStorage.getItem(StorageKey.PromptSeedTrace);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const buf: PromptSeedEvent[] = Array.isArray(parsed) ? (parsed as PromptSeedEvent[]) : [];
    buf.push(evt);
    while (buf.length > PROMPT_SEED_TRACE_MAX) buf.shift();
    localStorage.setItem(StorageKey.PromptSeedTrace, JSON.stringify(buf));
  } catch (err) {
    logError('PromptSeedTelemetry', 'appendToTraceBuffer failed', err);
  }
}

function dispatchWindowEvent(evt: PromptSeedEvent): void {
  try {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent('marco:prompt-seed-trace', { detail: evt }));
  } catch (err) {
    logError('PromptSeedTelemetry', 'dispatchWindowEvent failed', err);
  }
}

/**
 * Emit a structured prompt-seed / editor-prefill event. Never throws.
 */
export function emitPromptSeedEvent(input: EmitInput): PromptSeedEvent {
  const evt: PromptSeedEvent = {
    at: new Date().toISOString(),
    event: input.event,
    outcome: input.outcome ?? 'ok',
  };
  if (input.role !== undefined) evt.role = input.role;
  if (input.slug !== undefined) evt.slug = input.slug;
  if (input.metrics !== undefined) evt.metrics = input.metrics;
  if (input.detail !== undefined) evt.detail = input.detail;
  try {
    log(formatLine(evt), levelFor(evt.outcome));
  } catch (err) {
    logError('PromptSeedTelemetry', 'log() emit failed', err);
  }
  appendToTraceBuffer(evt);
  dispatchWindowEvent(evt);
  return evt;
}

/** Read the trace ring buffer for tests / debugging surfaces. */
export function readPromptSeedTrace(): PromptSeedEvent[] {
  try {
    const raw = localStorage.getItem(StorageKey.PromptSeedTrace);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PromptSeedEvent[]) : [];
  } catch (err) {
    logError('PromptSeedTelemetry', 'readPromptSeedTrace failed', err);
    return [];
  }
}

/** Clear the trace buffer (test helper). */
export function clearPromptSeedTrace(): void {
  try {
    localStorage.removeItem(StorageKey.PromptSeedTrace);
  } catch (err) {
    logError('PromptSeedTelemetry', 'clearPromptSeedTrace failed', err);
  }
}

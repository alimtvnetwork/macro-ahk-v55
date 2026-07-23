/**
 * MacroLoop Controller — JSON tab log line leaf.
 *
 * Plan-17 step 16: extracted from `database-json-tab.ts` to break the
 * `database-json-tab ↔ database-json-migrate` runtime cycle (madge #10).
 *
 * Pure DOM helper, zero imports.
 */

export type JsonLogLevel = 'ok' | 'err' | 'info' | 'warn';

/** Append a styled log line to the log container. */
export function appendLog(logEl: HTMLElement, level: JsonLogLevel, text: string): void {
  const line = document.createElement('div');
  line.className = 'marco-json-log-' + level;
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

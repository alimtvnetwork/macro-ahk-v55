/**
 * Plan-10 — shared parse-boundary primitives.
 *
 * Consolidates the ad-hoc `readStr` / `readNum` helpers that were
 * duplicated across `wire-workspace.ts` and
 * `pro-zero/pro-zero-workspace-adapter.ts`. These are the ONLY
 * sanctioned entry points for narrowing a `Record<string, unknown>`
 * JSON blob into typed primitives at the wire boundary
 * (`.lovable/coding-guidelines.md` rule #5).
 *
 * Kept intentionally tiny + dependency-free so any parser can import
 * without pulling logging or other side-effectful modules.
 */

/** Read a string field; returns '' when absent or non-string. */
export function readStr(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

/** Read a finite number field; returns 0 when absent, non-number, or NaN/Infinity. */
export function readNum(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

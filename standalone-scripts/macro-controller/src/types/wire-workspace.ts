/**
 * Plan-10 — wide `WireWorkspace` type + parse-boundary guard.
 *
 * The `/user/workspaces` response is a loose JSON blob. Every downstream
 * consumer that peeks into `WorkspaceCredit.rawApi` (see
 * `types/credit-types.ts` line 52) currently re-implements its own
 * `readStr` / `readNum` pattern (see `pro-zero-workspace-adapter.ts`
 * lines 14-24). This module gives Plan-10 a single wide but typed
 * surface for the wire shape and one guard that narrows a
 * `Record<string, unknown>` at the parse boundary — the only place
 * `unknown` is allowed per `.lovable/coding-guidelines.md` rule #5.
 *
 * Fields kept intentionally minimal — only what Plan-10's enrichment
 * mapper and freshness gates consume. Extend as new mappers land.
 */

import { readStr } from './safe-json';

/** Wide row shape returned by `/user/workspaces` before any narrowing. */
export interface WireWorkspace {
  readonly id: string;
  readonly name: string;
  readonly plan: string;
  readonly tier: string;
}

function hasStringId(source: Record<string, unknown>): boolean {
  return typeof source.id === 'string' && source.id.length > 0;
}

/** Type guard: is this raw object a shape-valid wire workspace row? */
export function isWireWorkspace(candidate: unknown): candidate is WireWorkspace {
  if (candidate === null || typeof candidate !== 'object') return false;
  const source = candidate as Record<string, unknown>;
  return hasStringId(source);
}

/** Narrow a raw parsed row into a `WireWorkspace`. Callers must have already run `isWireWorkspace`. */
export function toWireWorkspace(source: Record<string, unknown>): WireWorkspace {
  return {
    id: readStr(source, 'id'),
    name: readStr(source, 'name'),
    plan: readStr(source, 'plan'),
    tier: readStr(source, 'tier'),
  };
}

/**
 * Unwrap the nested-vs-flat `/user/workspaces` row shape into the inner
 * workspace record. Some endpoints wrap the workspace under a `.workspace`
 * key (list endpoint) while others return the fields flat (item endpoint).
 * Single sanctioned entry point for that shape variance so downstream
 * parsers, mappers, and tests share one behaviour.
 */
export function resolveWireSection(rawRow: Record<string, unknown>): Record<string, unknown> {
  const nested = rawRow.workspace;
  if (nested !== null && typeof nested === 'object') {
    return nested as Record<string, unknown>;
  }
  return rawRow;
}

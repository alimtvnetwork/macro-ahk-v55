/**
 * Plan-10 wide-surface for `WorkspaceCredit.rawApi`.
 *
 * `WorkspaceCredit.rawApi` is the verbatim `/user/workspaces` row and
 * currently typed as `unknown`, forcing every reader to cast or truthy-
 * check `ws.rawApi` before use. This module gives it a single wide but
 * typed surface plus one narrowing helper. Consumers should call
 * `toWireWorkspaceRaw(ws.rawApi)` instead of poking at `unknown` or
 * relying on `JSON.stringify` accepting anything.
 *
 * Fields kept intentionally minimal — extend as new consumers land.
 *
 * Spec: mem://features/macro-controller/pro-zero-credit-balance
 *       spec/22-app-issues/110-macro-controller-pro-zero-credit-balance.md
 */

/** Wide row shape of a persisted `WorkspaceCredit.rawApi` blob. */
export interface WireWorkspaceRaw {
  readonly id?: string;
  readonly plan?: string;
  readonly tier?: string;
  readonly grant_type_balances?: ReadonlyArray<unknown>;
  readonly experimental_features?: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
}

/** True when `candidate` is a non-null object safe to treat as a wire row. */
export function isWireWorkspaceRaw(candidate: unknown): candidate is WireWorkspaceRaw {
  return candidate !== null && typeof candidate === 'object';
}

/**
 * Narrow `WorkspaceCredit.rawApi` (declared `unknown`) into a
 * `WireWorkspaceRaw`. Returns `null` when the value is missing or not
 * an object; callers MUST log and stop, never coerce.
 */
export function toWireWorkspaceRaw(raw: unknown): WireWorkspaceRaw | null {
  if (!isWireWorkspaceRaw(raw)) { return null; }
  return raw;
}

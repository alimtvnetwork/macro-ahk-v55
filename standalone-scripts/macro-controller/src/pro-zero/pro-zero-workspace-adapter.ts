/**
 * pro-zero-workspace-adapter — convert WorkspaceCredit.rawApi → WorkspaceInfoTyped.
 *
 * Spec: spec/22-app-issues/110-macro-controller-pro-zero-credit-balance.md §6.2, §11.4
 *
 * Centralises the ONE place where the loose `Record<string, unknown>` shape
 * from /user/workspaces is narrowed to the strict `WorkspaceInfoTyped` the
 * pro_0 branch consumes. No raw `"pro_0"` literal — that lives in the mapper.
 */

import { readStr } from '../types/safe-json';
import { toWireWorkspaceCredits } from '../types/wire-workspace-credits';
import { toWireWorkspaceRaw, type WireWorkspaceRaw } from '../types/wire-workspace-raw';
import type { WorkspaceInfoTyped } from './workspace-info-typed';
import type { WorkspaceMembership } from './workspace-membership';

function readMembership(src: Record<string, unknown>): WorkspaceMembership {
    const membershipRaw = (src.membership || {}) as Record<string, unknown>;
    const limit = membershipRaw.monthly_credit_limit;

    return {
        workspace_id: readStr(membershipRaw, 'workspace_id'),
        user_id: readStr(membershipRaw, 'user_id'),
        role: readStr(membershipRaw, 'role'),
        email: readStr(membershipRaw, 'email'),
        monthly_credit_limit: typeof limit === 'number' ? limit : null,
        invited_at: readStr(membershipRaw, 'invited_at'),
        joined_at: readStr(membershipRaw, 'joined_at'),
    };
}

/**
 * Plan-10 follow-up: `pickWorkspaceSection` now consumes the Plan-10 wide
 * `WireWorkspaceRaw` surface. Both the top-level row and its nested
 * `.workspace` object are narrowed through `toWireWorkspaceRaw` so the
 * adapter never touches `ws.rawApi` via a raw `Record<string, unknown>`
 * cast. Returns the parent row when the nested section is missing.
 */
function pickWorkspaceSection(rawApi: WireWorkspaceRaw): WireWorkspaceRaw {
    const inner = toWireWorkspaceRaw(rawApi.workspace);
    if (inner) return inner;

    return rawApi;
}

export function adaptWorkspaceInfoTyped(rawApi: unknown): WorkspaceInfoTyped {
    const wire = toWireWorkspaceRaw(rawApi) ?? ({} as WireWorkspaceRaw);
    const ws = pickWorkspaceSection(wire);
    // Plan-10 follow-up: numeric + billing-date fields flow through the
    // sibling `WireWorkspaceCredits` guard so the pro-zero adapter no
    // longer duplicates `readNum` invocations.
    const credits = toWireWorkspaceCredits(ws as Record<string, unknown>);

    return {
        id: readStr(ws as Record<string, unknown>, 'id'),
        name: readStr(ws as Record<string, unknown>, 'name'),
        plan: readStr(ws as Record<string, unknown>, 'plan') || readStr(wire as Record<string, unknown>, 'plan'),
        plan_type: readStr(ws as Record<string, unknown>, 'plan_type'),
        credits_used: credits.credits_used,
        credits_granted: credits.credits_granted,
        total_credits_used: credits.total_credits_used,
        billing_period_credits_used: credits.billing_period_credits_used,
        billing_period_credits_limit: credits.billing_period_credits_limit,
        billing_period_start_date: credits.billing_period_start_date,

        billing_period_end_date: credits.billing_period_end_date,
        membership: readMembership(wire as Record<string, unknown>),
    };
}


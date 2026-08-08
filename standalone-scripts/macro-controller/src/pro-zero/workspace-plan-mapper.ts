/**
 * workspace-plan-mapper — sole owner of the raw `"pro_0"` wire string.
 *
 * Spec: spec/22-app-issues/110-macro-controller-pro-zero-credit-balance.md §4.1, §11.8
 *
 * Acceptance #3: raw `"pro_0"` MUST appear ONLY here. All other modules
 * import `WorkspacePlanType` and compare against the Enum value.
 */

import { WorkspacePlanType } from './workspace-plan';
import { WIRE_PLAN_PRO_ZERO } from './pro-zero-constants';

const PRO_ZERO_WIRE_TOKENS: ReadonlyArray<string> = [WIRE_PLAN_PRO_ZERO];

function normalize(rawPlan: string): string {
    return (rawPlan || '').toLowerCase().trim();
}

function hasProZeroToken(normalized: string): boolean {
    return PRO_ZERO_WIRE_TOKENS.indexOf(normalized) >= 0;
}

/** Map a wire-string `plan` value to the `WorkspacePlanType` Enum. */
export function mapWorkspacePlan(rawPlan: string): WorkspacePlanType {
    const normalized = normalize(rawPlan);
    if (hasProZeroToken(normalized)) return WorkspacePlanType.PRO_ZERO;

    return WorkspacePlanType.OTHER;
}

/** True when the resolved `WorkspacePlanType` is the only branch that needs /credit-balance. */
export function isProZeroPlan(plan: WorkspacePlanType): boolean {
    return plan === WorkspacePlanType.PRO_ZERO;
}

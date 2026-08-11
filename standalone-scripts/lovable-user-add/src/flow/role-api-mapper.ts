/**
 * User Add — UserAddMembershipRoleCodeType → MembershipRoleApiCodeType mapper.
 *
 * Project-internal enum (PascalCase) → wire enum (lowercase). Owner is
 * mapped to Member at this layer because Step A creates the membership
 * at non-Owner level first; Step B (P16) issues the PUT to promote.
 * This guarantees only one PUT site exists across the codebase (R12).
 *
 * Caller is the Step A orchestrator; the per-row state machine (P17)
 * decides whether to invoke Step B based on `RowRoleCode === Owner`.
 */

import { UserAddMembershipRoleCodeType } from "../migrations/membership-role-seed";
import { MembershipRoleApiCodeType } from "../../../lovable-common/src/api/membership-role-api-code";

export const toStepAApiRole = (role: UserAddMembershipRoleCodeType): MembershipRoleApiCodeType => {
  if (role === UserAddMembershipRoleCodeType.Admin) {
    return MembershipRoleApiCodeType.Admin;
  }

  return MembershipRoleApiCodeType.Member;
};

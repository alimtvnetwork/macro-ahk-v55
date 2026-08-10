/**
 * User Add popup — default-role select options.
 *
 * Single source of truth for the popup `<select>`. Editor IS offered
 * here as a UX convenience, but the value is normalized to Member at
 * task-creation time (same Q3 rule as the CSV parser). Owner is the
 * first option so users see the "promote" path is supported.
 */

import { UserAddMembershipRoleCodeType } from "../migrations/membership-role-seed";

export interface RoleOption {
    Value: string;
    LabelType: string;
}

export const DEFAULT_ROLE_OPTIONS: ReadonlyArray<RoleOption> = Object.freeze([
    { Value: UserAddMembershipRoleCodeType.Owner, LabelType: "Owner (triggers Step B promotion)" },
    { Value: UserAddMembershipRoleCodeType.Admin, LabelType: "Admin" },
    { Value: UserAddMembershipRoleCodeType.Member, LabelType: "Member" },
    { Value: "Editor", LabelType: "Editor (normalized to Member)" },
]);

export const DEFAULT_ROLE_VALUE: string = UserAddMembershipRoleCodeType.Member;

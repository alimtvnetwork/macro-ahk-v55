/**
 * User Add — Role normalizer (Q3).
 *
 * Maps free-text CSV `Role` cell to `UserAddMembershipRoleCodeType`:
 *   - case-insensitive match against canonical Owner/Admin/Member
 *   - `Editor` (any case) → `Member` + `WasEditorNormalized: true`
 *   - null → null (caller applies task default at creation time)
 *   - unknown → null + typed error returned
 *
 * Pure function. NO logging here — `WasEditorNormalized` flag is the
 * signal; P19 logs viewer surfaces these as info-level entries.
 */

import { UserAddMembershipRoleCodeType } from "../migrations/membership-role-seed";

export interface RoleNormalizeResult {
    RoleCode: UserAddMembershipRoleCodeType | null;
    WasEditorNormalized: boolean;
    Error: string | null;
}

const KNOWN_ROLES: ReadonlyMap<string, UserAddMembershipRoleCodeType> = new Map([
    ["owner", UserAddMembershipRoleCodeType.Owner],
    ["admin", UserAddMembershipRoleCodeType.Admin],
    ["member", UserAddMembershipRoleCodeType.Member],
]);

const EDITOR_KEY = "editor";

export const normalizeRole = (raw: string | null): RoleNormalizeResult => {
    if (raw === null) {
        return { RoleCode: null, WasEditorNormalized: false, Error: null };
    }

    const key = raw.trim().toLowerCase();

    if (key === EDITOR_KEY) {
        return {
            RoleCode: UserAddMembershipRoleCodeType.Member,
            WasEditorNormalized: true, Error: null,
        };
    }

    const matched = KNOWN_ROLES.get(key);

    if (matched === undefined) {
        return {
            RoleCode: null, WasEditorNormalized: false,
            Error: `Unknown role: ${raw} (expected Owner/Admin/Member/Editor)`,
        };
    }

    return { RoleCode: matched, WasEditorNormalized: false, Error: null };
};

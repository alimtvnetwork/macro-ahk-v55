/**
 * User Add — CSV column contract.
 *
 * Closed enum so parser + validator + UI all reference the same names.
 * `Role` is optional — when omitted, the popup's default-role select
 * value (P14) is applied at task-creation time, NOT here. This file
 * stays purely about column shape.
 */

export enum UserAddCsvColumnType {
    WorkspaceUrl = "WorkspaceUrl",
    MemberEmail = "MemberEmail",
    Role = "Role",
    Notes = "Notes",
}

export const REQUIRED_COLUMNS: ReadonlyArray<UserAddCsvColumnType> = Object.freeze([
  UserAddCsvColumnType.WorkspaceUrl,
  UserAddCsvColumnType.MemberEmail,
]);

export const OPTIONAL_COLUMNS: ReadonlyArray<UserAddCsvColumnType> = Object.freeze([
  UserAddCsvColumnType.Role,
  UserAddCsvColumnType.Notes,
]);

export const ALL_COLUMNS: ReadonlyArray<UserAddCsvColumnType> =
    Object.freeze([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]);

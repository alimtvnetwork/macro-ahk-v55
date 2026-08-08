/**
 * Owner Switch — CSV column contract.
 *
 * Closed enum so parser + validator + UI all reference the same names.
 * Q4 default: cap at 2 OwnerEmail columns (OwnerEmail1 required,
 * OwnerEmail2 optional). Extra columns are ignored with a warning.
 */

export enum OwnerSwitchCsvColumnType {
    LoginEmail = "LoginEmail",
    Password = "Password",
    OwnerEmail1 = "OwnerEmail1",
    OwnerEmail2 = "OwnerEmail2",
    Notes = "Notes",
}

export const REQUIRED_COLUMNS: ReadonlyArray<OwnerSwitchCsvColumnType> = Object.freeze([
    OwnerSwitchCsvColumnType.LoginEmail,
    OwnerSwitchCsvColumnType.OwnerEmail1,
]);

export const OPTIONAL_COLUMNS: ReadonlyArray<OwnerSwitchCsvColumnType> = Object.freeze([
    OwnerSwitchCsvColumnType.Password,
    OwnerSwitchCsvColumnType.OwnerEmail2,
    OwnerSwitchCsvColumnType.Notes,
]);

export const ALL_COLUMNS: ReadonlyArray<OwnerSwitchCsvColumnType> =
    Object.freeze([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]);

/**
 * Lovable Owner Switch — public barrel.
 *
 * P4: entry class + instruction manifest.
 * P5: migration v1 (DDL + TaskStatus + XPathSetting seeds).
 * P6: CSV parser + validator (`parseOwnerSwitchCsv`).
 * P7: popup UI shell (`mountPopup`).
 * P8: login automation (`runLogin`).
 * P9: promote step (`runPromote`, uses shared `promoteToOwner` — R12).
 * Future: sign-out + state machine (P10).
 */

export { LovableOwnerSwitch } from "./lovable-owner-switch";
export { default as instruction } from "./instruction";
export { OWNER_SWITCH_MIGRATION_V1 } from "./migrations";
export { OwnerSwitchTaskStatusCodeType } from "./migrations/task-status-seed";
export { parseOwnerSwitchCsv, OwnerSwitchCsvColumnType } from "./csv";
export type { OwnerSwitchCsvRow, OwnerSwitchCsvParseResult } from "./csv";
export { mountPopup } from "./ui";
export { runLogin, LoginStepCodeType, runPromote, PromoteStepCodeType, TtlCache } from "./flow";
export type {
    LoginFlowOptions,
    LoginRunResult,
    PromoteRowRequest,
    PromoteRowResult,
    PromoteCaches,
} from "./flow";

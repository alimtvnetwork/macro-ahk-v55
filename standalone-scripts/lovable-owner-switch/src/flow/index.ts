/**
 * Lovable Owner Switch — flow barrel.
 *
 * P8: `runLogin`. P9: `runPromote` + `TtlCache`. P10: `runRow` +
 * `runSignOut` + per-row state machine + log sink + storage seam.
 */

export { runLogin } from "./run-login";
export { LoginStepCodeType } from "./login-types";
export type { LoginCredentials, LoginFlowOptions, LoginStepOutcome } from "./login-types";
export type { LoginRunResult } from "./run-login";
export { runPromote } from "./run-promote";
export type { PromoteCaches } from "./run-promote";
export { PromoteStepCodeType } from "./promote-types";
export type { PromoteRowRequest, PromoteRowOutcome, PromoteRowResult } from "./promote-types";
export { TtlCache } from "./ttl-cache";
export { runSignOut, SignOutStepCodeType } from "./run-sign-out";
export type { SignOutResult } from "./run-sign-out";
export { runRow } from "./run-row";
export { RowOutcomeCodeType } from "./row-types";
export type { PromotedOwnerRecord, RowExecutionContext, RowExecutionResult, TaskExecutionParams } from "./row-types";
export { LogPhaseType, LogSeverityType, buildEntry } from "./log-sink";
export type { LogEntry, LogSink } from "./log-sink";
export type { RowStateStore, RowStateUpdate } from "./row-state-store";
export { toLogViewerEntries } from "./log-viewer-adapter";
export { buildOwnerSwitchRunSummary } from "./run-summary-builder";
export type { OwnerSwitchSummaryInput } from "./run-summary-builder";

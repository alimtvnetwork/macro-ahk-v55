/**
 * Owner Switch — promote step types.
 *
 * Closed enums + typed inputs/outputs so the per-row driver (P10) and
 * the shared logger never deal in magic strings.
 */

export enum PromoteStepCodeType {
    ResolveWorkspace = "ResolveWorkspace",
    ResolveUserId = "ResolveUserId",
    PromoteToOwner = "PromoteToOwner",
}

export interface PromoteRowRequest {
    LoginEmail: string;
    OwnerEmail: string;
}

export interface PromoteRowOutcome {
    Step: PromoteStepCodeType;
    DurationMs: number;
    WorkspaceId: string | null;
    UserId: string | null;
}

export interface PromoteRowResult {
    Outcomes: ReadonlyArray<PromoteRowOutcome>;
    FailedStep: PromoteStepCodeType | null;
    Error: string | null;
}

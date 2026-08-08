import { HealthState, WorldEnum } from "../types/enums";
import { MatchRuleType, InjectionMethodType, ScriptRunAtType } from "../../standalone-scripts/macro-controller/src/types/enums";

/** URL matching modes for project rules. */
export type MatchMode = MatchRuleType;

/** Script execution world. */
export type ExecutionWorld = WorldEnum;

/** Config injection methods (Method 3 deprecated). */
export type InjectionMethod = InjectionMethodType;

/** Script run-at timing. */
export type RunAt = ScriptRunAtType;

/** Injection conditions for a URL rule. */
export interface InjectionConditions {
    requireElement: string | null;
    requireCookie: string | null;
    minDelayMs: number;
    requireOnline: boolean;
}

/** Result of URL matching for a single rule. */
export interface MatchResult {
    projectId: string;
    projectName: string;
    ruleId: string;
    ruleName: string;
    priority: number;
    scriptBindings: ScriptBindingResolved[];
    conditions: InjectionConditions;
}

/** A resolved script binding ready for injection. */
export interface ScriptBindingResolved {
    scriptId: string;
    configId: string | null;
    order: number;
    world: ExecutionWorld;
    runAt: RunAt;
}

/** Regex validation result. */
export interface RegexValidation {
    isValid: boolean;
    errorMessage?: string;
    warningMessage?: string;
}

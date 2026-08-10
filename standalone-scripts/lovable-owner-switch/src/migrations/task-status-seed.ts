/**
 * Owner Switch — TaskStatus enum (seeded into `TaskStatus` table).
 *
 * Closed set; values double as both DB primary key code and UI label key.
 * No magic strings elsewhere — code paths must reference this enum.
 */

export enum OwnerSwitchTaskStatusCodeType {
    Pending = "Pending",
    Running = "Running",
    Completed = "Completed",
    Failed = "Failed",
    Cancelled = "Cancelled",
}

export interface TaskStatusSeed {
    Code: OwnerSwitchTaskStatusCodeType;
    DisplayLabel: string;
    SortOrder: number;
}

export const TASK_STATUS_SEEDS: ReadonlyArray<TaskStatusSeed> = Object.freeze([
    { Code: OwnerSwitchTaskStatusCodeType.Pending, DisplayLabel: "Pending", SortOrder: 1 },
    { Code: OwnerSwitchTaskStatusCodeType.Running, DisplayLabel: "Running", SortOrder: 2 },
    { Code: OwnerSwitchTaskStatusCodeType.Completed, DisplayLabel: "Completed", SortOrder: 3 },
    { Code: OwnerSwitchTaskStatusCodeType.Failed, DisplayLabel: "Failed", SortOrder: 4 },
    { Code: OwnerSwitchTaskStatusCodeType.Cancelled, DisplayLabel: "Cancelled", SortOrder: 5 },
]);

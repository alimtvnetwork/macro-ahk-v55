/**
 * User Add — TaskStatus seed (Pending/Running/Completed/Failed/Cancelled).
 *
 * Same closed set as Owner Switch but kept in this project to preserve
 * project-level isolation (no cross-project DB joins). Seeded into the
 * project-scoped `TaskStatus` table.
 */

export enum UserAddTaskStatusCodeType {
    Pending = "Pending",
    Running = "Running",
    Completed = "Completed",
    Failed = "Failed",
    Cancelled = "Cancelled",
}

export interface TaskStatusSeed {
    Code: UserAddTaskStatusCodeType;
    DisplayLabel: string;
    SortOrder: number;
}

export const TASK_STATUS_SEEDS: ReadonlyArray<TaskStatusSeed> = Object.freeze([
  { Code: UserAddTaskStatusCodeType.Pending, DisplayLabel: "Pending", SortOrder: 1 },
  { Code: UserAddTaskStatusCodeType.Running, DisplayLabel: "Running", SortOrder: 2 },
  { Code: UserAddTaskStatusCodeType.Completed, DisplayLabel: "Completed", SortOrder: 3 },
  { Code: UserAddTaskStatusCodeType.Failed, DisplayLabel: "Failed", SortOrder: 4 },
  { Code: UserAddTaskStatusCodeType.Cancelled, DisplayLabel: "Cancelled", SortOrder: 5 },
]);

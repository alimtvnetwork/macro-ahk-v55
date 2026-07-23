/**
 * Shared type surface for `useStepLibrary` and its helper hooks.
 *
 * Extracted so `src/hooks/step-library/step-library-hooks.ts` can
 * import the public API shape without a circular import back into
 * `use-step-library.ts` (which owns the runtime hook).
 */

import type { SqlJsStatic } from "sql.js";
import type { StepLibraryDb, ProjectRow, StepGroupRow, StepRow } from "@/background/recorder/step-library/db";
import type { GroupInputBag, GroupInputsMap } from "@/background/recorder/step-library/group-inputs";
import type { StepKindId } from "@/background/recorder/step-library/schema";

export type StepLibraryLoadError =
    | { Kind: "SqlJsLoad"; Message: string; Hint: string; Recoverable: true }
    | { Kind: "StorageRead"; Message: string; Hint: string; Recoverable: true }
    | { Kind: "StorageWrite"; Message: string; Hint: string; Recoverable: true }
    | { Kind: "Unknown"; Message: string; Hint: string; Recoverable: true };

export interface UseStepLibraryState {
    readonly Loading: boolean;
    readonly Error: string | null;
    readonly LoadError: StepLibraryLoadError | null;
    readonly SqlJs: SqlJsStatic | null;
    readonly Lib: StepLibraryDb | null;
    readonly Project: ProjectRow | null;
    readonly Groups: ReadonlyArray<StepGroupRow>;
    readonly StepsByGroup: ReadonlyMap<number, ReadonlyArray<StepRow>>;
    readonly GroupInputs: GroupInputsMap;
}

export interface UseStepLibraryApi extends UseStepLibraryState {
    readonly refresh: () => void;
    readonly createGroup: (input: { Name: string; ParentStepGroupId: number | null; Description?: string | null }) => number;
    readonly renameGroup: (stepGroupId: number, newName: string) => void;
    readonly deleteGroup: (stepGroupId: number) => void;
    readonly moveGroupWithinParent: (stepGroupId: number, direction: "up" | "down") => void;
    readonly reorderSiblings: (parentStepGroupId: number | null, orderedIds: readonly number[]) => void;
    readonly setGroupArchived: (stepGroupId: number, archived: boolean) => void;
    readonly setStepDisabled: (stepId: number, disabled: boolean) => void;
    readonly appendStep: (input: {
        StepGroupId: number;
        StepKindId: StepKindId;
        Label?: string | null;
        PayloadJson?: string | null;
        TargetStepGroupId?: number | null;
    }) => number;
    readonly updateStep: (input: {
        StepId: number;
        StepKindId: StepKindId;
        Label?: string | null;
        PayloadJson?: string | null;
        TargetStepGroupId?: number | null;
    }) => void;
    readonly deleteStep: (stepId: number) => void;
    readonly moveStepWithinGroup: (stepId: number, direction: "up" | "down") => void;
    readonly reorderSteps: (stepGroupId: number, orderedStepIds: readonly number[]) => void;
    readonly setGroupInput: (stepGroupId: number, bag: GroupInputBag) => void;
    readonly clearGroupInput: (stepGroupId: number) => void;
    readonly resetAll: () => void;
    readonly retryLoad: () => void;
}

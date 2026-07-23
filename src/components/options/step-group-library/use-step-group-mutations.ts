/**
 * Marco Extension, Step Group Library, Mutations Hook
 *
 * Owns the imperative CRUD + drag-reorder handlers of
 * `StepGroupLibraryPanel`. Handler bodies live in
 * `./mutation-handlers.ts`; this hook wires deps and returns the
 * bound handlers. No behaviour change vs pre-decomposition.
 *
 * @see StepGroupLibraryPanel.tsx
 * @see ./mutation-handlers.ts
 */

import type { Dispatch, SetStateAction } from "react";

import type { StepGroupRow } from "@/background/recorder/step-library/db";
import { useStepGroupBatchActions } from "@/hooks/use-step-group-batch-actions";
import type { useStepLibrary } from "@/hooks/use-step-library";
import type { BatchRenameChange } from "../BatchRenameDialog";

import type {
    CreateDialogState,
    DeleteStepDialogState,
    GroupTargetDialogState,
    RenameDialogState,
    StepEditorDialogState,
} from "./dialog-state";
import {
    doArchiveToggle,
    doBatchDeleteConfirm,
    doBatchRenameApply,
    doCreate,
    doDelete,
    doDropReorder,
    doMove,
    doRename,
    doStepDeleteConfirm,
    doStepDropReorder,
    doStepEditorSubmit,
    doStepMove,
    type MutationDeps,
    type StepEditorSubmitInput,
} from "./mutation-handlers";

type StepLibrary = ReturnType<typeof useStepLibrary>;

interface UseStepGroupMutationsParams {
    readonly lib: StepLibrary;
    readonly showArchived: boolean;
    readonly activeGroupId: number | null;
    readonly setActiveGroupId: (id: number | null) => void;
    readonly setSelected: Dispatch<SetStateAction<Set<number>>>;
    readonly setSelectionOrder: Dispatch<SetStateAction<ReadonlyArray<number>>>;
    readonly setExpanded: Dispatch<SetStateAction<Set<number>>>;
    readonly createDialog: CreateDialogState;
    readonly setCreateDialog: Dispatch<SetStateAction<CreateDialogState>>;
    readonly renameDialog: RenameDialogState;
    readonly setRenameDialog: Dispatch<SetStateAction<RenameDialogState>>;
    readonly deleteDialog: GroupTargetDialogState;
    readonly setDeleteDialog: Dispatch<SetStateAction<GroupTargetDialogState>>;
    readonly stepEditor: StepEditorDialogState;
    readonly setStepEditor: Dispatch<SetStateAction<StepEditorDialogState>>;
    readonly deleteStepDialog: DeleteStepDialogState;
    readonly setDeleteStepDialog: Dispatch<SetStateAction<DeleteStepDialogState>>;
    readonly setPendingGroupOrder: Dispatch<
        SetStateAction<ReadonlyMap<number | "root", ReadonlyArray<number>>>
    >;
    readonly setPendingStepOrder: Dispatch<
        SetStateAction<ReadonlyMap<number, ReadonlyArray<number>>>
    >;
}

function bindHandlers(deps: MutationDeps) {
    return {
        handleBatchRenameApply: (changes: ReadonlyArray<BatchRenameChange>) =>
            doBatchRenameApply(deps, changes),
        handleBatchDeleteConfirm: (ids: ReadonlyArray<number>) =>
            doBatchDeleteConfirm(deps, ids),
        handleCreate: () => doCreate(deps),
        handleRename: () => doRename(deps),
        handleDelete: () => doDelete(deps),
        handleMove: (id: number, direction: "up" | "down") => doMove(deps, id, direction),
        handleArchiveToggle: (group: StepGroupRow) => doArchiveToggle(deps, group),
        handleStepEditorSubmit: (input: StepEditorSubmitInput) =>
            doStepEditorSubmit(deps, input),
        handleStepMove: (stepId: number, direction: "up" | "down") =>
            doStepMove(deps, stepId, direction),
        handleStepDeleteConfirm: () => doStepDeleteConfirm(deps),
        handleDropReorder: (parentId: number | null, sourceId: number, targetId: number) =>
            doDropReorder(deps, parentId, sourceId, targetId),
        handleStepDropReorder: (stepGroupId: number, sourceStepId: number, targetStepId: number) =>
            doStepDropReorder(deps, stepGroupId, sourceStepId, targetStepId),
    };
}

export function useStepGroupMutations(params: UseStepGroupMutationsParams) {
    const batchActions = useStepGroupBatchActions(params.lib);
    return bindHandlers({ ...params, batchActions });
}

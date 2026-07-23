/**
 * Marco Extension, Step Group List Panel Mutations Hook
 *
 * Owns the create/rename/delete dialog state, live-validation memos,
 * and the batch rename/delete outcome handlers for `StepGroupListPanel`.
 *
 * Extracted so the parent panel's render function stays under the
 * ESLint `max-lines-per-function` threshold (Plan 24, SS-04b Phase 5).
 * All behaviour is preserved verbatim.
 */

import type { StepGroupRow } from "@/background/recorder/step-library/db";
import type { UseStepLibraryApi } from "@/hooks/use-step-library";
import { useStepGroupBatchActions } from "@/hooks/use-step-group-batch-actions";
import type { BatchRenameChange } from "../BatchRenameDialog";
import { applyBatchRenameWithToast, runBatchDelete } from "./batch-handlers";
import {
    makeSubmitCreate,
    makeSubmitDelete,
    makeSubmitRename,
    useDialogStates,
    useValidationErrors,
} from "./list-panel-mutation-helpers";

export interface CreateDialogState { readonly open: boolean; readonly name: string; }
export interface RenameDialogState { readonly open: boolean; readonly group: StepGroupRow | null; readonly name: string; }
export interface DeleteDialogState { readonly open: boolean; readonly group: StepGroupRow | null; }

export interface UseListPanelMutationsInput {
    readonly lib: UseStepLibraryApi;
    readonly activeGroupId: number | null;
    readonly setActiveGroupId: (id: number | null) => void;
    readonly setSelected: React.Dispatch<React.SetStateAction<ReadonlySet<number>>>;
}

export interface UseListPanelMutationsApi {
    readonly createDialog: CreateDialogState;
    readonly setCreateDialog: React.Dispatch<React.SetStateAction<{ open: boolean; name: string }>>;
    readonly renameDialog: RenameDialogState;
    readonly setRenameDialog: React.Dispatch<React.SetStateAction<{ open: boolean; group: StepGroupRow | null; name: string }>>;
    readonly deleteDialog: DeleteDialogState;
    readonly setDeleteDialog: React.Dispatch<React.SetStateAction<{ open: boolean; group: StepGroupRow | null }>>;
    readonly createError: string | null;
    readonly renameError: string | null;
    readonly openCreate: () => void;
    readonly openRename: (g: StepGroupRow) => void;
    readonly openDelete: (g: StepGroupRow) => void;
    readonly submitCreate: () => void;
    readonly submitRename: () => void;
    readonly submitDelete: () => void;
    readonly handleBatchRenameApply: (changes: ReadonlyArray<BatchRenameChange>) => void;
    readonly handleBatchDeleteConfirm: (ids: ReadonlyArray<number>) => void;
}

export function useListPanelMutations(input: UseListPanelMutationsInput): UseListPanelMutationsApi {
    const { lib, activeGroupId, setActiveGroupId, setSelected } = input;
    const dialogs = useDialogStates();
    const { createDialog, setCreateDialog, renameDialog, setRenameDialog, deleteDialog, setDeleteDialog } = dialogs;
    const { createError, renameError } = useValidationErrors(lib, createDialog.name, renameDialog.group, renameDialog.name);
    const deps = { lib, activeGroupId, setActiveGroupId };
    const submitCreate = makeSubmitCreate(deps, createDialog, createError, setCreateDialog);
    const submitRename = makeSubmitRename(deps, renameDialog, renameError, setRenameDialog);
    const submitDelete = makeSubmitDelete(deps, deleteDialog, setDeleteDialog);
    const batchActions = useStepGroupBatchActions(lib);
    return {
        createDialog, setCreateDialog, renameDialog, setRenameDialog, deleteDialog, setDeleteDialog,
        createError, renameError,
        openCreate: () => setCreateDialog({ open: true, name: "" }),
        openRename: (g) => setRenameDialog({ open: true, group: g, name: g.Name }),
        openDelete: (g) => setDeleteDialog({ open: true, group: g }),
        submitCreate, submitRename, submitDelete,
        handleBatchRenameApply: (changes) => applyBatchRenameWithToast(batchActions, changes),
        handleBatchDeleteConfirm: (ids) => runBatchDelete({ ids, lib, activeGroupId, setActiveGroupId, setSelected }),
    };
}

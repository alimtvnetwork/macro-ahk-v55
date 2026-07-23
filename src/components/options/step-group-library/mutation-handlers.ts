/**
 * Marco Extension, Step Group Library, Mutation Handler Bodies
 *
 * Module-scoped handler bodies extracted from useStepGroupMutations
 * (Plan 25 Step 21) so the hook itself stays under the
 * `max-lines-per-function` ceiling. Every function here is a verbatim
 * lift; behaviour is unchanged.
 */

import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import type { StepGroupRow, StepRow } from "@/background/recorder/step-library/db";
import type { StepKindId } from "@/background/recorder/step-library/schema";
import type { useStepGroupBatchActions } from "@/hooks/use-step-group-batch-actions";
import type { useStepLibrary } from "@/hooks/use-step-library";
import type { BatchRenameChange } from "../BatchRenameDialog";

import type {
    CreateDialogState,
    DeleteStepDialogState,
    GroupTargetDialogState,
    RenameDialogState,
    StepEditorDialogState,
} from "./dialog-state";

type StepLibrary = ReturnType<typeof useStepLibrary>;
type BatchActions = ReturnType<typeof useStepGroupBatchActions>;

export interface StepEditorSubmitInput {
    readonly StepKindId: StepKindId;
    readonly Label: string | null;
    readonly PayloadJson: string | null;
    readonly TargetStepGroupId: number | null;
}

export interface MutationDeps {
    readonly lib: StepLibrary;
    readonly batchActions: BatchActions;
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

function undoBatchRename(outcome: ReturnType<BatchActions["applyBatchRename"]>): void {
    const undone = outcome.undo();
    if (undone.Error !== null && undone.Applied === 0) {
        toast.error("Undo failed", { description: undone.Error });
        return;
    }
    toast.success(`Reverted ${undone.Applied} rename${undone.Applied === 1 ? "" : "s"}`);
}

export function doBatchRenameApply(
    deps: MutationDeps,
    changes: ReadonlyArray<BatchRenameChange>,
): void {
    const outcome = deps.batchActions.applyBatchRename(changes);
    if (outcome.Error !== null && outcome.Applied === 0) {
        toast.error("Batch rename failed", { description: outcome.Error });
        return;
    }
    const verb = outcome.Error === null ? "Renamed" : "Partially renamed";
    toast.success(`${verb} ${outcome.Applied} group${outcome.Applied === 1 ? "" : "s"}`, {
        description: outcome.Error ?? "Click Undo to revert.",
        action: { label: "Undo", onClick: () => undoBatchRename(outcome) },
        duration: 8000,
    });
}

function deleteGroupsSequentially(
    lib: StepLibrary,
    ids: ReadonlyArray<number>,
): { deleted: number; firstError: string | null } {
    let deleted = 0;
    let firstError: string | null = null;
    for (const id of ids) {
        try {
            lib.deleteGroup(id);
            deleted += 1;
        } catch (caught) {
            firstError = caught instanceof Error ? caught.message : String(caught);
            break;
        }
    }
    return { deleted, firstError };
}

export function doBatchDeleteConfirm(deps: MutationDeps, ids: ReadonlyArray<number>): void {
    const { deleted, firstError } = deleteGroupsSequentially(deps.lib, ids);
    deps.setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
    });
    deps.setSelectionOrder((prev) => prev.filter((sid) => !ids.includes(sid)));
    if (deps.activeGroupId !== null && ids.includes(deps.activeGroupId)) {
        deps.setActiveGroupId(null);
    }
    if (firstError !== null && deleted === 0) {
        toast.error("Batch delete failed", { description: firstError });
        return;
    }
    toast.success(`Deleted ${deleted} group${deleted === 1 ? "" : "s"}`, {
        description: firstError ?? "This action cannot be undone.",
    });
}

export function doCreate(deps: MutationDeps): void {
    const name = deps.createDialog.name.trim();
    if (name === "") { toast.error("Group name is required"); return; }
    try {
        const newId = deps.lib.createGroup({ Name: name, ParentStepGroupId: deps.createDialog.parent });
        deps.setCreateDialog({ open: false, parent: null, name: "" });
        deps.setActiveGroupId(newId);
        if (deps.createDialog.parent !== null) {
            deps.setExpanded((p) => new Set(p).add(deps.createDialog.parent as number));
        }
        toast.success(`Created “${name}”`);
    } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Create failed");
    }
}

export function doRename(deps: MutationDeps): void {
    if (deps.renameDialog.group === null) return;
    const name = deps.renameDialog.name.trim();
    if (name === "") { toast.error("Group name is required"); return; }
    try {
        deps.lib.renameGroup(deps.renameDialog.group.StepGroupId, name);
        toast.success(`Renamed to “${name}”`);
        deps.setRenameDialog({ open: false, group: null, name: "" });
    } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Rename failed");
    }
}

export function doDelete(deps: MutationDeps): void {
    if (deps.deleteDialog.group === null) return;
    const id = deps.deleteDialog.group.StepGroupId;
    try {
        deps.lib.deleteGroup(id);
        deps.setSelected((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        deps.setSelectionOrder((prev) => prev.filter((sid) => sid !== id));
        if (deps.activeGroupId === id) deps.setActiveGroupId(null);
        toast.success(`Deleted “${deps.deleteDialog.group.Name}”`);
        deps.setDeleteDialog({ open: false, group: null });
    } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Delete failed");
    }
}

export function doMove(deps: MutationDeps, id: number, direction: "up" | "down"): void {
    try { deps.lib.moveGroupWithinParent(id, direction); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "Move failed"); }
}

export function doArchiveToggle(deps: MutationDeps, group: StepGroupRow): void {
    const next = !group.IsArchived;
    try {
        deps.lib.setGroupArchived(group.StepGroupId, next);
        toast.success(next ? `Archived “${group.Name}”` : `Restored “${group.Name}”`);
    } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Archive failed");
    }
}

function runStepEditorCreate(
    lib: StepLibrary,
    mode: Extract<NonNullable<StepEditorDialogState["mode"]>, { Kind: "create" }>,
    input: StepEditorSubmitInput,
): void {
    lib.appendStep({
        StepGroupId: mode.StepGroupId,
        StepKindId: input.StepKindId,
        Label: input.Label,
        PayloadJson: input.PayloadJson,
        TargetStepGroupId: input.TargetStepGroupId,
    });
    toast.success("Step added");
}

function runStepEditorUpdate(
    lib: StepLibrary,
    mode: Extract<NonNullable<StepEditorDialogState["mode"]>, { Kind: "edit" }>,
    input: StepEditorSubmitInput,
): void {
    lib.updateStep({
        StepId: mode.Step.StepId,
        StepKindId: input.StepKindId,
        Label: input.Label,
        PayloadJson: input.PayloadJson,
        TargetStepGroupId: input.TargetStepGroupId,
    });
    toast.success("Step updated");
}

export function doStepEditorSubmit(deps: MutationDeps, input: StepEditorSubmitInput): void {
    const mode = deps.stepEditor.mode;
    if (mode === null) return;
    try {
        if (mode.Kind === "create") runStepEditorCreate(deps.lib, mode, input);
        else runStepEditorUpdate(deps.lib, mode, input);
        deps.setStepEditor({ open: false, mode: null });
    } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Save failed");
    }
}

export function doStepMove(deps: MutationDeps, stepId: number, direction: "up" | "down"): void {
    try { deps.lib.moveStepWithinGroup(stepId, direction); }
    catch (caught) { toast.error(caught instanceof Error ? caught.message : "Move failed"); }
}

export function doStepDeleteConfirm(deps: MutationDeps): void {
    const target = deps.deleteStepDialog.step;
    if (target === null) return;
    try {
        deps.lib.deleteStep(target.StepId);
        toast.success(`Deleted step “${target.Label ?? target.StepId}”`);
        deps.setDeleteStepDialog({ open: false, step: null });
    } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Delete failed");
    }
}

function computeSiblingOrder(
    lib: StepLibrary,
    parentId: number | null,
    showArchived: boolean,
): ReadonlyArray<number> {
    return lib.Groups
        .filter((g) => !g.IsArchived || showArchived)
        .filter((g) => (g.ParentStepGroupId ?? null) === parentId)
        .sort((a, b) => a.OrderIndex - b.OrderIndex || a.Name.localeCompare(b.Name))
        .map((g) => g.StepGroupId);
}

function reorderList(
    siblings: ReadonlyArray<number>,
    sourceId: number,
    targetId: number,
): ReadonlyArray<number> | null {
    const fromIdx = siblings.indexOf(sourceId);
    const toIdx = siblings.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return null;
    const next = siblings.slice();
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, sourceId);
    return next;
}

export function doDropReorder(
    deps: MutationDeps,
    parentId: number | null,
    sourceId: number,
    targetId: number,
): void {
    if (sourceId === targetId) return;
    const siblings = computeSiblingOrder(deps.lib, parentId, deps.showArchived);
    const next = reorderList(siblings, sourceId, targetId);
    if (next === null) return;
    const parentKey = (parentId ?? "root") as number | "root";
    deps.setPendingGroupOrder((prev) => new Map(prev).set(parentKey, next));
    try {
        deps.lib.reorderSiblings(parentId, next);
    } catch (caught) {
        deps.setPendingGroupOrder((prev) => {
            const m = new Map(prev); m.delete(parentKey); return m;
        });
        toast.error(caught instanceof Error ? caught.message : "Reorder failed");
    }
}

export function doStepDropReorder(
    deps: MutationDeps,
    stepGroupId: number,
    sourceStepId: number,
    targetStepId: number,
): void {
    if (sourceStepId === targetStepId) return;
    const ordered = (deps.lib.StepsByGroup.get(stepGroupId) ?? []).map((s: StepRow) => s.StepId);
    const next = reorderList(ordered, sourceStepId, targetStepId);
    if (next === null) return;
    deps.setPendingStepOrder((prev) => new Map(prev).set(stepGroupId, next));
    try {
        deps.lib.reorderSteps(stepGroupId, next);
    } catch (caught) {
        deps.setPendingStepOrder((prev) => {
            const m = new Map(prev); m.delete(stepGroupId); return m;
        });
        toast.error(caught instanceof Error ? caught.message : "Reorder failed");
    }
}

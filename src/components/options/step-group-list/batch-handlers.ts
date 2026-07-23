/**
 * Extracted batch rename/delete toast handlers for
 * `useListPanelMutations` to keep that hook under the
 * ESLint max-lines-per-function cap.
 */
import { toast } from "sonner";

import type { UseStepLibraryApi } from "@/hooks/use-step-library";
import type {
    BatchRenameOutcome,
    useStepGroupBatchActions,
} from "@/hooks/use-step-group-batch-actions";
import type { BatchRenameChange } from "../BatchRenameDialog";

function announceUndo(undone: BatchRenameOutcome): void {
    if (undone.Error !== null && undone.Applied === 0) {
        toast.error("Undo failed", { description: undone.Error });
        return;
    }
    toast.success(`Reverted ${undone.Applied} rename${undone.Applied === 1 ? "" : "s"}`);
}

function announceBatchRename(outcome: BatchRenameOutcome): void {
    const verb = outcome.Error === null ? "Renamed" : "Partially renamed";
    toast.success(`${verb} ${outcome.Applied} group${outcome.Applied === 1 ? "" : "s"}`, {
        description: outcome.Error ?? "Click Undo to revert.",
        action: { label: "Undo", onClick: () => announceUndo(outcome.undo()) },
        duration: 8000,
    });
}

export function applyBatchRenameWithToast(
    batchActions: ReturnType<typeof useStepGroupBatchActions>,
    changes: ReadonlyArray<BatchRenameChange>,
): void {
    const outcome: BatchRenameOutcome = batchActions.applyBatchRename(changes);
    if (outcome.Error !== null && outcome.Applied === 0) {
        toast.error("Batch rename failed", { description: outcome.Error });
        return;
    }
    announceBatchRename(outcome);
}

interface RunBatchDeleteInput {
    readonly ids: ReadonlyArray<number>;
    readonly lib: UseStepLibraryApi;
    readonly activeGroupId: number | null;
    readonly setActiveGroupId: (id: number | null) => void;
    readonly setSelected: React.Dispatch<React.SetStateAction<ReadonlySet<number>>>;
}

function deleteEach(ids: ReadonlyArray<number>, lib: UseStepLibraryApi): { deleted: number; firstError: string | null } {
    let deleted = 0;
    let firstError: string | null = null;
    for (const id of ids) {
        try { lib.deleteGroup(id); deleted += 1; }
        catch (err) { firstError = err instanceof Error ? err.message : String(err); break; }
    }
    return { deleted, firstError };
}

export function runBatchDelete(input: RunBatchDeleteInput): void {
    const { ids, lib, activeGroupId, setActiveGroupId, setSelected } = input;
    const { deleted, firstError } = deleteEach(ids, lib);
    setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
    });
    if (activeGroupId !== null && ids.includes(activeGroupId)) setActiveGroupId(null);
    if (firstError !== null && deleted === 0) {
        toast.error("Batch delete failed", { description: firstError });
    } else {
        toast.success(`Deleted ${deleted} group${deleted === 1 ? "" : "s"}`, {
            description: firstError ?? "This action cannot be undone.",
        });
    }
}

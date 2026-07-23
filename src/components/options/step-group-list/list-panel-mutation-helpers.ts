/**
 * Extracted sub-hooks/helpers for `useListPanelMutations` so the
 * main hook stays under the ESLint `max-lines-per-function` cap.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { StepGroupRow } from "@/background/recorder/step-library/db";
import type { UseStepLibraryApi } from "@/hooks/use-step-library";

export const NAME_MAX_LEN = 120;

export function validateName(raw: string, siblingNames: ReadonlyArray<string>): string | null {
    const trimmed = raw.trim();
    if (trimmed === "") return "Name is required.";
    if (trimmed.length > NAME_MAX_LEN) return `Name must be ${NAME_MAX_LEN} characters or fewer.`;
    const lower = trimmed.toLowerCase();
    const clash = siblingNames.find((s) => s.toLowerCase() === lower);
    if (clash !== undefined) return "Another group at this level already has that name.";
    return null;
}

export function useDialogStates() {
    const [createDialog, setCreateDialog] = useState<{ open: boolean; name: string }>({ open: false, name: "" });
    const [renameDialog, setRenameDialog] = useState<{ open: boolean; group: StepGroupRow | null; name: string }>({ open: false, group: null, name: "" });
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; group: StepGroupRow | null }>({ open: false, group: null });
    return { createDialog, setCreateDialog, renameDialog, setRenameDialog, deleteDialog, setDeleteDialog };
}

export function useValidationErrors(
    lib: UseStepLibraryApi,
    createName: string,
    renameGroup: StepGroupRow | null,
    renameName: string,
) {
    const rootSiblingNames = useMemo(
        () => lib.Groups.filter((g) => g.ParentStepGroupId === null).map((g) => g.Name),
        [lib.Groups],
    );
    const renameSiblingNames = useMemo(() => {
        if (renameGroup === null) return [] as string[];
        const parentId = renameGroup.ParentStepGroupId ?? null;
        return lib.Groups
            .filter((g) => (g.ParentStepGroupId ?? null) === parentId && g.StepGroupId !== renameGroup.StepGroupId)
            .map((g) => g.Name);
    }, [lib.Groups, renameGroup]);
    const createError = useMemo(() => validateName(createName, rootSiblingNames), [createName, rootSiblingNames]);
    const renameError = useMemo(() => {
        if (renameGroup === null) return null;
        const baseError = validateName(renameName, renameSiblingNames);
        if (baseError !== null) return baseError;
        if (renameName.trim() === renameGroup.Name) return "Type a different name to rename.";
        return null;
    }, [renameName, renameGroup, renameSiblingNames]);
    return { createError, renameError };
}

interface SubmitDeps {
    readonly lib: UseStepLibraryApi;
    readonly activeGroupId: number | null;
    readonly setActiveGroupId: (id: number | null) => void;
}

export function makeSubmitCreate(
    deps: SubmitDeps,
    createDialog: { name: string },
    createError: string | null,
    setCreateDialog: (v: { open: boolean; name: string }) => void,
) {
    return () => {
        if (createError !== null) return;
        const name = createDialog.name.trim();
        try {
            const newId = deps.lib.createGroup({ Name: name, ParentStepGroupId: null });
            setCreateDialog({ open: false, name: "" });
            deps.setActiveGroupId(newId);
            toast.success(`Created "${name}"`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Create failed");
        }
    };
}

export function makeSubmitRename(
    deps: SubmitDeps,
    renameDialog: { group: StepGroupRow | null; name: string },
    renameError: string | null,
    setRenameDialog: (v: { open: boolean; group: StepGroupRow | null; name: string }) => void,
) {
    return () => {
        if (renameError !== null || renameDialog.group === null) return;
        const name = renameDialog.name.trim();
        try {
            deps.lib.renameGroup(renameDialog.group.StepGroupId, name);
            toast.success(`Renamed to "${name}"`);
            setRenameDialog({ open: false, group: null, name: "" });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Rename failed");
        }
    };
}

export function makeSubmitDelete(
    deps: SubmitDeps,
    deleteDialog: { group: StepGroupRow | null },
    setDeleteDialog: (v: { open: boolean; group: StepGroupRow | null }) => void,
) {
    return () => {
        if (deleteDialog.group === null) return;
        const id = deleteDialog.group.StepGroupId;
        const name = deleteDialog.group.Name;
        try {
            deps.lib.deleteGroup(id);
            if (deps.activeGroupId === id) deps.setActiveGroupId(null);
            toast.success(`Deleted "${name}"`);
            setDeleteDialog({ open: false, group: null });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Delete failed");
        }
    };
}

/**
 * Create / Rename / Delete dialog trio for `StepGroupListPanel`.
 *
 * Extracted as the Plan 24 / Step 4 (Phase 1) slice for the list panel,
 * mirroring the tree panel's `LibraryDialogs` split. All state remains
 * owned by the panel; this component is a thin JSX shell that also
 * exports the `ValidatedNameField` used inside those dialogs so the
 * panel no longer needs to define it inline.
 *
 * No behavioural change: markup, props, and event wiring are verbatim
 * lifts of the previous inline blocks (StepGroupListPanel.tsx lines
 * 920 to 1027 + the inline `ValidatedNameField` from lines 1054-1091).
 */

import { FilePlus2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { StepGroupRow } from "@/background/recorder/step-library/db";

/**
 * Kept in sync with the panel copy. Duplicated (not imported) to
 * avoid a circular back-import from the parent panel.
 */
export const NAME_MAX_LEN = 120;

export interface CreateDialogState {
    readonly open: boolean;
    readonly name: string;
}

export interface RenameDialogState {
    readonly open: boolean;
    readonly group: StepGroupRow | null;
    readonly name: string;
}

export interface DeleteDialogState {
    readonly open: boolean;
    readonly group: StepGroupRow | null;
}

interface ListPanelDialogsProps {
    readonly projectName: string | null;

    readonly createDialog: CreateDialogState;
    readonly setCreateDialog: (next: CreateDialogState) => void;
    readonly createError: string | null;
    readonly submitCreate: () => void;

    readonly renameDialog: RenameDialogState;
    readonly setRenameDialog: (next: RenameDialogState) => void;
    readonly renameError: string | null;
    readonly submitRename: () => void;

    readonly deleteDialog: DeleteDialogState;
    readonly setDeleteDialog: (next: DeleteDialogState) => void;
    readonly submitDelete: () => void;
}

export function ListPanelDialogs(props: ListPanelDialogsProps): JSX.Element {
    const {
        projectName,
        createDialog, setCreateDialog, createError, submitCreate,
        renameDialog, setRenameDialog, renameError, submitRename,
        deleteDialog, setDeleteDialog, submitDelete,
    } = props;

    return (
        <>
            {/* ---------- Create dialog ---------- */}
            <Dialog
                open={createDialog.open}
                onOpenChange={(open) =>
                    setCreateDialog(open
                        ? { ...createDialog, open: true }
                        : { open: false, name: "" })
                }
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create top-level group</DialogTitle>
                        <DialogDescription>
                            Groups bundle related steps. The new group will appear at the
                            root of {projectName ?? "this project"}.
                        </DialogDescription>
                    </DialogHeader>
                    <ValidatedNameField
                        id="list-create-group-name"
                        label="Name"
                        value={createDialog.name}
                        error={createError}
                        placeholder="e.g. Checkout flow"
                        onChange={(v) => setCreateDialog({ ...createDialog, name: v })}
                        onSubmit={submitCreate}
                    />
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setCreateDialog({ open: false, name: "" })}
                        >
                            Cancel
                        </Button>
                        <Button onClick={submitCreate} disabled={createError !== null}>
                            <FilePlus2 className="mr-1 h-4 w-4" />
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ---------- Rename dialog ---------- */}
            <Dialog
                open={renameDialog.open}
                onOpenChange={(open) =>
                    setRenameDialog(open
                        ? { ...renameDialog, open: true }
                        : { open: false, group: null, name: "" })
                }
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename group</DialogTitle>
                        <DialogDescription>
                            Sibling group names must be unique within the same parent.
                        </DialogDescription>
                    </DialogHeader>
                    <ValidatedNameField
                        id="list-rename-group-name"
                        label="New name"
                        value={renameDialog.name}
                        error={renameError}
                        onChange={(v) => setRenameDialog({ ...renameDialog, name: v })}
                        onSubmit={submitRename}
                    />
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() =>
                                setRenameDialog({ open: false, group: null, name: "" })
                            }
                        >
                            Cancel
                        </Button>
                        <Button onClick={submitRename} disabled={renameError !== null}>
                            Rename
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ---------- Delete confirmation ---------- */}
            <AlertDialog
                open={deleteDialog.open}
                onOpenChange={(open) =>
                    setDeleteDialog(open
                        ? { ...deleteDialog, open: true }
                        : { open: false, group: null })
                }
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete "{deleteDialog.group?.Name}"?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes the group and every nested
                            group + step inside it. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={submitDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

/**
 * Reusable name input that wires together the label, the controlled
 * input, and a live-error region. Accessibility: the error message is
 * linked via `aria-describedby` and `aria-invalid` flips with `error`.
 */
export function ValidatedNameField(props: {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly error: string | null;
    readonly placeholder?: string;
    readonly onChange: (value: string) => void;
    readonly onSubmit: () => void;
}): JSX.Element {
    const helpId = `${props.id}-help`;
    const invalid = props.error !== null && props.value !== "";
    return (
        <div className="space-y-2">
            <Label htmlFor={props.id}>{props.label}</Label>
            <Input
                id={props.id}
                value={props.value}
                maxLength={NAME_MAX_LEN}
                placeholder={props.placeholder}
                onChange={(e) => props.onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") props.onSubmit();
                }}
                aria-invalid={invalid}
                aria-describedby={helpId}
                autoFocus
                className={invalid ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            <p
                id={helpId}
                className={`min-h-[1rem] text-xs ${
                    props.error === null ? "text-muted-foreground" : "text-destructive"
                }`}
            >
                {props.error ?? `${props.value.trim().length}/${NAME_MAX_LEN}`}
            </p>
        </div>
    );
}

/**
 * Marco Extension — Step Group Library dialog bundle.
 *
 * Presentational grouping of the 14 dialog surfaces that live at the
 * bottom of `StepGroupLibraryPanel`. Owns no state — the parent panel
 * remains the single source of truth, and hands us the six hook-return
 * bags directly (`lib`, `state`, `viewModel`, `mutations`, `exportImport`,
 * `importApi`).
 *
 * Plan 25 · Step 8 (SS-06 Phase 4): the previous flat 41-prop surface
 * was collapsed into six named bags. Each sub-group destructures only
 * the bags it needs, so future prop churn stays local.
 */

import type { JSX } from "react";
import { FilePlus2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import BatchRenameDialog from "../BatchRenameDialog";
import BatchDeleteDialog from "../BatchDeleteDialog";
import BatchRunDialog from "../BatchRunDialog";
import RunGroupDialog from "../RunGroupDialog";
import WebhookSettingsDialog from "../WebhookSettingsDialog";
import InputSourceDialog from "../InputSourceDialog";
import StepWaitDialog from "../StepWaitDialog";
import ImportErrorDialog from "../ImportErrorDialog";
import ImportSummaryDialog from "../ImportSummaryDialog";
import ExportPreviewDialog from "../ExportPreviewDialog";
import ExportErrorDialog from "../ExportErrorDialog";
import { GroupInputsDialog } from "../GroupInputsDialog";
import { CsvInputDialog } from "../CsvInputDialog";
import StepEditorDialog from "../StepEditorDialog";

import type { StepKindId } from "@/background/recorder/step-library/schema";
import type { useStepLibrary } from "@/hooks/use-step-library";
import type { useStepGroupImport } from "@/hooks/use-step-group-import";

import type { useLibraryPanelState } from "./use-library-panel-state";
import type { useStepGroupLibraryViewModel } from "./use-view-model";
import type { useStepGroupMutations } from "./use-step-group-mutations";
import type { useStepGroupExportImport } from "./use-export-import";

import type {
    CreateDialogState,
    RenameDialogState,
    GroupTargetDialogState,
    DeleteStepDialogState,
} from "./dialog-state";

export interface StepEditorSubmitInput {
    readonly StepKindId: StepKindId;
    readonly Label: string | null;
    readonly PayloadJson: string | null;
    readonly TargetStepGroupId: number | null;
}

export interface LibraryDialogsProps {
    readonly lib: ReturnType<typeof useStepLibrary>;
    readonly state: ReturnType<typeof useLibraryPanelState>;
    readonly viewModel: ReturnType<typeof useStepGroupLibraryViewModel>;
    readonly mutations: ReturnType<typeof useStepGroupMutations>;
    readonly exportImport: ReturnType<typeof useStepGroupExportImport>;
    readonly importApi: ReturnType<typeof useStepGroupImport>;
}

function CreateGroupDialog(props: {
    readonly state: CreateDialogState;
    readonly setState: React.Dispatch<React.SetStateAction<CreateDialogState>>;
    readonly onSubmit: () => void;
}): JSX.Element {
    const { state, setState, onSubmit } = props;
    const title = state.parent === null ? "Create top-level group" : "Create child group";
    return (
        <Dialog open={state.open} onOpenChange={(open) => setState((p) => ({ ...p, open }))}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Groups bundle related steps and can nest up to 8 levels deep.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="new-group-name">Name</Label>
                    <Input
                        id="new-group-name"
                        value={state.name}
                        maxLength={120}
                        placeholder="e.g. Checkout flow"
                        onChange={(evt) => setState((p) => ({ ...p, name: evt.target.value }))}
                        onKeyDown={(evt) => { if (evt.key === "Enter") onSubmit(); }}
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => setState({ open: false, parent: null, name: "" })}
                    >
                        Cancel
                    </Button>
                    <Button onClick={onSubmit}>
                        <FilePlus2 className="mr-1 h-4 w-4" /> Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function RenameGroupDialog(props: {
    readonly state: RenameDialogState;
    readonly setState: React.Dispatch<React.SetStateAction<RenameDialogState>>;
    readonly onSubmit: () => void;
}): JSX.Element {
    const { state, setState, onSubmit } = props;
    return (
        <Dialog open={state.open} onOpenChange={(open) => setState((p) => ({ ...p, open }))}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rename group</DialogTitle>
                    <DialogDescription>
                        Sibling group names must be unique within the same parent.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="rename-group-name">New name</Label>
                    <Input
                        id="rename-group-name"
                        value={state.name}
                        maxLength={120}
                        onChange={(evt) => setState((p) => ({ ...p, name: evt.target.value }))}
                        onKeyDown={(evt) => { if (evt.key === "Enter") onSubmit(); }}
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => setState({ open: false, group: null, name: "" })}
                    >
                        Cancel
                    </Button>
                    <Button onClick={onSubmit}>Rename</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DeleteGroupDialog(props: {
    readonly state: GroupTargetDialogState;
    readonly setState: React.Dispatch<React.SetStateAction<GroupTargetDialogState>>;
    readonly onConfirm: () => void;
}): JSX.Element {
    const { state, setState, onConfirm } = props;
    return (
        <AlertDialog open={state.open} onOpenChange={(open) => setState((p) => ({ ...p, open }))}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Delete "{state.group?.Name}"?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        This permanently removes the group and every nested
                        group + step inside it. This cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function renderDeleteStepBody(state: DeleteStepDialogState): string {
    if (state.step === null) return "No step selected.";
    const label = state.step.Label ?? `Step #${state.step.StepId}`;
    return `"${label}" will be removed from this group. This cannot be undone.`;
}

function DeleteStepConfirmDialog(props: {
    readonly state: DeleteStepDialogState;
    readonly setState: React.Dispatch<React.SetStateAction<DeleteStepDialogState>>;
    readonly onConfirm: () => void;
}): JSX.Element {
    const { state, setState, onConfirm } = props;
    const bodyText = renderDeleteStepBody(state);
    return (
        <AlertDialog open={state.open} onOpenChange={(open) => setState((p) => ({ ...p, open }))}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete this step?</AlertDialogTitle>
                    <AlertDialogDescription>{bodyText}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setState({ open: false, step: null })}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        Delete step
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function CrudDialogGroup(props: LibraryDialogsProps): JSX.Element {
    const { state, viewModel, mutations, lib } = props;
    return (
        <>
            <CreateGroupDialog
                state={state.createDialog}
                setState={state.setCreateDialog}
                onSubmit={mutations.handleCreate}
            />
            <RenameGroupDialog
                state={state.renameDialog}
                setState={state.setRenameDialog}
                onSubmit={mutations.handleRename}
            />
            <DeleteGroupDialog
                state={state.deleteDialog}
                setState={state.setDeleteDialog}
                onConfirm={mutations.handleDelete}
            />
            <BatchRenameDialog
                open={state.batchRenameOpen}
                onOpenChange={state.setBatchRenameOpen}
                targets={viewModel.selectedGroups}
                allGroups={lib.Groups}
                onApply={mutations.handleBatchRenameApply}
            />
            <BatchDeleteDialog
                open={state.batchDeleteOpen}
                onOpenChange={state.setBatchDeleteOpen}
                rows={viewModel.deletePreview}
                onConfirm={mutations.handleBatchDeleteConfirm}
            />
        </>
    );
}

function RunAndSettingsDialogGroup(props: LibraryDialogsProps): JSX.Element {
    const { state, viewModel, lib } = props;
    return (
        <>
            <BatchRunDialog
                open={state.batchOpen}
                onOpenChange={state.setBatchOpen}
                db={lib.Lib}
                projectId={lib.Project?.ProjectId ?? null}
                initialOrder={state.selectionOrder}
                groupsById={viewModel.groupsById}
                groupInputs={lib.GroupInputs}
                onApplyMergedInput={(gid, bag) => lib.setGroupInput(gid, bag)}
            />
            <RunGroupDialog
                open={state.runGroupDialog.open}
                onOpenChange={(open) => state.setRunGroupDialog((p) => ({ ...p, open }))}
                db={lib.Lib}
                projectId={lib.Project?.ProjectId ?? null}
                group={state.runGroupDialog.group}
                groupName={(id) => viewModel.groupsById.get(id)?.Name ?? `Group #${id}`}
            />
            <WebhookSettingsDialog open={state.webhookOpen} onOpenChange={state.setWebhookOpen} />
            <InputSourceDialog open={state.inputSourceOpen} onOpenChange={state.setInputSourceOpen} />
            <StepWaitDialog
                open={state.waitDialog.open}
                onOpenChange={(open) => state.setWaitDialog((p) => ({ ...p, open }))}
                stepId={state.waitDialog.stepId}
                stepLabel={state.waitDialog.stepLabel}
                onChange={state.refreshStepWaits}
            />
        </>
    );
}

function BundleDialogGroup(props: LibraryDialogsProps): JSX.Element {
    const { importApi, exportImport } = props;
    return (
        <>
            <ImportErrorDialog
                open={importApi.errorState.Open}
                onOpenChange={importApi.setErrorOpen}
                explanation={importApi.errorState.Explanation}
                fileName={importApi.errorState.FileName}
            />
            <ImportSummaryDialog
                open={importApi.summaryState.Open}
                onOpenChange={importApi.setSummaryOpen}
                summary={importApi.summaryState.Summary}
                fileName={importApi.summaryState.FileName}
            />
            <ExportPreviewDialog
                open={exportImport.exportPreview.Open}
                onOpenChange={(open) =>
                    exportImport.setExportPreview((p) =>
                        open ? { ...p, Open: true } : { Open: false, Preview: null, Pending: null },
                    )
                }
                preview={exportImport.exportPreview.Preview}
                includeDescendants={exportImport.exportPreview.Pending?.IncludeDescendants ?? true}
                onConfirm={() => void exportImport.confirmExport()}
            />
            <ExportErrorDialog
                open={exportImport.exportError.Open}
                onOpenChange={(open) =>
                    exportImport.setExportError((p) =>
                        open ? { ...p, Open: true } : { Open: false, Explanation: null },
                    )
                }
                explanation={exportImport.exportError.Explanation}
            />
        </>
    );
}

function StepDialogGroup(props: LibraryDialogsProps): JSX.Element {
    const { state, lib, mutations } = props;
    return (
        <>
            <GroupInputsDialog
                open={state.inputsDialog.open}
                groupName={state.inputsDialog.group?.Name ?? null}
                groupId={state.inputsDialog.group?.StepGroupId ?? null}
                currentBag={state.inputsDialog.group === null
                    ? null
                    : (lib.GroupInputs.get(state.inputsDialog.group.StepGroupId) ?? null)}
                onOpenChange={(open) => state.setInputsDialog((p) => ({ ...p, open }))}
                onApply={(gid, bag) => lib.setGroupInput(gid, bag)}
                onClear={(gid) => lib.clearGroupInput(gid)}
            />
            <CsvInputDialog
                open={state.csvDialog.open}
                groupName={state.csvDialog.group?.Name ?? null}
                groupId={state.csvDialog.group?.StepGroupId ?? null}
                onOpenChange={(open) => state.setCsvDialog((p) => ({ ...p, open }))}
                onApply={(gid, bag) => lib.setGroupInput(gid, bag)}
            />
            <StepEditorDialog
                open={state.stepEditor.open}
                mode={state.stepEditor.mode}
                groups={lib.Groups}
                onCancel={() => state.setStepEditor({ open: false, mode: null })}
                onSubmit={mutations.handleStepEditorSubmit}
            />
            <DeleteStepConfirmDialog
                state={state.deleteStepDialog}
                setState={state.setDeleteStepDialog}
                onConfirm={mutations.handleStepDeleteConfirm}
            />
        </>
    );
}

export function LibraryDialogs(props: LibraryDialogsProps): JSX.Element {
    return (
        <>
            <CrudDialogGroup {...props} />
            <RunAndSettingsDialogGroup {...props} />
            <BundleDialogGroup {...props} />
            <StepDialogGroup {...props} />
        </>
    );
}

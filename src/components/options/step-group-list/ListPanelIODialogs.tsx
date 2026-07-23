/**
 * Marco Extension, Step Group List Panel: export + import + batch dialog cluster.
 *
 * Groups the four peripheral dialogs (export preview, export error,
 * import summary, import error) plus the batch rename / batch delete
 * dialogs so `StepGroupListPanel` can render them with a single tag,
 * keeping its render function under the lint threshold.
 */

import type { Dispatch, SetStateAction } from "react";

import ExportPreviewDialog from "../ExportPreviewDialog";
import ExportErrorDialog from "../ExportErrorDialog";
import ImportErrorDialog from "../ImportErrorDialog";
import ImportSummaryDialog from "../ImportSummaryDialog";
import BatchRenameDialog from "../BatchRenameDialog";
import BatchDeleteDialog from "../BatchDeleteDialog";

import type { useStepGroupExport } from "@/hooks/use-step-group-export";
import type { useStepGroupImport } from "@/hooks/use-step-group-import";
import type { StepGroupRow } from "@/background/recorder/step-library/db";
import type { buildDeletePreview } from "@/hooks/use-step-group-batch-actions";

type ExportApi = ReturnType<typeof useStepGroupExport>;
type ImportApi = ReturnType<typeof useStepGroupImport>;
type DeletePreview = ReturnType<typeof buildDeletePreview>;

interface ListPanelIODialogsProps {
    exportApi: ExportApi;
    importApi: ImportApi;
    allGroups: ReadonlyArray<StepGroupRow>;
    selectedGroups: ReadonlyArray<StepGroupRow>;
    deletePreview: DeletePreview;
    batchRenameOpen: boolean;
    setBatchRenameOpen: Dispatch<SetStateAction<boolean>>;
    batchDeleteOpen: boolean;
    setBatchDeleteOpen: Dispatch<SetStateAction<boolean>>;
    onBatchRenameApply: Parameters<typeof BatchRenameDialog>[0]["onApply"];
    onBatchDeleteConfirm: Parameters<typeof BatchDeleteDialog>[0]["onConfirm"];
}

export function ListPanelIODialogs(props: ListPanelIODialogsProps) {
    const {
        exportApi,
        importApi,
        allGroups,
        selectedGroups,
        deletePreview,
        batchRenameOpen,
        setBatchRenameOpen,
        batchDeleteOpen,
        setBatchDeleteOpen,
        onBatchRenameApply,
        onBatchDeleteConfirm,
    } = props;

    return (
        <>
            <ExportPreviewDialog
                open={exportApi.previewState.Open}
                onOpenChange={exportApi.setPreviewOpen}
                preview={exportApi.previewState.Preview}
                includeDescendants={exportApi.previewState.Pending?.IncludeDescendants ?? true}
                onConfirm={() => { void exportApi.confirmExport(); }}
            />
            <ExportErrorDialog
                open={exportApi.errorState.Open}
                onOpenChange={exportApi.setErrorOpen}
                explanation={exportApi.errorState.Explanation}
            />

            <ImportSummaryDialog
                open={importApi.summaryState.Open}
                onOpenChange={importApi.setSummaryOpen}
                summary={importApi.summaryState.Summary}
                fileName={importApi.summaryState.FileName}
            />
            <ImportErrorDialog
                open={importApi.errorState.Open}
                onOpenChange={importApi.setErrorOpen}
                explanation={importApi.errorState.Explanation}
                fileName={importApi.errorState.FileName}
            />

            <BatchRenameDialog
                open={batchRenameOpen}
                onOpenChange={setBatchRenameOpen}
                targets={selectedGroups}
                allGroups={allGroups}
                onApply={onBatchRenameApply}
            />
            <BatchDeleteDialog
                open={batchDeleteOpen}
                onOpenChange={setBatchDeleteOpen}
                rows={deletePreview}
                onConfirm={onBatchDeleteConfirm}
            />
        </>
    );
}

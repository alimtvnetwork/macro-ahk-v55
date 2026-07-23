/**
 * Export / import handlers for StepGroupLibraryPanel.
 *
 * Extracted from the main panel to keep the render function under the
 * `max-lines-per-function` limit. All state that survives across renders
 * (last export summary, preview dialog, error dialog) is owned here;
 * the panel only holds a ref to trigger the hidden file input.
 *
 * Phase 7 (Plan 24 / SS-04a) further broke the two large handlers
 * (`performExport`, `handleExport`) into small named helpers so no
 * function body exceeds the coding-guideline ceiling.
 *
 * @see StepGroupLibraryPanel
 */

import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import JSZip from "jszip";
import { toast } from "sonner";

import type { useStepLibrary } from "@/hooks/use-step-library";
import type { useStepGroupImport } from "@/hooks/use-step-group-import";
import {
    runStepGroupExport,
    previewStepGroupExport,
} from "@/background/recorder/step-library/export-bundle";
import { explainExportFailure } from "@/background/recorder/step-library/export-error-explainer";
import type { LastExportSummary } from "../BundleExchangePanel";
import type {
    ExportErrorState,
    ExportPreviewState,
} from "./dialog-state";

type StepLibrary = ReturnType<typeof useStepLibrary>;
type ExportFailure = Parameters<typeof explainExportFailure>[0];
type ExportSuccess = Extract<Awaited<ReturnType<typeof runStepGroupExport>>, { Reason: "Ok" }>;

interface UseExportImportArgs {
    lib: StepLibrary;
    selected: ReadonlySet<number>;
    importApi: ReturnType<typeof useStepGroupImport>;
    fileInputRef: RefObject<HTMLInputElement>;
}

interface UseExportImportResult {
    lastExport: LastExportSummary | null;
    exportPreview: ExportPreviewState;
    setExportPreview: Dispatch<SetStateAction<ExportPreviewState>>;
    exportError: ExportErrorState;
    setExportError: Dispatch<SetStateAction<ExportErrorState>>;
    handleExport: (
        idsOverride?: ReadonlyArray<number>,
        includeDescendants?: boolean,
    ) => void;
    confirmExport: () => Promise<void>;
    handleImportClick: () => void;
    handleImportFile: (file: File) => Promise<void>;
}

function isLibraryReady(lib: StepLibrary): boolean {
    return lib.Lib !== null && lib.Project !== null && lib.SqlJs !== null;
}

function downloadZipBlob(zipBytes: Uint8Array, fileName: string): void {
    const blob = new Blob([zipBytes as BlobPart], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function surfaceExportFailure(
    failure: ExportFailure,
    setExportError: Dispatch<SetStateAction<ExportErrorState>>,
): void {
    const explanation = explainExportFailure(failure);
    setExportError({ Open: true, Explanation: explanation });
    toast.error(explanation.Title, { description: "See dialog for details" });
}

function toLastExportSummary(result: ExportSuccess): LastExportSummary {
    return {
        FileName: result.ZipFileName,
        GroupCount: result.Manifest.Counts.StepGroups,
        StepCount: result.Manifest.Counts.Steps,
        At: new Date().toISOString(),
    };
}

function resolveExportIds(
    idsOverride: ReadonlyArray<number> | undefined,
    selected: ReadonlySet<number>,
): ReadonlyArray<number> {
    return idsOverride ?? Array.from(selected);
}

export function useStepGroupExportImport(
    args: UseExportImportArgs,
): UseExportImportResult {
    const { lib, selected, importApi, fileInputRef } = args;

    const [lastExport, setLastExport] = useState<LastExportSummary | null>(null);
    const [exportPreview, setExportPreview] = useState<ExportPreviewState>({
        Open: false, Preview: null, Pending: null,
    });
    const [exportError, setExportError] = useState<ExportErrorState>({
        Open: false, Explanation: null,
    });

    const performExport = async (
        ids: ReadonlyArray<number>,
        includeDescendants: boolean,
    ): Promise<void> => {
        if (!isLibraryReady(lib) || lib.Lib === null || lib.Project === null || lib.SqlJs === null) {
            toast.error("Library not ready");
            return;
        }
        const result = await runStepGroupExport({
            Source: lib.Lib,
            ProjectId: lib.Project.ProjectId,
            SelectedStepGroupIds: ids,
            IncludeDescendants: includeDescendants,
            BundleName: `${lib.Project.Name} - ${ids.length} group(s)`,
            SqlJs: lib.SqlJs,
            JsZip: JSZip,
        });
        if (result.Reason !== "Ok") {
            surfaceExportFailure(result, setExportError);
            return;
        }
        downloadZipBlob(result.ZipBytes, result.ZipFileName);
        setLastExport(toLastExportSummary(result));
        toast.success(
            `Exported ${result.Manifest.Counts.StepGroups} group(s)`,
            { description: `${result.Manifest.Counts.Steps} steps, ${result.ZipFileName}` },
        );
    };

    const openExportPreview = (
        ids: ReadonlyArray<number>,
        includeDescendants: boolean,
    ): void => {
        if (lib.Lib === null || lib.Project === null) return;
        const preview = previewStepGroupExport({
            Source: lib.Lib,
            ProjectId: lib.Project.ProjectId,
            SelectedStepGroupIds: ids,
            IncludeDescendants: includeDescendants,
        });
        if (preview.Reason !== "Ok") {
            surfaceExportFailure(preview, setExportError);
            return;
        }
        setExportPreview({
            Open: true,
            Preview: preview,
            Pending: { Ids: ids, IncludeDescendants: includeDescendants },
        });
    };

    const handleExport = (
        idsOverride?: ReadonlyArray<number>,
        includeDescendants: boolean = true,
    ): void => {
        if (!isLibraryReady(lib)) {
            toast.error("Library not ready");
            return;
        }
        const ids = resolveExportIds(idsOverride, selected);
        if (ids.length === 0) {
            toast.error("Select at least one group to export");
            return;
        }
        openExportPreview(ids, includeDescendants);
    };

    const confirmExport = async (): Promise<void> => {
        const pending = exportPreview.Pending;
        setExportPreview({ Open: false, Preview: null, Pending: null });
        if (pending === null) return;
        await performExport(pending.Ids, pending.IncludeDescendants);
    };

    const handleImportClick = (): void => {
        fileInputRef.current?.click();
    };

    const handleImportFile = async (file: File): Promise<void> => {
        await importApi.importFile(file);
    };

    return {
        lastExport,
        exportPreview,
        setExportPreview,
        exportError,
        setExportError,
        handleExport,
        confirmExport,
        handleImportClick,
        handleImportFile,
    };
}

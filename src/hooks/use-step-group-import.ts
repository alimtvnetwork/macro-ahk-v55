/**
 * Marco Extension — useStepGroupImport
 *
 * Reusable import pipeline shared by every panel that lets the user
 * drop a `.zip` step-group bundle into the current project.
 *
 * Mirrors `useStepGroupExport` so both directions of the bundle
 * exchange feel identical from a caller's perspective:
 *
 *   - `importFile(file)` reads the ZIP, calls `runStepGroupImport()`,
 *     and routes the outcome to either `summaryState` (success) or
 *     `errorState` (structured failure via `explainImportFailure`).
 *   - `lastImport` is the small status-line summary the BundleExchange
 *     panel already consumes.
 *   - `summaryState` / `errorState` drive the two dialogs (the caller
 *     mounts `ImportSummaryDialog` + `ImportErrorDialog`).
 *
 * Conflict policy is fixed to `"Rename"` here — the only mode that
 * lets the import succeed when an incoming root name collides with an
 * existing one. The renamed pairs are surfaced verbatim in the summary
 * dialog so the user can locate the freshly-imported copy.
 *
 * After a successful import the hook calls `onAfterImport()` so the
 * caller can refresh the underlying library view (`useStepLibrary`).
 *
 * @see ./use-step-group-export — sibling hook for the outbound flow.
 * @see @/background/recorder/step-library/import-bundle — runner.
 */

import { useCallback, useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";

import {
    runStepGroupImport,
    type ImportSummary,
} from "@/background/recorder/step-library/import-bundle";
import {
    explainImportFailure,
    type ImportErrorExplanation,
} from "@/background/recorder/step-library/import-error-explainer";
import type { LastImportSummary } from "@/components/options/BundleExchangePanel";
import type { useStepLibrary } from "@/hooks/use-step-library";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface StepLibrarySliceForImport {
    readonly Lib: ReturnType<typeof useStepLibrary>["Lib"];
    readonly Project: ReturnType<typeof useStepLibrary>["Project"];
    readonly SqlJs: ReturnType<typeof useStepLibrary>["SqlJs"];
}

interface ImportSummaryState {
    readonly Open: boolean;
    readonly Summary: ImportSummary | null;
    readonly FileName: string | null;
}

interface ImportErrorState {
    readonly Open: boolean;
    readonly Explanation: ImportErrorExplanation | null;
    readonly FileName: string | null;
}

export interface UseStepGroupImportApi {
    /** Read + import a user-uploaded ZIP, then open the relevant dialog. */
    readonly importFile: (file: File) => Promise<void>;

    readonly lastImport: LastImportSummary | null;

    readonly summaryState: ImportSummaryState;
    readonly setSummaryOpen: (open: boolean) => void;

    readonly errorState: ImportErrorState;
    readonly setErrorOpen: (open: boolean) => void;
}

interface UseStepGroupImportOptions {
    readonly lib: StepLibrarySliceForImport;
    /**
     * Invoked once after a successful import commits — callers wire
     * this to `useStepLibrary().refresh` so the tree / list views
     * pick up the new groups without a manual reload.
     */
    readonly onAfterImport?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

const INITIAL_SUMMARY: ImportSummaryState = { Open: false, Summary: null, FileName: null };
const INITIAL_ERROR: ImportErrorState = { Open: false, Explanation: null, FileName: null };

async function readFileBytes(file: File): Promise<Uint8Array | null> {
    try {
        const ab = await file.arrayBuffer();
        return new Uint8Array(ab);
    } catch (err) {
        const detail = err instanceof Error ? err.message : "Could not read file bytes";
        toast.error("Failed to read ZIP", { description: detail });
        return null;
    }
}

function libNotReady(lib: StepLibrarySliceForImport): boolean {
    return lib.Lib === null || lib.Project === null || lib.SqlJs === null;
}

async function runImportForBytes(
    bytes: Uint8Array,
    lib: StepLibrarySliceForImport,
): ReturnType<typeof runStepGroupImport> {
    return runStepGroupImport({
        ZipBytes: bytes,
        Destination: lib.Lib!,
        DestinationProjectId: lib.Project!.ProjectId,
        OnNameConflict: "Rename",
        SqlJs: lib.SqlJs!,
        JsZip: JSZip,
    });
}

function toastImportSuccess(result: Extract<Awaited<ReturnType<typeof runStepGroupImport>>, { Reason: "Ok" }>): void {
    const renames = result.RenamedRoots.length;
    toast.success(
        `Imported ${result.Counts.StepGroups} group(s)`,
        {
            description:
                `${result.Counts.Steps} steps` +
                (renames > 0 ? ` · ${renames} renamed to avoid conflicts` : ""),
        },
    );
}

type OkResult = Extract<Awaited<ReturnType<typeof runStepGroupImport>>, { Reason: "Ok" }>;

function useImportFile(
    lib: StepLibrarySliceForImport,
    handleSuccess: (result: OkResult, fileName: string) => void,
    setErrorState: (state: ImportErrorState) => void,
): (file: File) => Promise<void> {
    return useCallback(async (file: File) => {
        if (libNotReady(lib)) { toast.error("Library not ready"); return; }
        const bytes = await readFileBytes(file);
        if (bytes === null) { return; }
        const result = await runImportForBytes(bytes, lib);
        if (result.Reason !== "Ok") {
            const explanation = explainImportFailure(result);
            setErrorState({ Open: true, Explanation: explanation, FileName: file.name });
            toast.error(explanation.Title, { description: "See dialog for details" });
            return;
        }
        handleSuccess(result, file.name);
    }, [lib, handleSuccess, setErrorState]);
}

function useHandleSuccess(
    onAfterImport: (() => void) | undefined,
    setLastImport: (v: LastImportSummary) => void,
    setSummaryState: (v: ImportSummaryState) => void,
): (result: OkResult, fileName: string) => void {
    return useCallback((result: OkResult, fileName: string) => {
        onAfterImport?.();
        setLastImport({
            GroupCount: result.Counts.StepGroups,
            StepCount: result.Counts.Steps,
            RenameCount: result.RenamedRoots.length,
            At: new Date().toISOString(),
        });
        setSummaryState({ Open: true, Summary: result, FileName: fileName });
        toastImportSuccess(result);
    }, [onAfterImport, setLastImport, setSummaryState]);
}

export function useStepGroupImport(opts: UseStepGroupImportOptions): UseStepGroupImportApi {
    const { lib, onAfterImport } = opts;
    const [summaryState, setSummaryState] = useState<ImportSummaryState>(INITIAL_SUMMARY);
    const [errorState, setErrorState] = useState<ImportErrorState>(INITIAL_ERROR);
    const [lastImport, setLastImport] = useState<LastImportSummary | null>(null);

    const handleSuccess = useHandleSuccess(onAfterImport, setLastImport, setSummaryState);
    const importFile = useImportFile(lib, handleSuccess, setErrorState);

    const setSummaryOpen = useCallback((open: boolean) => {
        setSummaryState((p) => (open ? { ...p, Open: true } : INITIAL_SUMMARY));
    }, []);
    const setErrorOpen = useCallback((open: boolean) => {
        setErrorState((p) => (open ? { ...p, Open: true } : INITIAL_ERROR));
    }, []);

    return { importFile, lastImport, summaryState, setSummaryOpen, errorState, setErrorOpen };
}

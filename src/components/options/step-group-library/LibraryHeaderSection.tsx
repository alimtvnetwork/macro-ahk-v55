/**
 * Marco Extension — Step Group Library header section.
 *
 * Renders the toolbar, separator, and bundle exchange panel above the
 * two-pane body. Extracted from `StepGroupLibraryBody` per Plan 24
 * SS-06 Phase 3 so the body render stays under the ESLint
 * `max-lines-per-function` ceiling.
 */

import { Separator } from "@/components/ui/separator";

import BundleExchangePanel, {
    type LastExportSummary,
    type LastImportSummary,
} from "../BundleExchangePanel";
import { LibraryToolbar } from "./LibraryToolbar";

import type { useLibraryPanelState } from "./use-library-panel-state";
import type { useStepGroupExportImport } from "./use-export-import";
import type { useLibrarySelection } from "./use-library-selection";
import type { useStepLibrary } from "@/hooks/use-step-library";

type Lib = ReturnType<typeof useStepLibrary>;
type State = ReturnType<typeof useLibraryPanelState>;
type ExportImport = ReturnType<typeof useStepGroupExportImport>;
type Selection = ReturnType<typeof useLibrarySelection>;

interface Props {
    readonly lib: Lib;
    readonly state: State;
    readonly exportImport: ExportImport;
    readonly selection: Selection;
    readonly lastImport: LastImportSummary | null;
    readonly lastExport: LastExportSummary | null;
}

export function LibraryHeaderSection(props: Props) {
    const { lib, state, exportImport, selection, lastImport, lastExport } = props;
    const {
        showArchived, setShowArchived,
        setCreateDialog, setInputSourceOpen, setWebhookOpen,
        setBatchOpen, setBatchRenameOpen, setBatchDeleteOpen,
        fileInputRef, selected,
    } = state;
    const { handleExport, handleImportClick, handleImportFile } = exportImport;
    const { clearSelection } = selection;
    const selectedCount = selected.size;

    return (
        <>
            <LibraryToolbar
                projectName={lib.Project?.Name ?? null}
                showArchived={showArchived}
                setShowArchived={setShowArchived}
                selectedCount={selectedCount}
                clearSelection={clearSelection}
                setCreateDialog={setCreateDialog}
                onImportClick={handleImportClick}
                setInputSourceOpen={setInputSourceOpen}
                setWebhookOpen={setWebhookOpen}
                setBatchOpen={setBatchOpen}
                setBatchRenameOpen={setBatchRenameOpen}
                setBatchDeleteOpen={setBatchDeleteOpen}
                onExportSelected={() => handleExport()}
                fileInputRef={fileInputRef}
                onImportFile={handleImportFile}
            />
            <Separator />
            <BundleExchangePanel
                selectedCount={selectedCount}
                onExport={(includeDescendants) => handleExport(undefined, includeDescendants)}
                onImportFile={handleImportFile}
                lastExport={lastExport}
                lastImport={lastImport}
                disabled={lib.Lib === null || lib.Project === null || lib.SqlJs === null}
            />
        </>
    );
}

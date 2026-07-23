/**
 * Marco Extension — Step Group Library body.
 *
 * Thin composition seam that renders the header, two-pane body, and
 * dialog block. Each JSX island lives in its own file so no function
 * exceeds the ESLint `max-lines-per-function` ceiling. See Plan 24
 * SS-06 Phase 3.
 */

import { Toaster } from "@/components/ui/sonner";

import type { LastImportSummary } from "../BundleExchangePanel";
import { LibraryHeaderSection } from "./LibraryHeaderSection";
import { LibraryTwoPaneBody } from "./LibraryTwoPaneBody";
import { LibraryDialogSection } from "./LibraryDialogSection";

import type { useLibraryPanelState } from "./use-library-panel-state";
import type { useStepGroupLibraryViewModel } from "./use-view-model";
import type { useStepGroupMutations } from "./use-step-group-mutations";
import type { useStepGroupExportImport } from "./use-export-import";
import type { useLibrarySelection } from "./use-library-selection";
import type { useStepLibrary } from "@/hooks/use-step-library";
import type { useStepGroupImport } from "@/hooks/use-step-group-import";

type Lib = ReturnType<typeof useStepLibrary>;
type State = ReturnType<typeof useLibraryPanelState>;
type ViewModel = ReturnType<typeof useStepGroupLibraryViewModel>;
type Mutations = ReturnType<typeof useStepGroupMutations>;
type ExportImport = ReturnType<typeof useStepGroupExportImport>;
type Selection = ReturnType<typeof useLibrarySelection>;
type ImportApi = ReturnType<typeof useStepGroupImport>;

interface StepGroupLibraryBodyProps {
    readonly lib: Lib;
    readonly state: State;
    readonly viewModel: ViewModel;
    readonly mutations: Mutations;
    readonly exportImport: ExportImport;
    readonly selection: Selection;
    readonly importApi: ImportApi;
}

export function StepGroupLibraryBody(props: StepGroupLibraryBodyProps) {
    const { lib, state, viewModel, mutations, exportImport, selection, importApi } = props;
    const lastImport: LastImportSummary | null = importApi.lastImport;

    return (
        <div className="flex h-full min-h-[600px] w-full flex-col gap-4 p-6">
            <Toaster />
            <LibraryHeaderSection
                lib={lib}
                state={state}
                exportImport={exportImport}
                selection={selection}
                lastImport={lastImport}
                lastExport={exportImport.lastExport}
            />
            <LibraryTwoPaneBody
                lib={lib}
                state={state}
                viewModel={viewModel}
                mutations={mutations}
                exportImport={exportImport}
                selection={selection}
            />
            <LibraryDialogSection
                lib={lib}
                state={state}
                viewModel={viewModel}
                mutations={mutations}
                exportImport={exportImport}
                importApi={importApi}
            />
        </div>
    );
}

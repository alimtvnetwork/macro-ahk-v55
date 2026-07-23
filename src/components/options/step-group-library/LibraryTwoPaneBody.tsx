/**
 * Marco Extension — Step Group Library two-pane body.
 *
 * Renders the tree pane + step pane grid. Extracted from
 * `StepGroupLibraryBody` per Plan 24 SS-06 Phase 3 to keep each
 * function under the ESLint `max-lines-per-function` ceiling.
 */

import { toast } from "sonner";

import { LibraryTreePane } from "./LibraryTreePane";
import { LibraryStepPane } from "./LibraryStepPane";

import type { useLibraryPanelState } from "./use-library-panel-state";
import type { useStepGroupLibraryViewModel } from "./use-view-model";
import type { useStepGroupMutations } from "./use-step-group-mutations";
import type { useStepGroupExportImport } from "./use-export-import";
import type { useLibrarySelection } from "./use-library-selection";
import type { useStepLibrary } from "@/hooks/use-step-library";

type Lib = ReturnType<typeof useStepLibrary>;
type State = ReturnType<typeof useLibraryPanelState>;
type ViewModel = ReturnType<typeof useStepGroupLibraryViewModel>;
type Mutations = ReturnType<typeof useStepGroupMutations>;
type ExportImport = ReturnType<typeof useStepGroupExportImport>;
type Selection = ReturnType<typeof useLibrarySelection>;

interface Props {
    readonly lib: Lib;
    readonly state: State;
    readonly viewModel: ViewModel;
    readonly mutations: Mutations;
    readonly exportImport: ExportImport;
    readonly selection: Selection;
}

export function LibraryTwoPaneBody(props: Props) {
    const { lib, state, viewModel, mutations, exportImport, selection } = props;
    const {
        selected, activeGroupId, setActiveGroupId,
        hoveredId, setHoveredId,
        setCreateDialog, setRenameDialog, setDeleteDialog,
        setInputsDialog, setCsvDialog,
        setStepEditor, setWaitDialog, setDeleteStepDialog,
        setRunGroupDialog, stepWaits,
    } = state;
    const {
        query, setQuery, trimmedQuery,
        tree, filteredTree, effectiveExpanded,
        activeGroup, activeSteps,
    } = viewModel;
    const {
        handleMove, handleArchiveToggle,
        handleDropReorder, handleStepDropReorder,
        handleStepMove,
    } = mutations;
    const { handleExport, handleImportClick } = exportImport;
    const { toggleOne, toggleSubtree, toggleExpanded } = selection;

    return (
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
            <LibraryTreePane
                tree={tree}
                filteredTree={filteredTree}
                query={query}
                trimmedQuery={trimmedQuery}
                setQuery={setQuery}
                selected={selected}
                effectiveExpanded={effectiveExpanded}
                activeGroupId={activeGroupId}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                toggleOne={toggleOne}
                toggleSubtree={toggleSubtree}
                toggleExpanded={toggleExpanded}
                setActiveGroupId={setActiveGroupId}
                onCreateChild={(parentId) => setCreateDialog({ open: true, parent: parentId, name: "" })}
                onRename={(g) => setRenameDialog({ open: true, group: g, name: g.Name })}
                onDelete={(g) => setDeleteDialog({ open: true, group: g })}
                onExportOne={(id) => handleExport([id])}
                onMove={handleMove}
                onArchiveToggle={handleArchiveToggle}
                onApplyInputs={(g) => setInputsDialog({ open: true, group: g })}
                onImportCsvInputs={(g) => setCsvDialog({ open: true, group: g })}
                hasInputs={(gid) => lib.GroupInputs.has(gid)}
                onDropReorder={handleDropReorder}
                onCreateRoot={() => setCreateDialog({ open: true, parent: null, name: "" })}
                onImportClick={handleImportClick}
            />
            <LibraryStepPane
                activeGroup={activeGroup}
                activeSteps={activeSteps}
                stepWaits={stepWaits}
                groupInputs={lib.GroupInputs}
                onOpenInputs={(g) => setInputsDialog({ open: true, group: g })}
                onOpenCsv={(g) => setCsvDialog({ open: true, group: g })}
                onCreateStep={(g) => setStepEditor({ open: true, mode: { Kind: "create", StepGroupId: g.StepGroupId } })}
                onRunGroup={(g) => setRunGroupDialog({ open: true, group: g })}
                onStepMove={handleStepMove}
                onStepDropReorder={handleStepDropReorder}
                onStepToggleDisabled={(step, nextDisabled) => {
                    lib.setStepDisabled(step.StepId, nextDisabled);
                    toast.success(
                        nextDisabled
                            ? `Step "${step.Label ?? step.StepId}" disabled, will be skipped on run`
                            : `Step "${step.Label ?? step.StepId}" enabled`,
                    );
                }}
                onStepEdit={(step) => setStepEditor({ open: true, mode: { Kind: "edit", Step: step } })}
                onStepEditWait={(step) => setWaitDialog({ open: true, stepId: step.StepId, stepLabel: step.Label })}
                onStepDelete={(step) => setDeleteStepDialog({ open: true, step })}
            />
        </div>
    );
}

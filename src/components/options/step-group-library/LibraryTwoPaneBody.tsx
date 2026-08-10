/**
 * Marco Extension — Step Group Library two-pane body.
 *
 * Renders the tree pane + step pane grid. Extracted from
 * `StepGroupLibraryBody` per PlanTierType 24 SS-06 Phase 3 to keep each
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
import type { useLibrarySelection } from "./use-library-selection";
import type { useStepLibrary } from "@/hooks/use-step-library";
import type { StepGroupRow, StepRow } from "@/background/recorder/step-library/db";

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

function buildTreePaneProps(props: Props) {
    const { lib, state, viewModel, mutations, exportImport, selection } = props;
    const {
        selected, activeGroupId, hoveredId, setHoveredId,
        setCreateDialog, setRenameDialog, setDeleteDialog,
        setInputsDialog, setCsvDialog, setActiveGroupId,
    } = state;
    const { query, setQuery, trimmedQuery, tree, filteredTree, effectiveExpanded } = viewModel;
    const { handleMove, handleArchiveToggle, handleDropReorder } = mutations;
    const { handleExport, handleImportClick } = exportImport;
    const { toggleOne, toggleSubtree, toggleExpanded } = selection;

    return {
        tree,
        filteredTree,
        query,
        trimmedQuery,
        setQuery,
        selected,
        effectiveExpanded,
        activeGroupId,
        hoveredId,
        setHoveredId,
        toggleOne,
        toggleSubtree,
        toggleExpanded,
        setActiveGroupId,
        onCreateChild: (parentId: number | null) => setCreateDialog({ open: true, parent: parentId, name: "" }),
        onRename: (g: StepGroupRow) => setRenameDialog({ open: true, group: g, name: g.Name }),
        onDelete: (g: StepGroupRow) => setDeleteDialog({ open: true, group: g }),
        onExportOne: (id: number) => handleExport([id]),
        onMove: handleMove,
        onArchiveToggle: handleArchiveToggle,
        onApplyInputs: (g: StepGroupRow) => setInputsDialog({ open: true, group: g }),
        onImportCsvInputs: (g: StepGroupRow) => setCsvDialog({ open: true, group: g }),
        hasInputs: (gid: number) => lib.GroupInputs.has(gid),
        onDropReorder: handleDropReorder,
        onCreateRoot: () => setCreateDialog({ open: true, parent: null, name: "" }),
        onImportClick: handleImportClick,
    };
}

function buildStepPaneProps(props: Props) {
    const { lib, state, viewModel, mutations } = props;
    const {
        setInputsDialog, setCsvDialog, setStepEditor,
        setWaitDialog, setDeleteStepDialog, setRunGroupDialog, stepWaits,
    } = state;
    const { activeGroup, activeSteps } = viewModel;
    const { handleStepDropReorder, handleStepMove } = mutations;

    return {
        activeGroup,
        activeSteps,
        stepWaits,
        groupInputs: lib.GroupInputs,
        onOpenInputs: (g: StepGroupRow) => setInputsDialog({ open: true, group: g }),
        onOpenCsv: (g: StepGroupRow) => setCsvDialog({ open: true, group: g }),
        onCreateStep: (g: StepGroupRow) => setStepEditor({ open: true, mode: { Kind: "create", StepGroupId: g.StepGroupId } }),
        onRunGroup: (g: StepGroupRow) => setRunGroupDialog({ open: true, group: g }),
        onStepMove: handleStepMove,
        onStepDropReorder: handleStepDropReorder,
        onStepToggleDisabled: (step: StepRow, nextDisabled: boolean) => {
            lib.setStepDisabled(step.StepId, nextDisabled);
            toast.success(
                nextDisabled
                    ? `Step "${step.LabelType ?? step.StepId}" disabled, will be skipped on run`
                    : `Step "${step.LabelType ?? step.StepId}" enabled`,
            );
        },
        onStepEdit: (step: StepRow) => setStepEditor({ open: true, mode: { Kind: "edit", Step: step } }),
        onStepEditWait: (step: StepRow) => setWaitDialog({ open: true, stepId: step.StepId, stepLabel: step.LabelType }),
        onStepDelete: (step: StepRow) => setDeleteStepDialog({ open: true, step }),
    };
}

export function LibraryTwoPaneBody(props: Props) {
    return (
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
            <LibraryTreePane {...buildTreePaneProps(props)} />
            <LibraryStepPane {...buildStepPaneProps(props)} />
        </div>
    );
}

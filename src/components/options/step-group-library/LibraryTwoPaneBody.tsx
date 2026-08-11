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
  return (
    <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
      {renderTreePane(props)}
      {renderStepPane(props)}
    </div>
  );
}

function renderTreePane(props: Props) {
  const { lib, state, viewModel, mutations, exportImport, selection } = props;

  return (
    <LibraryTreePane
      tree={viewModel.tree}
      filteredTree={viewModel.filteredTree}
      query={viewModel.query}
      trimmedQuery={viewModel.trimmedQuery}
      setQuery={viewModel.setQuery}
      selected={state.selected}
      effectiveExpanded={viewModel.effectiveExpanded}
      activeGroupId={state.activeGroupId}
      hoveredId={state.hoveredId}
      setHoveredId={state.setHoveredId}
      toggleOne={selection.toggleOne}
      toggleSubtree={selection.toggleSubtree}
      toggleExpanded={selection.toggleExpanded}
      setActiveGroupId={state.setActiveGroupId}
      onCreateChild={(parentId) => state.setCreateDialog({ open: true, parent: parentId, name: "" })}
      onRename={(g) => state.setRenameDialog({ open: true, group: g, name: g.Name })}
      onDelete={(g) => state.setDeleteDialog({ open: true, group: g })}
      onExportOne={(id) => exportImport.handleExport([id])}
      onMove={mutations.handleMove}
      onArchiveToggle={mutations.handleArchiveToggle}
      onApplyInputs={(g) => state.setInputsDialog({ open: true, group: g })}
      onImportCsvInputs={(g) => state.setCsvDialog({ open: true, group: g })}
      hasInputs={(gid) => lib.GroupInputs.has(gid)}
      onDropReorder={mutations.handleDropReorder}
      onCreateRoot={() => state.setCreateDialog({ open: true, parent: null, name: "" })}
      onImportClick={exportImport.handleImportClick}
    />
  );
}

function renderStepPane(props: Props) {
  const { lib, state, viewModel, mutations } = props;

  return (
    <LibraryStepPane
      activeGroup={viewModel.activeGroup}
      activeSteps={viewModel.activeSteps}
      stepWaits={state.stepWaits}
      groupInputs={lib.GroupInputs}
      onOpenInputs={(g) => state.setInputsDialog({ open: true, group: g })}
      onOpenCsv={(g) => state.setCsvDialog({ open: true, group: g })}
      onCreateStep={(g) => state.setStepEditor({ open: true, mode: { Kind: "create", StepGroupId: g.StepGroupId } })}
      onRunGroup={(g) => state.setRunGroupDialog({ open: true, group: g })}
      onStepMove={mutations.handleStepMove}
      onStepDropReorder={mutations.handleStepDropReorder}
      onStepToggleDisabled={(step, nextDisabled) => {
        lib.setStepDisabled(step.StepId, nextDisabled);
        toast.success(
          nextDisabled
            ? `Step "${step.LabelType ?? step.StepId}" disabled, will be skipped on run`
            : `Step "${step.LabelType ?? step.StepId}" enabled`,
        );
      }}
      onStepEdit={(step) => state.setStepEditor({ open: true, mode: { Kind: "edit", Step: step } })}
      onStepEditWait={(step) => state.setWaitDialog({ open: true, stepId: step.StepId, stepLabel: step.LabelType })}
      onStepDelete={(step) => state.setDeleteStepDialog({ open: true, step })}
    />
  );
}

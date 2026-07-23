/**
 * Marco Extension, Step Group Library Panel.
 *
 * Two-pane Options surface for browsing recorder step groups. The
 * component itself is now a thin composition seam: it wires the
 * state / view-model / mutation / selection / export-import hooks
 * together and hands the resulting bags to `StepGroupLibraryBody`.
 * Loading + error early returns stay here so we can bail before
 * paying for the presentation hook wiring.
 *
 * See Plan 24 SS-06 Phase 2 for the extraction.
 *
 * @see src/hooks/use-step-library.ts
 * @see src/components/options/step-group-library/StepGroupLibraryBody.tsx
 */

import { useStepLibrary } from "@/hooks/use-step-library";
import type { StepGroupRow } from "@/background/recorder/step-library/db";
import { useStepGroupImport } from "@/hooks/use-step-group-import";

import StepLibraryErrorState from "./StepLibraryErrorState";
import { StepGroupLibraryBody } from "./step-group-library/StepGroupLibraryBody";
import {
    useLibraryPanelState,
    useLibraryStatePrune,
} from "./step-group-library/use-library-panel-state";
import { useLibrarySelection } from "./step-group-library/use-library-selection";
import { useStepGroupExportImport } from "./step-group-library/use-export-import";
import { useStepGroupLibraryViewModel } from "./step-group-library/use-view-model";
import { useStepGroupMutations } from "./step-group-library/use-step-group-mutations";

import type { TreeNode } from "./step-group-library/tree";

function buildTree(groups: ReadonlyArray<StepGroupRow>): TreeNode[] {
    const byParent = new Map<number | null, StepGroupRow[]>();
    for (const g of groups) {
        const key = g.ParentStepGroupId ?? null;
        const entries = byParent.get(key) ?? [];
        entries.push(g);
        byParent.set(key, entries);
    }
    const visit = (parentId: number | null): TreeNode[] => {
        const kids = byParent.get(parentId) ?? [];
        kids.sort((a, b) => a.OrderIndex - b.OrderIndex || a.Name.localeCompare(b.Name));
        return kids.map((g) => ({ Group: g, Children: visit(g.StepGroupId) }));
    };
    return visit(null);
}

export default function StepGroupLibraryPanel() {
    const lib = useStepLibrary();

    const state = useLibraryPanelState({ projectRow: lib.Project ?? null });
    const {
        setSelected, setSelectionOrder,
        activeGroupId, setActiveGroupId,
        expanded, setExpanded,
        showArchived,
        createDialog, setCreateDialog,
        renameDialog, setRenameDialog,
        deleteDialog, setDeleteDialog,
        stepEditor, setStepEditor,
        deleteStepDialog, setDeleteStepDialog,
        fileInputRef,
        pendingGroupOrder, setPendingGroupOrder,
        pendingStepOrder, setPendingStepOrder,
        selected,
    } = state;

    const importApi = useStepGroupImport({
        lib: { Lib: lib.Lib, Project: lib.Project, SqlJs: lib.SqlJs },
        onAfterImport: lib.refresh,
    });

    const viewModel = useStepGroupLibraryViewModel({
        lib,
        showArchived,
        pendingGroupOrder,
        setPendingGroupOrder,
        pendingStepOrder,
        setPendingStepOrder,
        expanded,
        activeGroupId,
        selected,
        buildTree,
    });

    useLibraryStatePrune({
        libProjectReady: lib.Project !== null,
        groupsById: viewModel.groupsById,
        activeGroupId, setActiveGroupId,
        expanded, setExpanded,
    });

    const selection = useLibrarySelection({ setSelected, setSelectionOrder, setExpanded });

    const mutations = useStepGroupMutations({
        lib,
        showArchived,
        activeGroupId,
        setActiveGroupId,
        setSelected,
        setSelectionOrder,
        setExpanded,
        createDialog, setCreateDialog,
        renameDialog, setRenameDialog,
        deleteDialog, setDeleteDialog,
        stepEditor, setStepEditor,
        deleteStepDialog, setDeleteStepDialog,
        setPendingGroupOrder,
        setPendingStepOrder,
    });

    const exportImport = useStepGroupExportImport({
        lib, selected, importApi, fileInputRef,
    });

    if (lib.Loading) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                Loading step library…
            </div>
        );
    }
    if (lib.LoadError !== null) {
        return (
            <StepLibraryErrorState
                error={lib.LoadError}
                onRetry={lib.retryLoad}
                onReset={lib.resetAll}
            />
        );
    }

    return (
        <StepGroupLibraryBody
            lib={lib}
            state={state}
            viewModel={viewModel}
            mutations={mutations}
            exportImport={exportImport}
            selection={selection}
            importApi={importApi}
        />
    );
}

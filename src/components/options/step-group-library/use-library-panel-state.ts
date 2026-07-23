/**
 * Marco Extension — Step Group Library panel state hook.
 *
 * Owns the local UI state for `StepGroupLibraryPanel`:
 *   - selection Set + insertion order
 *   - per-project persisted activeGroupId + expanded set
 *   - dialog visibility slots (create/rename/delete/inputs/csv/step editor,
 *     batch, webhook, input source, wait, run group)
 *   - hovered id
 *   - stepWaits snapshot + refresher
 *   - pending optimistic reorder overrides
 *
 * Extracted per Plan 24 SS-06 Phase 1 to keep the panel component under
 * the `max-lines-per-function` ESLint ceiling. Behaviour is unchanged.
 */

import { useEffect, useRef, useState } from "react";

import type { StepGroupRow } from "@/background/recorder/step-library/db";
import {
    decodeNullableNumber,
    decodeNumberSet,
    usePersistedState,
} from "@/hooks/use-persisted-state";
import { useRecorderSelection } from "@/hooks/use-recorder-selection";
import {
    readAllStepWaits,
    type WaitConfig,
} from "@/background/recorder/step-library/step-wait";

import type {
    CreateDialogState,
    RenameDialogState,
    GroupTargetDialogState,
    StepEditorDialogState,
    DeleteStepDialogState,
    WaitDialogState,
    RunGroupDialogState,
} from "./dialog-state";

interface UseLibraryPanelStateArgs {
    readonly projectRow: { readonly ProjectId: number | string } | null;
}

export function useLibraryPanelState(args: UseLibraryPanelStateArgs) {
    const projectKey = args.projectRow?.ProjectId ?? "__noproject__";

    // Selection ---------------------------------------------------------
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [selectionOrder, setSelectionOrder] = useState<ReadonlyArray<number>>([]);

    // Persisted per-project ---------------------------------------------
    const [activeGroupId, setActiveGroupId] = usePersistedState<number | null>(
        `marco.library.activeGroup.${projectKey}`,
        null,
        decodeNullableNumber,
    );
    const [expanded, setExpanded] = usePersistedState<Set<number>>(
        `marco.library.expanded.${projectKey}`,
        new Set(),
        decodeNumberSet,
    );

    // Bi-directional selection sync with in-page controller --------------
    const recorderSel = useRecorderSelection("options");
    useEffect(() => {
        recorderSel.select({ StepGroupId: activeGroupId, StepId: null });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeGroupId]);
    useEffect(() => {
        if (recorderSel.selection.StepGroupId === activeGroupId) return;
        setActiveGroupId(recorderSel.selection.StepGroupId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recorderSel.selection.StepGroupId]);

    // Toolbar toggles + top-level dialogs -------------------------------
    const [showArchived, setShowArchived] = useState(false);
    const [batchOpen, setBatchOpen] = useState(false);
    const [runGroupDialog, setRunGroupDialog] = useState<RunGroupDialogState>({
        open: false, group: null,
    });
    const [batchRenameOpen, setBatchRenameOpen] = useState(false);
    const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
    const [webhookOpen, setWebhookOpen] = useState(false);
    const [inputSourceOpen, setInputSourceOpen] = useState(false);
    const [waitDialog, setWaitDialog] = useState<WaitDialogState>({
        open: false, stepId: null, stepLabel: null,
    });

    // Step wait snapshot -------------------------------------------------
    const [stepWaits, setStepWaits] = useState<ReadonlyMap<number, WaitConfig>>(
        () => readAllStepWaits(),
    );
    const refreshStepWaits = () => setStepWaits(readAllStepWaits());

    // Hover + tree dialogs ----------------------------------------------
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const [createDialog, setCreateDialog] = useState<CreateDialogState>({
        open: false, parent: null, name: "",
    });
    const [renameDialog, setRenameDialog] = useState<RenameDialogState>({
        open: false, group: null, name: "",
    });
    const [deleteDialog, setDeleteDialog] = useState<GroupTargetDialogState>({
        open: false, group: null,
    });
    const [inputsDialog, setInputsDialog] = useState<GroupTargetDialogState>({
        open: false, group: null,
    });
    const [csvDialog, setCsvDialog] = useState<GroupTargetDialogState>({
        open: false, group: null,
    });
    const [stepEditor, setStepEditor] = useState<StepEditorDialogState>({
        open: false, mode: null,
    });
    const [deleteStepDialog, setDeleteStepDialog] = useState<DeleteStepDialogState>({
        open: false, step: null,
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Optimistic reorder overrides --------------------------------------
    const [pendingGroupOrder, setPendingGroupOrder] = useState<
        ReadonlyMap<number | "root", ReadonlyArray<number>>
    >(() => new Map());
    const [pendingStepOrder, setPendingStepOrder] = useState<
        ReadonlyMap<number, ReadonlyArray<number>>
    >(() => new Map());

    return {
        selected, setSelected,
        selectionOrder, setSelectionOrder,
        activeGroupId, setActiveGroupId,
        expanded, setExpanded,
        showArchived, setShowArchived,
        batchOpen, setBatchOpen,
        runGroupDialog, setRunGroupDialog,
        batchRenameOpen, setBatchRenameOpen,
        batchDeleteOpen, setBatchDeleteOpen,
        webhookOpen, setWebhookOpen,
        inputSourceOpen, setInputSourceOpen,
        waitDialog, setWaitDialog,
        stepWaits, refreshStepWaits,
        hoveredId, setHoveredId,
        createDialog, setCreateDialog,
        renameDialog, setRenameDialog,
        deleteDialog, setDeleteDialog,
        inputsDialog, setInputsDialog,
        csvDialog, setCsvDialog,
        stepEditor, setStepEditor,
        deleteStepDialog, setDeleteStepDialog,
        fileInputRef,
        pendingGroupOrder, setPendingGroupOrder,
        pendingStepOrder, setPendingStepOrder,
    };
}

/**
 * Prunes activeGroupId + expanded ids that no longer exist in the loaded
 * library. Runs whenever the library snapshot changes so cross-tab
 * deletions and import-with-replace clean up the persisted state.
 */
export function useLibraryStatePrune(deps: {
    readonly libProjectReady: boolean;
    readonly groupsById: ReadonlyMap<number, StepGroupRow>;
    readonly activeGroupId: number | null;
    readonly setActiveGroupId: (next: number | null) => void;
    readonly expanded: ReadonlySet<number>;
    readonly setExpanded: (next: Set<number>) => void;
}) {
    const {
        libProjectReady, groupsById,
        activeGroupId, setActiveGroupId,
        expanded, setExpanded,
    } = deps;
    useEffect(() => {
        if (!libProjectReady) return;
        if (activeGroupId !== null && !groupsById.has(activeGroupId)) {
            setActiveGroupId(null);
        }
        let needsPrune = false;
        for (const id of expanded) {
            if (!groupsById.has(id)) { needsPrune = true; break; }
        }
        if (needsPrune) {
            const next = new Set<number>();
            for (const id of expanded) {
                if (groupsById.has(id)) next.add(id);
            }
            setExpanded(next);
        }
    }, [libProjectReady, groupsById, activeGroupId, expanded, setActiveGroupId, setExpanded]);
}

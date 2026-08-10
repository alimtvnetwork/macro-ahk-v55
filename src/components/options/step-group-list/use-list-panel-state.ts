/**
 * Marco Extension, Step Group List Panel State Hook
 *
 * Owns the panel's selection/query/memos/export+import wiring so the
 * component function stays under the ESLint `max-lines-per-function`
 * threshold. Behaviour is preserved verbatim.
 *
 * v4.213.0 (PlanTierType-24 SS-04b Phase 9b): factored selection and view
 * derivations into `use-list-panel-selection.ts` and
 * `use-list-panel-view.ts` so this hook body sits under 50 lines.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { useStepLibrary } from "@/hooks/use-step-library";
import { decodeNullableNumber, usePersistedState } from "@/hooks/use-persisted-state";
import { useStepGroupExport } from "@/hooks/use-step-group-export";
import { useStepGroupImport } from "@/hooks/use-step-group-import";
import { buildDeletePreview } from "@/hooks/use-step-group-batch-actions";

import { useListPanelSelection } from "./use-list-panel-selection";
import { useListPanelView } from "./use-list-panel-view";

function useListPanelApis(lib: ReturnType<typeof useStepLibrary>) {
    const exportApi = useStepGroupExport({
        Lib: lib.Lib,
        Project: lib.Project,
        SqlJs: lib.SqlJs,
    });
    const importApi = useStepGroupImport({
        lib: { Lib: lib.Lib, Project: lib.Project, SqlJs: lib.SqlJs },
        onAfterImport: lib.refresh,
    });

    return { exportApi, importApi };
}

function useListPanelBatchState(selection: ReturnType<typeof useListPanelSelection>, lib: ReturnType<typeof useStepLibrary>, exportApi: ReturnType<typeof useStepGroupExport>) {
    const [batchRenameOpen, setBatchRenameOpen] = useState(false);
    const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
    
    const deletePreview = useMemo(
        () => buildDeletePreview(Array.from(selection.selected), lib.Groups, lib.StepsByGroup),
        [selection.selected, lib.Groups, lib.StepsByGroup],
    );

    const exportSelected = () => {
        exportApi.requestExport(Array.from(selection.selected), true);
    };

    return {
        batchRenameOpen,
        setBatchRenameOpen,
        batchDeleteOpen,
        setBatchDeleteOpen,
        deletePreview,
        exportSelected,
    };
}

function useListPanelCore(lib: ReturnType<typeof useStepLibrary>, activeGroupId: number | null, setActiveGroupId: (id: number | null) => void, query: string) {
    const view = useListPanelView({
        groups: lib.Groups,
        stepsByGroup: lib.StepsByGroup,
        groupInputs: lib.GroupInputs,
        activeGroupId,
        query,
    });

    useEffect(() => {
        if (lib.Project === null) return;
        if (activeGroupId !== null && !view.groupsById.has(activeGroupId)) {
            setActiveGroupId(null);
        }
    }, [lib.Project, view.groupsById, activeGroupId, setActiveGroupId]);

    return view;
}

function useListPanelInit() {
    const lib = useStepLibrary();
    const apis = useListPanelApis(lib);

    return { lib, ...apis };
}

export function useListPanelState() {
    const { lib, exportApi, importApi } = useListPanelInit();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [query, setQuery] = useState("");
    const projectKey = lib.Project?.ProjectId ?? "__noproject__";
    const [activeGroupId, setActiveGroupId] = usePersistedState<number | null>(`marco.list.activeGroup.${projectKey}`, null, decodeNullableNumber);
    const view = useListPanelCore(lib, activeGroupId, setActiveGroupId, query);
    const selection = useListPanelSelection(view.filtered, lib.Groups);
    const batchState = useListPanelBatchState(selection, lib, exportApi);

    return {
        lib, exportApi, importApi, fileInputRef, query, setQuery,
        activeGroupId, setActiveGroupId, ...view, ...selection, ...batchState,
        projectName: lib.Project?.Name ?? null, allGroups: lib.Groups, onToggleStep: lib.setStepDisabled,
    };
}

export type ListPanelState = ReturnType<typeof useListPanelState>;

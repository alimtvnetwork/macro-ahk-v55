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

function useListPanelApis() {
  const lib = useStepLibrary();
  const exportApi = useStepGroupExport({
    Lib: lib.Lib,
    Project: lib.Project,
    SqlJs: lib.SqlJs,
  });
  const importApi = useStepGroupImport({
    lib: { Lib: lib.Lib, Project: lib.Project, SqlJs: lib.SqlJs },
    onAfterImport: lib.refresh,
  });

  return { lib, exportApi, importApi };
}

function useBatchActionsState(
  selectedIds: ReadonlySet<number>,
  lib: ReturnType<typeof useStepLibrary>,
  exportApi: ReturnType<typeof useStepGroupExport>
) {
  const [batchRenameOpen, setBatchRenameOpen] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  const deletePreview = useMemo(
    () => buildDeletePreview(Array.from(selectedIds), lib.Groups, lib.StepsByGroup),
    [selectedIds, lib.Groups, lib.StepsByGroup],
  );

  const exportSelected = () => {
    exportApi.requestExport(Array.from(selectedIds), true);
  };

  return { batchRenameOpen, setBatchRenameOpen, batchDeleteOpen, setBatchDeleteOpen, deletePreview, exportSelected };
}

// eslint-disable-next-line max-lines-per-function
export function useListPanelState() {
  const { lib, exportApi, importApi } = useListPanelApis();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");

  const projectKey = lib.Project?.ProjectId ?? "__noproject__";
  const [activeGroupId, setActiveGroupId] = usePersistedState<number | null>(
    `marco.list.activeGroup.${projectKey}`,
    null,
    decodeNullableNumber,
  );

  const view = useListPanelView({
    groups: lib.Groups,
    stepsByGroup: lib.StepsByGroup,
    groupInputs: lib.GroupInputs,
    activeGroupId,
    query,
  });

  useEffect(() => {
    if (lib.Project === null) {
      return;
    }

    if (activeGroupId !== null && !view.groupsById.has(activeGroupId)) {
      setActiveGroupId(null);
    }
  }, [lib.Project, view.groupsById, activeGroupId, setActiveGroupId]);

  const selection = useListPanelSelection(view.filtered, lib.Groups);
  const batchState = useBatchActionsState(selection.selected, lib, exportApi);

  return {
    lib,
    exportApi,
    importApi,
    fileInputRef,
    query,
    setQuery,
    activeGroupId,
    setActiveGroupId,
    ...view,
    ...selection,
    ...batchState,
    projectName: lib.Project?.Name ?? null,
    allGroups: lib.Groups,
    onToggleStep: lib.setStepDisabled,
  };
}

export type ListPanelState = ReturnType<typeof useListPanelState>;

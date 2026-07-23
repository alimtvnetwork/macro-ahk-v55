/**
 * Marco Extension, ListPanel: selection sub-hook.
 *
 * Owns the multi-select set + visible-ids derivation so the top-level
 * `useListPanelState` stays under `max-lines-per-function`.
 */

import { useMemo, useState } from "react";

import type { StepGroupRow } from "@/background/recorder/step-library/db";

export function useListPanelSelection(
    filtered: ReadonlyArray<StepGroupRow>,
    allGroups: ReadonlyArray<StepGroupRow>,
) {
    const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());

    const visibleIds = useMemo(
        () => filtered.map((g) => g.StepGroupId),
        [filtered],
    );
    const allVisibleSelected =
        visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
    const someVisibleSelected =
        !allVisibleSelected && visibleIds.some((id) => selected.has(id));

    const toggleOne = (id: number, on: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (on) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const toggleAllVisible = (on: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (on) for (const id of visibleIds) next.add(id);
            else for (const id of visibleIds) next.delete(id);
            return next;
        });
    };

    const clearSelection = () => setSelected(new Set());

    const selectedGroups = useMemo(
        () => allGroups.filter((g) => selected.has(g.StepGroupId)),
        [allGroups, selected],
    );

    return {
        selected,
        setSelected,
        visibleIds,
        allVisibleSelected,
        someVisibleSelected,
        toggleOne,
        toggleAllVisible,
        clearSelection,
        selectedGroups,
    };
}

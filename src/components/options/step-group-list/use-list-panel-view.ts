/**
 * Marco Extension, ListPanel: derived-view sub-hook.
 *
 * Owns sorted+filtered lists, active-group memos, and the small
 * predicates the panel exposes via `state`.
 */

import { useMemo } from "react";

import type { StepGroupRow, StepRow } from "@/background/recorder/step-library/db";

function matchesQuery(group: StepGroupRow, query: string): boolean {
    if (query === "") return true;
    const q = query.toLowerCase();
    if (group.Name.toLowerCase().includes(q)) return true;
    const desc = group.Description ?? "";
    if (desc !== "" && desc.toLowerCase().includes(q)) return true;
    return false;
}

interface UseListPanelViewArgs {
    readonly groups: ReadonlyArray<StepGroupRow>;
    readonly stepsByGroup: ReadonlyMap<number, ReadonlyArray<StepRow>>;
    readonly groupInputs: ReadonlyMap<number, unknown>;
    readonly activeGroupId: number | null;
    readonly query: string;
}

export function useListPanelView({
    groups,
    stepsByGroup,
    groupInputs,
    activeGroupId,
    query,
}: UseListPanelViewArgs) {
    const groupsById = useMemo(() => {
        const m = new Map<number, StepGroupRow>();
        for (const g of groups) m.set(g.StepGroupId, g);
        return m;
    }, [groups]);

    const sortedGroups = useMemo(
        () => groups.slice().sort((a, b) => a.Name.localeCompare(b.Name)),
        [groups],
    );

    const filtered = useMemo(
        () => sortedGroups.filter((g) => matchesQuery(g, query.trim())),
        [sortedGroups, query],
    );

    const activeGroup = useMemo(
        () => (activeGroupId === null ? null : (groupsById.get(activeGroupId) ?? null)),
        [activeGroupId, groupsById],
    );
    const activeSteps: ReadonlyArray<StepRow> =
        activeGroupId === null ? [] : (stepsByGroup.get(activeGroupId) ?? []);

    const hasBoundInputs =
        activeGroup !== null && groupInputs.has(activeGroup.StepGroupId);
    const stepCountFor = (id: number): number =>
        stepsByGroup.get(id)?.length ?? 0;

    return {
        groupsById,
        filtered,
        activeGroup,
        activeSteps,
        hasBoundInputs,
        stepCountFor,
    };
}

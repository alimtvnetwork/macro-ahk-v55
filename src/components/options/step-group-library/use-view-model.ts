/**
 * Marco Extension, Step Group Library, View-Model Hook
 *
 * Owns the pure/derived state of `StepGroupLibraryPanel`: filtered
 * tree, ordered groups with optimistic overrides, active group +
 * steps, effective expanded set, groupsById lookup, selected groups,
 * and delete preview. Also owns the "settle-and-clear" effects that
 * drop pending reorder overrides once the loaded snapshot matches.
 *
 * Extracted per PlanTierType 24 / SS-04a Phase 5 to shrink the panel body
 * below the ESLint `max-lines-per-function` limit. No behaviour
 * change: every memo/effect and its dependency list is a verbatim
 * lift from the panel.
 *
 * @see StepGroupLibraryPanel.tsx
 */

import { useEffect, useMemo, useState } from "react";

import type { StepGroupRow, StepRow } from "@/background/recorder/step-library/db";
import { buildDeletePreview } from "@/hooks/use-step-group-batch-actions";
import type { useStepLibrary } from "@/hooks/use-step-library";

import type { TreeNode } from "./tree";

type StepLibrary = ReturnType<typeof useStepLibrary>;

interface UseStepGroupLibraryViewModelParams {
    readonly lib: StepLibrary;
    readonly showArchived: boolean;
    readonly pendingGroupOrder: ReadonlyMap<number | "root", ReadonlyArray<number>>;
    readonly setPendingGroupOrder: (next: ReadonlyMap<number | "root", ReadonlyArray<number>>) => void;
    readonly pendingStepOrder: ReadonlyMap<number, ReadonlyArray<number>>;
    readonly setPendingStepOrder: (next: ReadonlyMap<number, ReadonlyArray<number>>) => void;
    readonly expanded: ReadonlySet<number>;
    readonly activeGroupId: number | null;
    readonly selected: ReadonlySet<number>;
    readonly buildTree: (groups: ReadonlyArray<StepGroupRow>) => TreeNode[];
}

export interface StepGroupLibraryViewModel {
    readonly query: string;
    readonly setQuery: (next: string) => void;
    readonly trimmedQuery: string;
    readonly tree: TreeNode[];
    readonly filteredTree: TreeNode[];
    readonly effectiveExpanded: ReadonlySet<number>;
    readonly activeGroup: StepGroupRow | null;
    readonly activeSteps: ReadonlyArray<StepRow>;
    readonly groupsById: ReadonlyMap<number, StepGroupRow>;
    readonly selectedGroups: ReadonlyArray<StepGroupRow>;
    readonly deletePreview: ReturnType<typeof buildDeletePreview>;
}

function useGroupOrdering(lib: StepLibrary, showArchived: boolean, pendingGroupOrder: ReadonlyMap<number | "root", ReadonlyArray<number>>) {
    const visibleGroups = useMemo(() => (showArchived ? lib.Groups : lib.Groups.filter((g) => !g.IsArchived)), [lib.Groups, showArchived]);
    const orderedGroups = useMemo(() => {
        if (pendingGroupOrder.size === 0) return visibleGroups;
        const pos = new Map<number | "root", Map<number, number>>();
        for (const [pk, ids] of pendingGroupOrder) {
            const m = new Map<number, number>();
            ids.forEach((id, i) => m.set(id, i));
            pos.set(pk, m);
        }

        return [...visibleGroups].sort((a, b) => {
            const aK = (a.ParentStepGroupId ?? "root") as number | "root", bK = (b.ParentStepGroupId ?? "root") as number | "root";
            if (aK !== bK) return 0;
            const pm = pos.get(aK);
            if (!pm) return 0;
            const ai = pm.get(a.StepGroupId), bi = pm.get(b.StepGroupId);
            if (ai === undefined || bi === undefined) return 0;

            return ai - bi;
        });
    }, [visibleGroups, pendingGroupOrder]);

    return { orderedGroups };
}

function useSettleGroupOrder(lib: StepLibrary, pendingGroupOrder: ReadonlyMap<number | "root", ReadonlyArray<number>>, setPendingGroupOrder: (next: ReadonlyMap<number | "root", ReadonlyArray<number>>) => void) {
    useEffect(() => {
        if (pendingGroupOrder.size === 0) return;
        let settled = true;
        for (const [pk, ids] of pendingGroupOrder) {
            const parentId = pk === "root" ? null : pk;
            const act = lib.Groups.filter((g) => (g.ParentStepGroupId ?? null) === parentId).sort((a, b) => a.OrderIndex - b.OrderIndex || a.Name.localeCompare(b.Name)).map((g) => g.StepGroupId);
            if (act.length !== ids.length || act.some((id, i) => id !== ids[i])) { settled = false; break; }
        }
        if (settled) setPendingGroupOrder(new Map());
    }, [lib.Groups, pendingGroupOrder, setPendingGroupOrder]);
}

function useTreeFilter(tree: TreeNode[]) {
    const [query, setQuery] = useState("");
    const trimmedQuery = query.trim().toLowerCase();
    const { filteredTree, autoExpand } = useMemo(() => {
        if (trimmedQuery === "") return { filteredTree: tree, autoExpand: null as Set<number> | null };
        const expandIds = new Set<number>();
        const filterNodes = (nodes: ReadonlyArray<TreeNode>): TreeNode[] => {
            const out: TreeNode[] = [];
            for (const n of nodes) {
                const selfMatch = n.Group.Name.toLowerCase().includes(trimmedQuery);
                const kids = filterNodes(n.Children);
                if (selfMatch || kids.length > 0) {
                    if (kids.length > 0) expandIds.add(n.Group.StepGroupId);
                    out.push({ Group: n.Group, Children: kids });
                }
            }

            return out;
        };

        return { filteredTree: filterNodes(tree), autoExpand: expandIds };
    }, [tree, trimmedQuery]);

    return { query, setQuery, trimmedQuery, filteredTree, autoExpand };
}

function useActiveStepOrder(lib: StepLibrary, activeGroupId: number | null, pendingStepOrder: ReadonlyMap<number, ReadonlyArray<number>>) {
    const activeGroup = useMemo(() => lib.Groups.find((g) => g.StepGroupId === activeGroupId) ?? null, [lib.Groups, activeGroupId]);
    const activeSteps: ReadonlyArray<StepRow> = useMemo(() => {
        if (activeGroupId === null) return [];
        const loaded = lib.StepsByGroup.get(activeGroupId) ?? [], override = pendingStepOrder.get(activeGroupId);
        if (override === undefined) return loaded;
        const byId = new Map(loaded.map((s) => [s.StepId, s] as const)), out: StepRow[] = [];
        for (const id of override) {
            const row = byId.get(id);
            if (row !== undefined) { out.push(row); byId.delete(id); }
        }
        for (const r of byId.values()) out.push(r);

        return out;
    }, [activeGroupId, lib.StepsByGroup, pendingStepOrder]);

    return { activeGroup, activeSteps };
}

function useSettleStepOrder(lib: StepLibrary, pendingStepOrder: ReadonlyMap<number, ReadonlyArray<number>>, setPendingStepOrder: (next: ReadonlyMap<number, ReadonlyArray<number>>) => void) {
    useEffect(() => {
        if (pendingStepOrder.size === 0) return;
        let settled = true;
        for (const [gid, ids] of pendingStepOrder) {
            const act = (lib.StepsByGroup.get(gid) ?? []).map((s) => s.StepId);
            if (act.length !== ids.length || act.some((id, i) => id !== ids[i])) { settled = false; break; }
        }
        if (settled) setPendingStepOrder(new Map());
    }, [lib.StepsByGroup, pendingStepOrder, setPendingStepOrder]);
}

function useDerivedState(expanded: ReadonlySet<number>, autoExpand: Set<number> | null, lib: StepLibrary, selected: ReadonlySet<number>) {
    const effectiveExpanded = useMemo(() => {
        if (autoExpand === null) return expanded;
        const merged = new Set(expanded);
        for (const id of autoExpand) merged.add(id);
        return merged;
    }, [expanded, autoExpand]);

    const groupsById = useMemo(() => {
        const m = new Map<number, StepGroupRow>();
        for (const g of lib.Groups) m.set(g.StepGroupId, g);
        return m;
    }, [lib.Groups]);

    const selectedGroups = useMemo(() => lib.Groups.filter((g) => selected.has(g.StepGroupId)), [lib.Groups, selected]);
    const deletePreview = useMemo(() => buildDeletePreview(Array.from(selected), lib.Groups, lib.StepsByGroup), [selected, lib.Groups, lib.StepsByGroup]);

    return { effectiveExpanded, groupsById, selectedGroups, deletePreview };
}

export function useStepGroupLibraryViewModel(params: UseStepGroupLibraryViewModelParams): StepGroupLibraryViewModel {
    const { lib, showArchived, pendingGroupOrder, setPendingGroupOrder, pendingStepOrder, setPendingStepOrder, expanded, activeGroupId, selected, buildTree } = params;

    const { orderedGroups } = useGroupOrdering(lib, showArchived, pendingGroupOrder);
    useSettleGroupOrder(lib, pendingGroupOrder, setPendingGroupOrder);

    const tree = useMemo(() => buildTree(orderedGroups), [orderedGroups, buildTree]);
    const { query, setQuery, trimmedQuery, filteredTree, autoExpand } = useTreeFilter(tree);

    const { activeGroup, activeSteps } = useActiveStepOrder(lib, activeGroupId, pendingStepOrder);
    useSettleStepOrder(lib, pendingStepOrder, setPendingStepOrder);

    const derived = useDerivedState(expanded, autoExpand, lib, selected);

    return {
        query, setQuery, trimmedQuery, tree, filteredTree,
        activeGroup, activeSteps, ...derived,
    };
}

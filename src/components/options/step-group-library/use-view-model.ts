/**
 * Marco Extension, Step Group Library, View-Model Hook
 *
 * Owns the pure/derived state of `StepGroupLibraryPanel`: filtered
 * tree, ordered groups with optimistic overrides, active group +
 * steps, effective expanded set, groupsById lookup, selected groups,
 * and delete preview. Also owns the "settle-and-clear" effects that
 * drop pending reorder overrides once the loaded snapshot matches.
 *
 * Extracted per Plan 24 / SS-04a Phase 5 to shrink the panel body
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
    readonly setPendingGroupOrder: (
        next: ReadonlyMap<number | "root", ReadonlyArray<number>>,
    ) => void;
    readonly pendingStepOrder: ReadonlyMap<number, ReadonlyArray<number>>;
    readonly setPendingStepOrder: (
        next: ReadonlyMap<number, ReadonlyArray<number>>,
    ) => void;
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

export function useStepGroupLibraryViewModel(
    params: UseStepGroupLibraryViewModelParams,
): StepGroupLibraryViewModel {
    const {
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
    } = params;

    const visibleGroups = useMemo(
        () => (showArchived ? lib.Groups : lib.Groups.filter((g) => !g.IsArchived)),
        [lib.Groups, showArchived],
    );

    const orderedGroups = useMemo(() => {
        if (pendingGroupOrder.size === 0) return visibleGroups;
        const positionByParent = new Map<number | "root", Map<number, number>>();
        for (const [parentKey, ids] of pendingGroupOrder) {
            const m = new Map<number, number>();
            ids.forEach((id, i) => m.set(id, i));
            positionByParent.set(parentKey, m);
        }
        return [...visibleGroups].sort((a, b) => {
            const aKey = (a.ParentStepGroupId ?? "root") as number | "root";
            const bKey = (b.ParentStepGroupId ?? "root") as number | "root";
            if (aKey !== bKey) return 0;
            const positions = positionByParent.get(aKey);
            if (positions === undefined) return 0;
            const ai = positions.get(a.StepGroupId);
            const bi = positions.get(b.StepGroupId);
            if (ai === undefined || bi === undefined) return 0;
            return ai - bi;
        });
    }, [visibleGroups, pendingGroupOrder]);

    const tree = useMemo(() => buildTree(orderedGroups), [orderedGroups, buildTree]);

    useEffect(() => {
        if (pendingGroupOrder.size === 0) return;
        let allSettled = true;
        for (const [parentKey, ids] of pendingGroupOrder) {
            const parentId = parentKey === "root" ? null : parentKey;
            const actual = lib.Groups
                .filter((g) => (g.ParentStepGroupId ?? null) === parentId)
                .sort((a, b) => a.OrderIndex - b.OrderIndex || a.Name.localeCompare(b.Name))
                .map((g) => g.StepGroupId);
            if (actual.length !== ids.length || actual.some((id, i) => id !== ids[i])) {
                allSettled = false;
                break;
            }
        }
        if (allSettled) setPendingGroupOrder(new Map());
    }, [lib.Groups, pendingGroupOrder, setPendingGroupOrder]);

    const [query, setQuery] = useState("");
    const trimmedQuery = query.trim().toLowerCase();
    const { filteredTree, autoExpand } = useMemo(() => {
        if (trimmedQuery === "") {
            return { filteredTree: tree, autoExpand: null as Set<number> | null };
        }
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
        const filtered = filterNodes(tree);
        return { filteredTree: filtered, autoExpand: expandIds };
    }, [tree, trimmedQuery]);

    const effectiveExpanded = useMemo(() => {
        if (autoExpand === null) return expanded;
        const merged = new Set(expanded);
        for (const id of autoExpand) merged.add(id);
        return merged;
    }, [expanded, autoExpand]);

    const activeGroup = useMemo(
        () => lib.Groups.find((g) => g.StepGroupId === activeGroupId) ?? null,
        [lib.Groups, activeGroupId],
    );

    const activeSteps: ReadonlyArray<StepRow> = useMemo(() => {
        if (activeGroupId === null) return [];
        const loaded = lib.StepsByGroup.get(activeGroupId) ?? [];
        const override = pendingStepOrder.get(activeGroupId);
        if (override === undefined) return loaded;
        const byId = new Map(loaded.map((s) => [s.StepId, s] as const));
        const out: StepRow[] = [];
        for (const id of override) {
            const row = byId.get(id);
            if (row !== undefined) {
                out.push(row);
                byId.delete(id);
            }
        }
        for (const remaining of byId.values()) out.push(remaining);
        return out;
    }, [activeGroupId, lib.StepsByGroup, pendingStepOrder]);

    useEffect(() => {
        if (pendingStepOrder.size === 0) return;
        let allSettled = true;
        for (const [gid, ids] of pendingStepOrder) {
            const actual = (lib.StepsByGroup.get(gid) ?? []).map((s) => s.StepId);
            if (actual.length !== ids.length || actual.some((id, i) => id !== ids[i])) {
                allSettled = false;
                break;
            }
        }
        if (allSettled) setPendingStepOrder(new Map());
    }, [lib.StepsByGroup, pendingStepOrder, setPendingStepOrder]);

    const groupsById = useMemo(() => {
        const m = new Map<number, StepGroupRow>();
        for (const g of lib.Groups) m.set(g.StepGroupId, g);
        return m;
    }, [lib.Groups]);

    const selectedGroups = useMemo(
        () => lib.Groups.filter((g) => selected.has(g.StepGroupId)),
        [lib.Groups, selected],
    );

    const deletePreview = useMemo(
        () => buildDeletePreview(Array.from(selected), lib.Groups, lib.StepsByGroup),
        [selected, lib.Groups, lib.StepsByGroup],
    );

    return {
        query,
        setQuery,
        trimmedQuery,
        tree,
        filteredTree,
        effectiveExpanded,
        activeGroup,
        activeSteps,
        groupsById,
        selectedGroups,
        deletePreview,
    };
}

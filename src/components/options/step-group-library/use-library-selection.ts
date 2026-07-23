/**
 * Marco Extension — Step Group Library selection helpers.
 *
 * Small hook that packages the selection add/remove pattern used by the
 * tree checkboxes (single id + subtree) plus the "toggle folder
 * expanded" and "clear all" primitives. Extracted per Plan 24 SS-06
 * Phase 2 so the panel body stays under the ESLint
 * `max-lines-per-function` ceiling.
 */

import type { TreeNode } from "./tree";

interface UseLibrarySelectionArgs {
    readonly setSelected: (updater: (prev: Set<number>) => Set<number>) => void;
    readonly setSelectionOrder: (
        updater: (prev: ReadonlyArray<number>) => ReadonlyArray<number>,
    ) => void;
    readonly setExpanded: (updater: (prev: Set<number>) => Set<number>) => void;
}

function collectDescendantIds(node: TreeNode, out: Set<number>): void {
    out.add(node.Group.StepGroupId);
    for (const c of node.Children) collectDescendantIds(c, out);
}

export function useLibrarySelection(args: UseLibrarySelectionArgs) {
    const { setSelected, setSelectionOrder, setExpanded } = args;

    const applySelection = (on: boolean, ids: ReadonlyArray<number>) => {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const id of ids) {
                if (on) next.add(id); else next.delete(id);
            }
            return next;
        });
        setSelectionOrder((prev) => {
            if (!on) return prev.filter((id) => !ids.includes(id));
            const seen = new Set(prev);
            const additions = ids.filter((id) => !seen.has(id));
            return additions.length === 0 ? prev : [...prev, ...additions];
        });
    };

    const toggleOne = (id: number, on: boolean) => {
        applySelection(on, [id]);
    };

    const toggleSubtree = (node: TreeNode, on: boolean) => {
        const ids = new Set<number>();
        collectDescendantIds(node, ids);
        applySelection(on, Array.from(ids));
    };

    const clearSelection = () => {
        setSelected(() => new Set<number>());
        setSelectionOrder(() => []);
    };

    const toggleExpanded = (id: number) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    return { toggleOne, toggleSubtree, clearSelection, toggleExpanded };
}

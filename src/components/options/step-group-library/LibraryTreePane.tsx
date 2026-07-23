/**
 * LibraryTreePane — left pane of `StepGroupLibraryPanel`.
 *
 * Presentational-only wrapper around the search box, empty-state,
 * no-matches state and the `TreeNodeRow` list. Extracted from
 * `StepGroupLibraryPanel.tsx` (previously lines 1017-1108) so the
 * panel render function drops under the 50-line ceiling from
 * `.lovable/coding-guidelines.md` Rule 1.
 *
 * Owns no state: every callback and derived list is threaded in from
 * the panel so unit tests keep hitting the same reducers.
 */

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { StepGroupRow } from "@/background/recorder/step-library/db";
import { EmptyTreeState } from "./EmptyTreeState";
import { TreeNodeRow } from "./TreeNodeRow";
import type { TreeNode } from "./tree";

interface LibraryTreePaneProps {
    readonly tree: ReadonlyArray<TreeNode>;
    readonly filteredTree: ReadonlyArray<TreeNode>;
    readonly query: string;
    readonly trimmedQuery: string;
    readonly setQuery: (next: string) => void;
    readonly selected: ReadonlySet<number>;
    readonly effectiveExpanded: ReadonlySet<number>;
    readonly activeGroupId: number | null;
    readonly hoveredId: number | null;
    readonly setHoveredId: (id: number | null) => void;
    readonly toggleOne: (id: number, on: boolean) => void;
    readonly toggleSubtree: (node: TreeNode, on: boolean) => void;
    readonly toggleExpanded: (id: number) => void;
    readonly setActiveGroupId: (id: number | null) => void;
    readonly onCreateChild: (parentId: number) => void;
    readonly onRename: (group: StepGroupRow) => void;
    readonly onDelete: (group: StepGroupRow) => void;
    readonly onExportOne: (id: number) => void;
    readonly onMove: (id: number, direction: "up" | "down") => void;
    readonly onArchiveToggle: (group: StepGroupRow) => void;
    readonly onApplyInputs: (group: StepGroupRow) => void;
    readonly onImportCsvInputs: (group: StepGroupRow) => void;
    readonly hasInputs: (gid: number) => boolean;
    readonly onDropReorder: (parentId: number | null, sourceId: number, targetId: number) => void;
    readonly onCreateRoot: () => void;
    readonly onImportClick: () => void;
}

function TreePaneHeader({ trimmedQuery, filteredCount, query }: {
    readonly trimmedQuery: string;
    readonly filteredCount: number;
    readonly query: string;
}) {
    return (
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-sm font-medium text-muted-foreground">
            <span>Groups</span>
            {trimmedQuery !== "" && (
                <span className="text-xs font-normal">
                    {filteredCount === 0 ? "No matches" : `Filtered by \u201C${query.trim()}\u201D`}
                </span>
            )}
        </div>
    );
}

function TreeSearchBox({ query, setQuery }: {
    readonly query: string;
    readonly setQuery: (next: string) => void;
}) {
    return (
        <div className="border-b px-3 py-2">
            <div className="relative">
                <Search
                    className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input
                    value={query}
                    onChange={(evt) => setQuery(evt.target.value)}
                    placeholder="Search groups by name\u2026"
                    aria-label="Search step groups"
                    className="h-8 pl-7 pr-7 text-sm"
                />
                {query !== "" && (
                    <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                        className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}

function NoMatchesState({ query, onClear }: {
    readonly query: string;
    readonly onClear: () => void;
}) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
            <Search className="h-8 w-8 text-muted-foreground/40" />
            <p>No groups match \u201C{query.trim()}\u201D.</p>
            <Button variant="ghost" size="sm" onClick={onClear}>Clear search</Button>
        </div>
    );
}

function TreeList(props: LibraryTreePaneProps) {
    return (
        <ul className="py-2">
            {props.filteredTree.map((node, idx) => (
                <TreeNodeRow
                    key={node.Group.StepGroupId}
                    node={node}
                    depth={0}
                    siblingIndex={idx}
                    siblingCount={props.filteredTree.length}
                    selected={props.selected}
                    expanded={props.effectiveExpanded}
                    activeGroupId={props.activeGroupId}
                    hoveredId={props.hoveredId}
                    onHover={props.setHoveredId}
                    onToggleSelect={props.toggleOne}
                    onToggleSubtree={props.toggleSubtree}
                    onToggleExpanded={props.toggleExpanded}
                    onActivate={props.setActiveGroupId}
                    onCreateChild={props.onCreateChild}
                    onRename={props.onRename}
                    onDelete={props.onDelete}
                    onExportThis={props.onExportOne}
                    onMove={props.onMove}
                    onArchiveToggle={props.onArchiveToggle}
                    onApplyInputs={props.onApplyInputs}
                    onImportCsvInputs={props.onImportCsvInputs}
                    hasInputs={props.hasInputs}
                    onDropReorder={props.onDropReorder}
                />
            ))}
        </ul>
    );
}

function TreePaneBody(props: LibraryTreePaneProps) {
    if (props.tree.length === 0) {
        return <EmptyTreeState onCreate={props.onCreateRoot} onImport={props.onImportClick} />;
    }
    if (props.filteredTree.length === 0) {
        return <NoMatchesState query={props.query} onClear={() => props.setQuery("")} />;
    }
    return <TreeList {...props} />;
}

export function LibraryTreePane(props: LibraryTreePaneProps) {
    return (
        <Card className="flex min-h-[400px] flex-col overflow-hidden">
            <TreePaneHeader
                trimmedQuery={props.trimmedQuery}
                filteredCount={props.filteredTree.length}
                query={props.query}
            />
            <TreeSearchBox query={props.query} setQuery={props.setQuery} />
            <ScrollArea className="flex-1">
                <TreePaneBody {...props} />
            </ScrollArea>
        </Card>
    );
}

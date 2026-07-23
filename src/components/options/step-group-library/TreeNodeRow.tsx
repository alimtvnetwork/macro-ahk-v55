/**
 * TreeNodeRow — a single row in the tree pane of the Step Group Library.
 *
 * Extracted from `StepGroupLibraryPanel.tsx` (Plan 24, Step 3) and split
 * into small helpers (drag-handlers hook, move arrows, actions menu,
 * label body) so each function fits inside the 50-line ceiling enforced
 * by `max-lines-per-function`. Behaviour is unchanged.
 */

import { useState } from "react";
import type { JSX } from "react";
import {
    Archive,
    ArchiveRestore,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    ChevronDown as ChevronDownIcon,
    Download,
    FileJson,
    FileSpreadsheet,
    GripVertical,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { StepGroupRow } from "@/background/recorder/step-library/db";

import { logError } from "../options-logger";
import { DRAG_MIME } from "./constants";

export interface TreeNode {
    readonly Group: StepGroupRow;
    readonly Children: TreeNode[];
}

export interface TreeNodeRowProps {
    readonly node: TreeNode;
    readonly depth: number;
    readonly siblingIndex: number;
    readonly siblingCount: number;
    readonly selected: ReadonlySet<number>;
    readonly expanded: ReadonlySet<number>;
    readonly activeGroupId: number | null;
    readonly hoveredId: number | null;
    readonly onHover: (id: number | null) => void;
    readonly onToggleSelect: (id: number, on: boolean) => void;
    readonly onToggleSubtree: (node: TreeNode, on: boolean) => void;
    readonly onToggleExpanded: (id: number) => void;
    readonly onActivate: (id: number) => void;
    readonly onCreateChild: (parentId: number) => void;
    readonly onRename: (group: StepGroupRow) => void;
    readonly onDelete: (group: StepGroupRow) => void;
    readonly onExportThis: (id: number) => void;
    readonly onMove: (id: number, direction: "up" | "down") => void;
    readonly onArchiveToggle: (group: StepGroupRow) => void;
    readonly onApplyInputs: (group: StepGroupRow) => void;
    readonly onImportCsvInputs: (group: StepGroupRow) => void;
    readonly hasInputs: (id: number) => boolean;
    readonly onDropReorder: (parentId: number | null, sourceId: number, targetId: number) => void;
}

interface RowDragState {
    readonly dragOver: boolean;
    readonly onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
    readonly onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    readonly onDragLeave: () => void;
    readonly onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
}

function useTreeNodeDrag(
    id: number,
    parentId: number | null,
    onDropReorder: TreeNodeRowProps["onDropReorder"],
): RowDragState {
    const [dragOver, setDragOver] = useState(false);
    const onDragStart = (event: React.DragEvent<HTMLDivElement>): void => {
        // Encode source id + parent so the drop target can validate
        // sibling-only reorder without poking React state.
        event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ id, parentId }));
        event.dataTransfer.effectAllowed = "move";
    };
    const onDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
        const types = Array.from(event.dataTransfer.types);
        if (!types.includes(DRAG_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (!dragOver) setDragOver(true);
    };
    const onDragLeave = (): void => { if (dragOver) setDragOver(false); };
    const onDrop = (event: React.DragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        setDragOver(false);
        const raw = event.dataTransfer.getData(DRAG_MIME);
        if (raw === "") return;
        try {
            const payload = JSON.parse(raw) as { id: number; parentId: number | null };
            // Cross-parent drag: ignored intentionally.
            if (payload.parentId !== parentId) return;
            if (payload.id === id) return;
            onDropReorder(parentId, payload.id, id);
        } catch (caught) {
            logError(
                "StepGroupLibraryPanel.handleDropReorder.group",
                "Malformed drag payload — DataTransfer JSON.parse failed",
                caught,
            );
        }
    };
    return { dragOver, onDragStart, onDragOver, onDragLeave, onDrop };
}

function TreeNodeMoveArrows(props: {
    readonly id: number;
    readonly name: string;
    readonly isFirst: boolean;
    readonly isLast: boolean;
    readonly onMove: TreeNodeRowProps["onMove"];
}): JSX.Element {
    const { id, name, isFirst, isLast, onMove } = props;
    return (
        <div className="flex items-center opacity-0 group-hover:opacity-100">
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={isFirst}
                onClick={() => onMove(id, "up")} aria-label={`Move ${name} up`}
            ><ChevronUp className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={isLast}
                onClick={() => onMove(id, "down")} aria-label={`Move ${name} down`}
            ><ChevronDownIcon className="h-3.5 w-3.5" /></Button>
        </div>
    );
}

interface ActionsMenuProps {
    readonly node: TreeNode;
    readonly id: number;
    readonly isFirst: boolean;
    readonly isLast: boolean;
    readonly isArchived: boolean;
    readonly hasInputs: TreeNodeRowProps["hasInputs"];
    readonly onCreateChild: TreeNodeRowProps["onCreateChild"];
    readonly onRename: TreeNodeRowProps["onRename"];
    readonly onMove: TreeNodeRowProps["onMove"];
    readonly onToggleSubtree: TreeNodeRowProps["onToggleSubtree"];
    readonly onExportThis: TreeNodeRowProps["onExportThis"];
    readonly onApplyInputs: TreeNodeRowProps["onApplyInputs"];
    readonly onImportCsvInputs: TreeNodeRowProps["onImportCsvInputs"];
    readonly onArchiveToggle: TreeNodeRowProps["onArchiveToggle"];
    readonly onDelete: TreeNodeRowProps["onDelete"];
}

function ActionsMenuStructureItems(props: ActionsMenuProps): JSX.Element {
    const { node, id, isFirst, isLast } = props;
    return (
        <>
            <DropdownMenuItem onSelect={() => props.onCreateChild(id)}>
                <Plus className="mr-2 h-4 w-4" /> New child group
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onRename(node.Group)}>
                <Pencil className="mr-2 h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => props.onMove(id, "up")} disabled={isFirst}>
                <ChevronUp className="mr-2 h-4 w-4" /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onMove(id, "down")} disabled={isLast}>
                <ChevronDownIcon className="mr-2 h-4 w-4" /> Move down
            </DropdownMenuItem>
        </>
    );
}

function ActionsMenuDataItems(props: ActionsMenuProps): JSX.Element {
    const { node, id, hasInputs } = props;
    return (
        <>
            <DropdownMenuItem onSelect={() => props.onToggleSubtree(node, true)}>
                Select with descendants
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onToggleSubtree(node, false)}>
                Deselect with descendants
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onExportThis(id)}>
                <Download className="mr-2 h-4 w-4" /> Export this group
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onApplyInputs(node.Group)}>
                <FileJson className="mr-2 h-4 w-4" />
                {hasInputs(id) ? "Edit input data…" : "Apply input data…"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onImportCsvInputs(node.Group)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Import from CSV…
            </DropdownMenuItem>
        </>
    );
}

function ActionsMenuArchiveItems(props: ActionsMenuProps): JSX.Element {
    const { node, isArchived } = props;
    return (
        <>
            <DropdownMenuItem onSelect={() => props.onArchiveToggle(node.Group)}>
                {isArchived ? (
                    <><ArchiveRestore className="mr-2 h-4 w-4" /> Restore from archive</>
                ) : (
                    <><Archive className="mr-2 h-4 w-4" /> Archive</>
                )}
            </DropdownMenuItem>
            <DropdownMenuItem
                onSelect={() => props.onDelete(node.Group)}
                className="text-destructive focus:text-destructive"
            >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
        </>
    );
}

function TreeNodeActionsMenu(props: ActionsMenuProps): JSX.Element {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                    aria-label={`Actions for ${props.node.Group.Name}`}
                ><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <ActionsMenuStructureItems {...props} />
                <DropdownMenuSeparator />
                <ActionsMenuDataItems {...props} />
                <DropdownMenuSeparator />
                <ActionsMenuArchiveItems {...props} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}


interface LabelBodyProps {
    readonly node: TreeNode;
    readonly id: number;
    readonly hasChildren: boolean;
    readonly isOpen: boolean;
    readonly isChecked: boolean;
    readonly isArchived: boolean;
    readonly hasInputs: TreeNodeRowProps["hasInputs"];
    readonly onToggleExpanded: TreeNodeRowProps["onToggleExpanded"];
    readonly onToggleSelect: TreeNodeRowProps["onToggleSelect"];
    readonly onActivate: TreeNodeRowProps["onActivate"];
}

function TreeNodeLabelBody(props: LabelBodyProps): JSX.Element {
    const { node, id, hasChildren, isOpen, isChecked, isArchived, hasInputs } = props;
    return (
        <>
            <GripVertical
                className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 group-hover:opacity-100 active:cursor-grabbing"
                aria-hidden="true"
            />
            {hasChildren ? (
                <button type="button" onClick={() => props.onToggleExpanded(id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                >
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
            ) : (
                <span className="h-5 w-5 shrink-0" />
            )}
            <Checkbox
                checked={isChecked}
                onCheckedChange={(value) => props.onToggleSelect(id, value === true)}
                aria-label={`Select ${node.Group.Name}`}
                className="shrink-0"
            />
            <button type="button" onClick={() => props.onActivate(id)}
                className="min-w-0 flex-1 truncate text-left" title={node.Group.Name}
            >
                {node.Group.Name}
                {hasInputs(id) && (
                    <span
                        className="ml-2 inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                        title="This group has input data bound"
                    ><FileJson className="h-2.5 w-2.5" /> Inputs</span>
                )}
                {isArchived && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Archived
                    </span>
                )}
            </button>
        </>
    );
}

function rowClassName(input: {
    readonly isActive: boolean;
    readonly isHovered: boolean;
    readonly isArchived: boolean;
    readonly dragOver: boolean;
}): string {
    return [
        "group relative flex items-center gap-1 rounded px-2 py-1.5 text-sm transition-colors",
        input.isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/40",
        input.isHovered && !input.isActive ? "bg-accent/60 ring-1 ring-primary/50 shadow-sm" : "",
        input.isHovered && input.isActive ? "ring-1 ring-primary/70 shadow-sm" : "",
        input.isArchived ? "opacity-50" : "",
        input.dragOver ? "ring-2 ring-primary/60" : "",
    ].join(" ");
}

interface RowBodyProps {
    readonly props: TreeNodeRowProps;
    readonly id: number;
    readonly parentId: number | null;
    readonly hasChildren: boolean;
    readonly isOpen: boolean;
    readonly isActive: boolean;
    readonly isChecked: boolean;
    readonly isArchived: boolean;
    readonly isFirst: boolean;
    readonly isLast: boolean;
    readonly isHovered: boolean;
}

function TreeNodeRowBody(body: RowBodyProps): JSX.Element {
    const { props, id, parentId, hasChildren, isOpen, isActive, isChecked } = body;
    const { isArchived, isFirst, isLast, isHovered } = body;
    const { node, depth, hoveredId, onHover } = props;
    const drag = useTreeNodeDrag(id, parentId, props.onDropReorder);
    const onMouseEnter = (event: React.MouseEvent<HTMLDivElement>): void => {
        event.stopPropagation();
        onHover(id);
    };
    const onMouseLeave = (event: React.MouseEvent<HTMLDivElement>): void => {
        event.stopPropagation();
        if (hoveredId === id) onHover(null);
    };
    return (
        <div
            draggable
            onDragStart={drag.onDragStart} onDragOver={drag.onDragOver}
            onDragLeave={drag.onDragLeave} onDrop={drag.onDrop}
            onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
            data-hovered={isHovered ? "true" : undefined}
            className={rowClassName({ isActive, isHovered, isArchived, dragOver: drag.dragOver })}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
            {isHovered && (
                <span aria-hidden="true"
                    className="pointer-events-none absolute inset-y-1 left-0 w-1 rounded-r bg-primary"
                />
            )}
            <TreeNodeLabelBody
                node={node} id={id} hasChildren={hasChildren} isOpen={isOpen}
                isChecked={isChecked} isArchived={isArchived} hasInputs={props.hasInputs}
                onToggleExpanded={props.onToggleExpanded}
                onToggleSelect={props.onToggleSelect}
                onActivate={props.onActivate}
            />
            <TreeNodeMoveArrows id={id} name={node.Group.Name}
                isFirst={isFirst} isLast={isLast} onMove={props.onMove}
            />
            <TreeNodeActionsMenu
                node={node} id={id} isFirst={isFirst} isLast={isLast} isArchived={isArchived}
                hasInputs={props.hasInputs} onCreateChild={props.onCreateChild}
                onRename={props.onRename} onMove={props.onMove}
                onToggleSubtree={props.onToggleSubtree} onExportThis={props.onExportThis}
                onApplyInputs={props.onApplyInputs} onImportCsvInputs={props.onImportCsvInputs}
                onArchiveToggle={props.onArchiveToggle} onDelete={props.onDelete}
            />
        </div>
    );
}


export function TreeNodeRow(props: TreeNodeRowProps): JSX.Element {
    const { node, siblingIndex, siblingCount, selected, expanded, activeGroupId, hoveredId } = props;
    const id = node.Group.StepGroupId;
    const parentId = node.Group.ParentStepGroupId ?? null;
    const hasChildren = node.Children.length > 0;
    const isOpen = expanded.has(id);
    return (
        <li>
            <TreeNodeRowBody
                props={props}
                id={id}
                parentId={parentId}
                hasChildren={hasChildren}
                isOpen={isOpen}
                isActive={activeGroupId === id}
                isChecked={selected.has(id)}
                isArchived={node.Group.IsArchived}
                isFirst={siblingIndex === 0}
                isLast={siblingIndex === siblingCount - 1}
                isHovered={hoveredId === id}
            />
            {hasChildren && isOpen && (
                <ul>
                    {node.Children.map((child, idx) => (
                        <TreeNodeRow
                            key={child.Group.StepGroupId}
                            {...props}
                            node={child}
                            depth={props.depth + 1}
                            siblingIndex={idx}
                            siblingCount={node.Children.length}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}


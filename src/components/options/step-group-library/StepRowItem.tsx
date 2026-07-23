/**
 * StepRowItem — a single draggable step row inside the right pane
 * of the Step Group Library.
 *
 * Extracted from `StepGroupLibraryPanel.tsx` (Plan 24, Step 3) and
 * split into small helpers (drag handlers hook, label block, action
 * button strip) so each function stays inside the 50-line ceiling
 * enforced by `max-lines-per-function`.
 *
 * Behaviour is byte-for-byte identical to the previous inline
 * definition; only structure changed.
 */

import { useState } from "react";
import type { JSX } from "react";
import {
    ArrowDown,
    ArrowUp,
    GripVertical,
    Pencil,
    Timer,
    Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import type { StepRow } from "@/background/recorder/step-library/db";
import { StepKindId } from "@/background/recorder/step-library/schema";
import { stepKindLabel } from "@/hooks/use-step-library";

import { logError } from "../options-logger";
import { STEP_DRAG_MIME } from "./constants";

export interface StepRowItemProps {
    readonly step: StepRow;
    readonly index: number;
    readonly total: number;
    readonly stepGroupId: number;
    readonly waitLabel: string | null;
    readonly waitTitle: string | null;
    readonly onMove: (stepId: number, direction: "up" | "down") => void;
    readonly onDropReorder: (stepGroupId: number, sourceStepId: number, targetStepId: number) => void;
    readonly onToggleDisabled: (step: StepRow, nextDisabled: boolean) => void;
    readonly onEdit: (step: StepRow) => void;
    readonly onEditWait: (step: StepRow) => void;
    readonly onDelete: (step: StepRow) => void;
}

interface DragState {
    readonly dragOver: boolean;
    readonly dragging: boolean;
    readonly onDragStart: (event: React.DragEvent<HTMLLIElement>) => void;
    readonly onDragEnd: () => void;
    readonly onDragOver: (event: React.DragEvent<HTMLLIElement>) => void;
    readonly onDragLeave: () => void;
    readonly onDrop: (event: React.DragEvent<HTMLLIElement>) => void;
}

function useStepRowDrag(
    stepGroupId: number,
    stepId: number,
    onDropReorder: StepRowItemProps["onDropReorder"],
): DragState {
    const [dragOver, setDragOver] = useState(false);
    const [dragging, setDragging] = useState(false);

    const onDragStart = (event: React.DragEvent<HTMLLIElement>): void => {
        // Encode source step id + owning group so the drop target can
        // reject cross-group drops (cross-group step moves require
        // renumbering both groups — out of scope for the basic DnD).
        event.dataTransfer.setData(STEP_DRAG_MIME, JSON.stringify({ stepId, stepGroupId }));
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
    };
    const onDragEnd = (): void => setDragging(false);
    const onDragOver = (event: React.DragEvent<HTMLLIElement>): void => {
        const types = Array.from(event.dataTransfer.types);
        if (!types.includes(STEP_DRAG_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (!dragOver) setDragOver(true);
    };
    const onDragLeave = (): void => { if (dragOver) setDragOver(false); };
    const onDrop = (event: React.DragEvent<HTMLLIElement>): void => {
        event.preventDefault();
        setDragOver(false);
        const raw = event.dataTransfer.getData(STEP_DRAG_MIME);
        if (raw === "") return;
        try {
            const payload = JSON.parse(raw) as { stepId: number; stepGroupId: number };
            // Reject cross-group drops at the UI level — the runner has
            // no concept of "move a step into another group" yet.
            if (payload.stepGroupId !== stepGroupId) return;
            if (payload.stepId === stepId) return;
            onDropReorder(stepGroupId, payload.stepId, stepId);
        } catch (caught) {
            logError(
                "StepGroupLibraryPanel.handleDropReorder.step",
                "Malformed drag payload — DataTransfer JSON.parse failed",
                caught,
            );
        }
    };
    return { dragOver, dragging, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop };
}

function StepRowLabel(props: {
    readonly step: StepRow;
    readonly isDisabled: boolean;
    readonly waitLabel: string | null;
    readonly waitTitle: string | null;
}): JSX.Element {
    const { step, isDisabled, waitLabel, waitTitle } = props;
    return (
        <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {stepKindLabel(step.StepKindId)}
                </span>
                <span className={`truncate text-sm font-medium ${isDisabled ? "line-through" : ""}`}>
                    {step.Label ?? "(no label)"}
                </span>
                {isDisabled && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Skipped
                    </span>
                )}
                {waitLabel !== null && (
                    <span
                        className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                        title={waitTitle ?? undefined}
                    >
                        {waitLabel}
                    </span>
                )}
            </div>
            {step.StepKindId === StepKindId.RunGroup && step.TargetStepGroupId !== null && (
                <p className="mt-1 text-xs text-muted-foreground">Invokes group #{step.TargetStepGroupId}</p>
            )}
            {step.PayloadJson !== null && step.PayloadJson !== "" && (
                <pre className="mt-1 overflow-x-auto rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                    {step.PayloadJson}
                </pre>
            )}
        </div>
    );
}

interface StepRowActionsProps {
    readonly step: StepRow;
    readonly index: number;
    readonly total: number;
    readonly isDisabled: boolean;
    readonly waitLabel: string | null;
    readonly onMove: StepRowItemProps["onMove"];
    readonly onToggleDisabled: StepRowItemProps["onToggleDisabled"];
    readonly onEdit: StepRowItemProps["onEdit"];
    readonly onEditWait: StepRowItemProps["onEditWait"];
    readonly onDelete: StepRowItemProps["onDelete"];
}

function StepRowActions(props: StepRowActionsProps): JSX.Element {
    const { step, index, total, isDisabled, waitLabel } = props;
    const { onMove, onToggleDisabled, onEdit, onEditWait, onDelete } = props;
    return (
        <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7"
                disabled={index === 0}
                onClick={() => onMove(step.StepId, "up")}
                title={index === 0 ? "Already at the top" : "Move step up"}
                aria-label="Move step up"
            ><ArrowUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"
                disabled={index === total - 1}
                onClick={() => onMove(step.StepId, "down")}
                title={index === total - 1 ? "Already at the bottom" : "Move step down"}
                aria-label="Move step down"
            ><ArrowDown className="h-4 w-4" /></Button>
            <Switch
                checked={!isDisabled}
                onCheckedChange={(checked) => onToggleDisabled(step, !checked)}
                aria-label={isDisabled ? "Enable step" : "Disable step"}
                title={isDisabled ? "Disabled — runner will skip this step" : "Enabled — runner will execute this step"}
            />
            <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => onEdit(step)} title="Edit step" aria-label="Edit step"
            ><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => onEditWait(step)}
                title={waitLabel === null ? "Add wait condition" : "Edit wait condition"}
            ><Timer className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(step)} title="Delete step" aria-label="Delete step"
            ><Trash2 className="h-4 w-4" /></Button>
        </div>
    );
}

export function StepRowItem(props: StepRowItemProps): JSX.Element {
    const { step, index, total, stepGroupId, waitLabel, waitTitle } = props;
    const isDisabled = step.IsDisabled;
    const drag = useStepRowDrag(stepGroupId, step.StepId, props.onDropReorder);
    const className = [
        "flex items-start gap-3 px-4 py-3 transition-all",
        isDisabled ? "opacity-50" : "",
        drag.dragging ? "opacity-30" : "",
        drag.dragOver ? "bg-primary/10 outline outline-2 outline-primary" : "",
    ].join(" ").trim();
    return (
        <li draggable
            onDragStart={drag.onDragStart}
            onDragEnd={drag.onDragEnd}
            onDragOver={drag.onDragOver}
            onDragLeave={drag.onDragLeave}
            onDrop={drag.onDrop}
            className={className}
        >
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
                title="Drag to reorder" aria-hidden="true">
                <GripVertical className="h-4 w-4" />
            </span>
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {index + 1}
            </span>
            <StepRowLabel step={step} isDisabled={isDisabled} waitLabel={waitLabel} waitTitle={waitTitle} />
            <StepRowActions
                step={step} index={index} total={total} isDisabled={isDisabled} waitLabel={waitLabel}
                onMove={props.onMove} onToggleDisabled={props.onToggleDisabled}
                onEdit={props.onEdit} onEditWait={props.onEditWait} onDelete={props.onDelete}
            />
        </li>
    );
}

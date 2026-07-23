/**
 * Refactored keyword event card. Composes {@link KeywordEventCardHeader},
 * {@link KeywordEventStepList}, and {@link KeywordEventAddStepControls}
 * (Plan 25 Step 14). Owns per-event validation summary + card styling.
 */

import { cn } from "@/lib/utils";
import type { KeywordEvent, KeywordEventStep } from "@/hooks/use-keyword-events";
import { DEFAULT_KEYWORD_EVENT_TARGET } from "@/hooks/use-keyword-events";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { isEventRunnable, validateEventSteps } from "@/lib/keyword-event-validation";
import { KeywordEventCardHeader } from "./KeywordEventCardHeader";
import { KeywordEventStepList } from "./KeywordEventStepList";
import { KeywordEventAddStepControls } from "./KeywordEventAddStepControls";
import { LiveDispatchPreview } from "./LiveDispatchPreview";
import { TargetPickerRow } from "./TargetPickerRow";
import { PauseAfterRow } from "./PauseAfterRow";

export interface KeywordEventCardProps {
    readonly event: KeywordEvent;
    readonly isRunning: boolean;
    readonly currentStepIndex: number | null;
    readonly onPlay: () => void;
    readonly onCancel: () => void;
    readonly onRemove: () => void;
    readonly onUpdate: (patch: Partial<Omit<KeywordEvent, "Id">>) => void;
    readonly onAddStep: (step: Omit<KeywordEventStep, "Id">) => void;
    readonly onRemoveStep: (stepId: string) => void;
    readonly onMoveStep: (stepId: string, dir: "up" | "down") => void;
    readonly onRemoveSteps: (eventId: string, stepIds: readonly string[]) => void;
    readonly onSetStepsEnabled: (eventId: string, stepIds: readonly string[], enabled: boolean) => void;
    readonly onRelabelSteps: (eventId: string, stepIds: readonly string[], labels: readonly string[]) => void;
    readonly dragHandle?: React.ReactNode;
    readonly selected?: boolean;
    readonly onRowClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    readonly onToggleSelect?: (checked: boolean, mouseEvent?: React.MouseEvent<HTMLButtonElement>) => void;
}

// eslint-disable-next-line max-lines-per-function -- composition wrapper; Plan 25 Step 14
export function KeywordEventCard(props: KeywordEventCardProps): JSX.Element {
    const {
        event, isRunning, currentStepIndex,
        onPlay, onCancel, onRemove, onUpdate, onAddStep, onRemoveStep, onMoveStep,
        onRemoveSteps, onSetStepsEnabled, onRelabelSteps,
        dragHandle, selected, onRowClick, onToggleSelect,
    } = props;

    const stepIssues = validateEventSteps(event);
    const runnable = isEventRunnable(event);
    const runDisabledReason = computeRunDisabledReason(event, stepIssues.length);
    const currentStep = isRunning
        && currentStepIndex !== null
        && currentStepIndex >= 0
        && currentStepIndex < event.Steps.length
        ? event.Steps[currentStepIndex]
        : null;

    return (
        <div
            className={cn(
                "rounded-md border border-border bg-card/60 p-3 space-y-3 transition-shadow",
                isRunning && "ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]",
                stepIssues.length > 0 && !isRunning && "border-destructive/50",
                selected && "ring-2 ring-primary/60 bg-primary/5",
            )}
            data-testid={`keyword-event-${event.Id}`}
            data-selected={selected ? "true" : undefined}
            onClick={onRowClick}
        >
            <KeywordEventCardHeader
                event={event}
                isRunning={isRunning}
                runnable={runnable}
                runDisabledReason={runDisabledReason}
                dragHandle={dragHandle}
                selected={selected}
                onToggleSelect={onToggleSelect}
                onUpdate={onUpdate}
                onPlay={onPlay}
                onCancel={onCancel}
                onRemove={onRemove}
            />

            {currentStep && currentStepIndex !== null && (
                <LiveDispatchPreview
                    eventId={event.Id}
                    step={currentStep}
                    stepIndex={currentStepIndex}
                    totalSteps={event.Steps.length}
                />
            )}

            <Input
                value={event.Description}
                onChange={(inputEvent) => onUpdate({ Description: inputEvent.target.value })}
                placeholder="Optional description"
                className="h-8 text-xs"
            />

            <TargetPickerRow
                eventId={event.Id}
                value={event.Target ?? DEFAULT_KEYWORD_EVENT_TARGET}
                onChange={(next) => onUpdate({ Target: next })}
            />

            <PauseAfterRow
                eventId={event.Id}
                value={event.PauseAfterMs}
                onChange={(next) => onUpdate({ PauseAfterMs: next })}
            />

            {stepIssues.length > 0 && (
                <p
                    className="text-[10px] text-destructive"
                    role="status"
                    data-testid={`keyword-event-issues-${event.Id}`}
                >
                    {stepIssues.length} step{stepIssues.length === 1 ? "" : "s"} need{stepIssues.length === 1 ? "s" : ""} fixing — Run is disabled until resolved.
                </p>
            )}

            <KeywordEventStepList
                event={event}
                currentStepIndex={currentStepIndex}
                onRemoveStep={onRemoveStep}
                onMoveStep={onMoveStep}
                onRemoveSteps={onRemoveSteps}
                onSetStepsEnabled={onSetStepsEnabled}
                onRelabelSteps={onRelabelSteps}
            />

            <Separator />

            <KeywordEventAddStepControls eventId={event.Id} onAddStep={onAddStep} />
        </div>
    );
}

function computeRunDisabledReason(event: KeywordEvent, issueCount: number): string | null {
    if (!event.Enabled) { return "Event is disabled"; }
    if (event.Steps.length === 0) { return "Add at least one step"; }
    if (issueCount > 0) {
        const plural = issueCount === 1 ? "" : "s";
        const verb = issueCount === 1 ? "s" : "";
        return `${issueCount} step${plural} need${verb} fixing`;
    }
    return null;
}

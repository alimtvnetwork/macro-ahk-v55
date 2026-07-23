/**
 * Per-event step list with multi-selection toolbar. Extracted from
 * `KeywordEventsPanel.tsx` in Plan 25 Step 14 — owns the per-card
 * shift-click selection so each event tracks its own anchor.
 */

import { ArrowDown, ArrowUp, Clock, Keyboard, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
    modifiersFromMouseEvent,
    useShiftClickSelection,
} from "@/hooks/use-shift-click-selection";
import type { KeywordEvent, KeywordEventStep } from "@/hooks/use-keyword-events";
import { validateEventSteps } from "@/lib/keyword-event-validation";
import { KeywordEventStepContextMenu } from "../KeywordEventStepContextMenu";

const CSS_TEXT_DESTRUCTIVE = "text-destructive";

export interface KeywordEventStepListProps {
    readonly event: KeywordEvent;
    readonly currentStepIndex: number | null;
    readonly onRemoveStep: (stepId: string) => void;
    readonly onMoveStep: (stepId: string, dir: "up" | "down") => void;
    readonly onRemoveSteps: (eventId: string, stepIds: readonly string[]) => void;
    readonly onSetStepsEnabled: (eventId: string, stepIds: readonly string[], enabled: boolean) => void;
    readonly onRelabelSteps: (eventId: string, stepIds: readonly string[], labels: readonly string[]) => void;
}

// eslint-disable-next-line max-lines-per-function -- JSX-heavy leaf; Plan 25 Step 14
export function KeywordEventStepList(props: KeywordEventStepListProps): JSX.Element {
    const {
        event, currentStepIndex, onRemoveStep, onMoveStep,
        onRemoveSteps, onSetStepsEnabled, onRelabelSteps,
    } = props;

    const stepIds = event.Steps.map((step) => step.Id);
    const stepSelection = useShiftClickSelection(stepIds);
    const isMacRow = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
    const stepIssues = validateEventSteps(event);
    const issuesByIndex = new Map(stepIssues.map((issue) => [issue.Index, issue] as const));

    const handleStepRowClick = (stepId: string, mouseEvent: React.MouseEvent): void => {
        if ((mouseEvent.target as HTMLElement | null)?.closest("button,input,textarea,select,label")) return;
        stepSelection.handleClick(stepId, modifiersFromMouseEvent(mouseEvent.nativeEvent, isMacRow));
    };

    return (
        <div className="space-y-1.5">
            {event.Steps.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No steps yet — add a key press or wait below.</p>
            )}
            {stepSelection.selected.size > 0 && (
                <div
                    className="flex items-center gap-2 rounded border border-border/60 bg-muted/30 px-2 py-1 text-[10px]"
                    data-testid={`keyword-event-step-selection-toolbar-${event.Id}`}
                >
                    <span className="font-medium" data-testid={`keyword-event-step-selection-count-${event.Id}`}>
                        {stepSelection.selected.size} step{stepSelection.selected.size === 1 ? "" : "s"} selected
                    </span>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-5 px-1.5 text-[10px]"
                        onClick={(clickEvent) => { clickEvent.stopPropagation(); stepSelection.clear(); }}
                        data-testid={`keyword-event-step-selection-clear-${event.Id}`}
                    >
                        Clear
                    </Button>
                </div>
            )}
            {event.Steps.map((step, index) => (
                <StepRow
                    key={step.Id}
                    step={step}
                    index={index}
                    event={event}
                    issue={issuesByIndex.get(index)}
                    isCurrent={currentStepIndex === index}
                    selected={stepSelection.isSelected(step.Id)}
                    selectedStepIds={stepSelection.selected}
                    onRowClick={handleStepRowClick}
                    onCheckboxClick={(stepId, mouseEvent) => {
                        if (mouseEvent.shiftKey) {
                            stepSelection.handleClick(stepId, { shiftKey: true, toggleKey: false });
                        } else {
                            stepSelection.handleClick(stepId, { shiftKey: false, toggleKey: true });
                        }
                    }}
                    onContextOpenForUnselected={() => {
                        stepSelection.handleClick(step.Id, { shiftKey: false, toggleKey: false });
                    }}
                    onAfterRemove={() => stepSelection.clear()}
                    onSetStepsEnabled={onSetStepsEnabled}
                    onRemoveSteps={onRemoveSteps}
                    onRelabelSteps={onRelabelSteps}
                    onRemoveStep={onRemoveStep}
                    onMoveStep={onMoveStep}
                />
            ))}
        </div>
    );
}

interface StepRowProps {
    readonly step: KeywordEventStep;
    readonly index: number;
    readonly event: KeywordEvent;
    readonly issue: { readonly Message: string } | undefined;
    readonly isCurrent: boolean;
    readonly selected: boolean;
    readonly selectedStepIds: ReadonlySet<string>;
    readonly onRowClick: (stepId: string, mouseEvent: React.MouseEvent) => void;
    readonly onCheckboxClick: (stepId: string, mouseEvent: React.MouseEvent<HTMLButtonElement>) => void;
    readonly onContextOpenForUnselected: () => void;
    readonly onAfterRemove: () => void;
    readonly onSetStepsEnabled: (eventId: string, stepIds: readonly string[], enabled: boolean) => void;
    readonly onRemoveSteps: (eventId: string, stepIds: readonly string[]) => void;
    readonly onRelabelSteps: (eventId: string, stepIds: readonly string[], labels: readonly string[]) => void;
    readonly onRemoveStep: (stepId: string) => void;
    readonly onMoveStep: (stepId: string, dir: "up" | "down") => void;
}

// eslint-disable-next-line max-lines-per-function -- JSX-heavy leaf; Plan 25 Step 14
function StepRow(props: StepRowProps): JSX.Element {
    const {
        step, index, event, issue, isCurrent, selected, selectedStepIds,
        onRowClick, onCheckboxClick, onContextOpenForUnselected, onAfterRemove,
        onSetStepsEnabled, onRemoveSteps, onRelabelSteps,
        onRemoveStep, onMoveStep,
    } = props;
    const stepDisabled = step.Enabled === false;

    return (
        <KeywordEventStepContextMenu
            step={step}
            event={event}
            selectedStepIds={selectedStepIds}
            onSetEnabled={onSetStepsEnabled}
            onRemove={onRemoveSteps}
            onRelabel={onRelabelSteps}
            onAfterRemove={onAfterRemove}
            onContextOpenForUnselected={onContextOpenForUnselected}
        >
            <div
                className={cn(
                    "flex flex-col gap-0.5 rounded bg-muted/40 px-2 py-1.5 text-xs transition-colors cursor-pointer",
                    isCurrent && "bg-primary/15 ring-1 ring-primary/40",
                    issue && "bg-destructive/10 ring-1 ring-destructive/40",
                    selected && "bg-primary/20 ring-1 ring-primary/60",
                    stepDisabled && "opacity-60",
                )}
                data-testid={`keyword-event-step-${event.Id}-${index}`}
                data-invalid={issue ? "true" : undefined}
                data-selected={selected ? "true" : undefined}
                data-step-disabled={stepDisabled ? "true" : undefined}
                onClick={(clickEvent) => { clickEvent.stopPropagation(); onRowClick(step.Id, clickEvent); }}
            >
                <div className="flex items-center gap-2">
                    <Checkbox
                        checked={selected}
                        onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            onCheckboxClick(step.Id, clickEvent as React.MouseEvent<HTMLButtonElement>);
                        }}
                        aria-label={`Select step ${index + 1}`}
                        data-testid={`keyword-event-step-select-${event.Id}-${index}`}
                        className="h-3.5 w-3.5"
                    />
                    <Badge variant="outline" className="text-[10px] w-6 justify-center">{index + 1}</Badge>
                    {step.Label && (
                        <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5"
                            data-testid={`keyword-event-step-label-${event.Id}-${index}`}
                        >
                            {step.Label}
                        </Badge>
                    )}
                    <StepKindDetail step={step} hasIssue={issue !== undefined} />
                    <div className="ml-auto flex items-center gap-0.5">
                        <Button
                            size="icon" variant="ghost" className="h-6 w-6"
                            onClick={(clickEvent) => { clickEvent.stopPropagation(); onMoveStep(step.Id, "up"); }}
                            disabled={index === 0}
                            aria-label="Move step up"
                        >
                            <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                            size="icon" variant="ghost" className="h-6 w-6"
                            onClick={(clickEvent) => { clickEvent.stopPropagation(); onMoveStep(step.Id, "down"); }}
                            disabled={index === event.Steps.length - 1}
                            aria-label="Move step down"
                        >
                            <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                            size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                            onClick={(clickEvent) => { clickEvent.stopPropagation(); onRemoveStep(step.Id); }}
                            aria-label="Remove step"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
                {issue && (
                    <p className={cn("text-[10px] pl-8", CSS_TEXT_DESTRUCTIVE)}>{issue.Message}</p>
                )}
            </div>
        </KeywordEventStepContextMenu>
    );
}

function StepKindDetail(props: { readonly step: KeywordEventStep; readonly hasIssue: boolean }): JSX.Element {
    const { step, hasIssue } = props;
    if (step.Kind === "Key") {
        return (
            <>
                <Keyboard className={cn("h-3.5 w-3.5", hasIssue ? CSS_TEXT_DESTRUCTIVE : "text-primary")} />
                <code className="font-mono">{step.Combo || <span className="italic opacity-70">(empty)</span>}</code>
            </>
        );
    }
    return (
        <>
            <Clock className={cn("h-3.5 w-3.5", hasIssue ? CSS_TEXT_DESTRUCTIVE : "text-primary")} />
            <span>Wait <strong>{String(step.DurationMs)}</strong> ms</span>
        </>
    );
}

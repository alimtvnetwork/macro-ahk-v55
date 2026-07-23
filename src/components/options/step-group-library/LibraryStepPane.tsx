/**
 * LibraryStepPane — right pane of `StepGroupLibraryPanel`.
 *
 * Presentational-only wrapper around the active-group header,
 * action row (JSON / CSV / Add step / Run group) and the ordered
 * `StepRowItem` list. Extracted from `StepGroupLibraryPanel.tsx`
 * (previously lines 1111-1230) so the panel render function drops
 * under the 50-line ceiling from `.lovable/coding-guidelines.md`
 * Rule 1.
 */

import { FileJson, FileSpreadsheet, Play, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { StepGroupRow, StepRow } from "@/background/recorder/step-library/db";
import type { WaitConfig } from "@/background/recorder/step-library/step-wait";
import { StepRowItem } from "./StepRowItem";
import { SELECT_GROUP_FIRST_TOOLTIP } from "./constants";

interface LibraryStepPaneProps {
    readonly activeGroup: StepGroupRow | null;
    readonly activeSteps: ReadonlyArray<StepRow>;
    readonly stepWaits: ReadonlyMap<number, WaitConfig>;
    readonly groupInputs: ReadonlyMap<number, Readonly<Record<string, unknown>>>;
    readonly onOpenInputs: (group: StepGroupRow) => void;
    readonly onOpenCsv: (group: StepGroupRow) => void;
    readonly onCreateStep: (group: StepGroupRow) => void;
    readonly onRunGroup: (group: StepGroupRow) => void;
    readonly onStepMove: (stepId: number, direction: "up" | "down") => void;
    readonly onStepDropReorder: (stepGroupId: number, sourceStepId: number, targetStepId: number) => void;
    readonly onStepToggleDisabled: (step: StepRow, nextDisabled: boolean) => void;
    readonly onStepEdit: (step: StepRow) => void;
    readonly onStepEditWait: (step: StepRow) => void;
    readonly onStepDelete: (step: StepRow) => void;
}

function StepPaneTitle({ activeGroup, activeStepsCount, groupInputs }: {
    readonly activeGroup: StepGroupRow | null;
    readonly activeStepsCount: number;
    readonly groupInputs: LibraryStepPaneProps["groupInputs"];
}) {
    const inputsCount = activeGroup !== null
        ? Object.keys(groupInputs.get(activeGroup.StepGroupId) ?? {}).length
        : 0;
    return (
        <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-sm font-medium text-muted-foreground">
                {activeGroup === null
                    ? "Select a group to preview its steps"
                    : `${activeGroup.Name} \u2014 ${activeStepsCount} step(s)`}
            </div>
            {activeGroup !== null && groupInputs.has(activeGroup.StepGroupId) && (
                <span
                    className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                    title={`${inputsCount} input variable(s) bound`}
                >
                    Inputs bound
                </span>
            )}
        </div>
    );
}

function StepPaneActions(props: LibraryStepPaneProps) {
    const grp = props.activeGroup;
    return (
        <div className="flex items-center gap-2">
            {grp?.Description != null && grp.Description !== "" && (
                <div className="hidden max-w-[40ch] truncate text-xs text-muted-foreground sm:block">
                    {grp.Description}
                </div>
            )}
            <Button variant="outline" size="sm" disabled={grp === null}
                onClick={() => grp !== null && props.onOpenInputs(grp)}
                title={grp === null ? SELECT_GROUP_FIRST_TOOLTIP : "Apply input data to this group"}>
                <FileJson className="mr-1 h-4 w-4" />JSON
            </Button>
            <Button variant="outline" size="sm" disabled={grp === null}
                onClick={() => grp !== null && props.onOpenCsv(grp)}
                title={grp === null ? SELECT_GROUP_FIRST_TOOLTIP : "Import CSV input for this group"}>
                <FileSpreadsheet className="mr-1 h-4 w-4" />CSV
            </Button>
            <Button variant="outline" size="sm" disabled={grp === null}
                onClick={() => grp !== null && props.onCreateStep(grp)}
                title={grp === null ? SELECT_GROUP_FIRST_TOOLTIP : "Add a new step to this group"}>
                <Plus className="mr-1 h-4 w-4" />Add step
            </Button>
            <Button variant="secondary" size="sm"
                disabled={grp === null || props.activeSteps.length === 0}
                onClick={() => grp !== null && props.onRunGroup(grp)}
                title={grp === null
                    ? SELECT_GROUP_FIRST_TOOLTIP
                    : props.activeSteps.length === 0
                        ? "Group has no steps to run"
                        : "Execute this group and view its trace + failure reason"}>
                <Play className="mr-1 h-4 w-4" />Run group
            </Button>
        </div>
    );
}

function StepList(props: LibraryStepPaneProps) {
    const { activeGroup, activeSteps, stepWaits } = props;
    if (activeGroup === null) {
        return (
            <div className="flex h-full items-center justify-center px-4 py-12 text-sm text-muted-foreground">
                Click a group on the left to see its steps.
            </div>
        );
    }
    if (activeSteps.length === 0) {
        return (
            <div className="flex h-full items-center justify-center px-4 py-12 text-sm text-muted-foreground">
                This group has no steps yet.
            </div>
        );
    }
    return (
        <ol className="divide-y">
            {activeSteps.map((step, idx) => {
                const wait = stepWaits.get(step.StepId);
                const waitLabel = wait === undefined ? null : `Wait \u00B7 ${wait.Condition}`;
                const waitTitle = wait === undefined
                    ? null
                    : `Wait for ${wait.Kind} "${wait.Selector}" to ${wait.Condition} (${wait.TimeoutMs} ms)`;
                return (
                    <StepRowItem
                        key={step.StepId}
                        step={step}
                        index={idx}
                        total={activeSteps.length}
                        stepGroupId={activeGroup.StepGroupId}
                        waitLabel={waitLabel}
                        waitTitle={waitTitle}
                        onMove={props.onStepMove}
                        onDropReorder={props.onStepDropReorder}
                        onToggleDisabled={props.onStepToggleDisabled}
                        onEdit={props.onStepEdit}
                        onEditWait={props.onStepEditWait}
                        onDelete={props.onStepDelete}
                    />
                );
            })}
        </ol>
    );
}

export function LibraryStepPane(props: LibraryStepPaneProps) {
    return (
        <Card className="flex min-h-[400px] flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
                <StepPaneTitle
                    activeGroup={props.activeGroup}
                    activeStepsCount={props.activeSteps.length}
                    groupInputs={props.groupInputs}
                />
                <StepPaneActions {...props} />
            </div>
            <ScrollArea className="flex-1">
                <StepList {...props} />
            </ScrollArea>
        </Card>
    );
}

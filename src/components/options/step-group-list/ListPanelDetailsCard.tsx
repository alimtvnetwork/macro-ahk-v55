/**
 * Marco Extension — Step Group List Panel Details Card
 *
 * Right-hand details pane for `StepGroupListPanel`. Renders the header,
 * metadata grid, and per-step list for the currently-selected group.
 *
 * Extracted (Plan 24, Step 4, Phase 4) so the parent panel's render
 * function stops carrying ~130 lines of inline JSX. Pure presentation:
 * every mutation is passed in as a callback prop and every read comes
 * from props, so this component has no dependency on the library store.
 *
 * @see ../StepGroupListPanel.tsx — parent that owns state + handlers.
 */

import { Archive, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

import type { StepGroupRow, StepRow } from "@/background/recorder/step-library/db";
import { stepKindLabel } from "@/hooks/use-step-library";

/**
 * Locale-aware timestamp formatter. Falls back to the raw ISO string
 * when the input is unparseable so we never blank out the metadata grid.
 */
function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function DetailField(props: { label: string; value: string; mono?: boolean }): JSX.Element {
    return (
        <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {props.label}
            </span>
            <span className={props.mono === true ? "font-mono text-xs" : "text-xs"}>
                {props.value}
            </span>
        </div>
    );
}

export interface ListPanelDetailsCardProps {
    readonly activeGroup: StepGroupRow | null;
    readonly activeSteps: readonly StepRow[];
    readonly hasBoundInputs: boolean;
    readonly onRename: (group: StepGroupRow) => void;
    readonly onDelete: (group: StepGroupRow) => void;
    readonly onToggleStep: (stepId: number, disabled: boolean) => void;
}

export function ListPanelDetailsCard(props: ListPanelDetailsCardProps): JSX.Element {
    const {
        activeGroup,
        activeSteps,
        hasBoundInputs,
        onRename,
        onDelete,
        onToggleStep,
    } = props;

    if (activeGroup === null) {
        return (
            <Card className="flex min-h-[400px] flex-col overflow-hidden">
                <div className="flex h-full items-center justify-center px-4 py-12 text-sm text-muted-foreground">
                    Select a group on the left to see its details.
                </div>
            </Card>
        );
    }

    return (
        <Card className="flex min-h-[400px] flex-col overflow-hidden">
            <header className="flex flex-col gap-2 border-b px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-base font-semibold">
                            {activeGroup.Name}
                        </h2>
                        {activeGroup.IsArchived && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                <Archive className="h-3 w-3" />
                                Archived
                            </span>
                        )}
                        {hasBoundInputs && (
                            <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                                Inputs bound
                            </span>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onRename(activeGroup)}
                        >
                            <Pencil className="mr-1 h-4 w-4" />
                            Rename
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => onDelete(activeGroup)}
                        >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                        </Button>
                    </div>
                </div>
                {activeGroup.Description != null && activeGroup.Description !== "" && (
                    <p className="text-sm text-muted-foreground">
                        {activeGroup.Description}
                    </p>
                )}
            </header>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b bg-muted/20 px-4 py-2 text-xs">
                <DetailField label="ID" value={`#${activeGroup.StepGroupId}`} mono />
                <DetailField label="Steps" value={String(activeSteps.length)} />
                <DetailField label="Created" value={formatDate(activeGroup.CreatedAt)} />
                <DetailField label="Updated" value={formatDate(activeGroup.UpdatedAt)} />
            </div>

            <ScrollArea className="flex-1">
                {activeSteps.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-4 py-12 text-sm text-muted-foreground">
                        This group has no steps yet.
                    </div>
                ) : (
                    <ol className="divide-y">
                        {activeSteps.map((s, idx) => (
                            <StepRowItem
                                key={s.StepId}
                                step={s}
                                ordinal={idx + 1}
                                onToggle={onToggleStep}
                            />
                        ))}
                    </ol>
                )}
            </ScrollArea>
        </Card>
    );
}

interface StepRowItemProps {
    readonly step: StepRow;
    readonly ordinal: number;
    readonly onToggle: (stepId: number, disabled: boolean) => void;
}

function StepRowItem(props: StepRowItemProps): JSX.Element {
    const { step: s, ordinal, onToggle } = props;
    return (
        <li
            className={`flex items-start gap-3 px-4 py-3 transition-opacity ${
                s.IsDisabled ? "opacity-50" : ""
            }`}
        >
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                {ordinal}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {stepKindLabel(s.StepKindId)}
                    </span>
                    <span
                        className={`truncate text-sm font-medium ${
                            s.IsDisabled ? "line-through" : ""
                        }`}
                    >
                        {s.Label ?? "(no label)"}
                    </span>
                    {s.IsDisabled && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Skipped
                        </span>
                    )}
                </div>
            </div>
            <Switch
                className="mt-0.5 shrink-0"
                checked={!s.IsDisabled}
                onCheckedChange={(checked) => {
                    onToggle(s.StepId, !checked);
                    toast.success(
                        checked
                            ? `Step "${s.Label ?? s.StepId}" enabled`
                            : `Step "${s.Label ?? s.StepId}" disabled — will be skipped on run`,
                    );
                }}
                aria-label={s.IsDisabled ? "Enable step" : "Disable step"}
                title={
                    s.IsDisabled
                        ? "Disabled — runner will skip this step"
                        : "Enabled — runner will execute this step"
                }
            />
        </li>
    );
}

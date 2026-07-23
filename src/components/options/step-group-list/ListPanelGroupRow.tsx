/**
 * Marco Extension — Step Group List Panel Row
 *
 * Single-row renderer for the flat group list in `StepGroupListPanel`.
 * Extracted (Plan 24, Step 4, Phase 3) so the parent panel's `filtered.map`
 * callback stops tripping `max-lines-per-function`.
 *
 * Pure presentation: every mutation is a callback prop. `parentName` is
 * pre-resolved by the parent (which already keeps a `groupsById` map) so
 * this component never touches the library store.
 *
 * @see ../StepGroupListPanel.tsx — parent that owns state + handlers.
 */

import { Archive, ListOrdered } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import type { StepGroupRow } from "@/background/recorder/step-library/db";

export interface ListPanelGroupRowProps {
    readonly group: StepGroupRow;
    readonly isActive: boolean;
    readonly isChecked: boolean;
    readonly stepCount: number;
    readonly parentName: string | null;
    readonly onToggleSelect: (id: number, on: boolean) => void;
    readonly onActivate: (id: number) => void;
}

export function ListPanelGroupRow(props: ListPanelGroupRowProps): JSX.Element {
    const {
        group,
        isActive,
        isChecked,
        stepCount,
        parentName,
        onToggleSelect,
        onActivate,
    } = props;

    const checkboxId = `list-select-${group.StepGroupId}`;
    const rowTone = isActive
        ? "bg-primary/10"
        : isChecked
            ? "bg-primary/5"
            : "hover:bg-muted/40";

    return (
        <li className={`flex items-stretch transition ${rowTone}`}>
            {/* Checkbox lives outside the activate-row button so clicking it
                never changes which group is showing in the details pane. */}
            <div className="flex shrink-0 items-center pl-4 pr-1">
                <Checkbox
                    id={checkboxId}
                    checked={isChecked}
                    onCheckedChange={(state) =>
                        onToggleSelect(group.StepGroupId, state === true)
                    }
                    aria-label={`Select ${group.Name}`}
                />
            </div>
            <button
                type="button"
                onClick={() => onActivate(group.StepGroupId)}
                className="flex flex-1 flex-col items-start gap-0.5 py-2 pl-2 pr-4 text-left text-foreground"
                aria-pressed={isActive}
            >
                <div className="flex w-full items-center gap-2">
                    <span className="truncate text-sm font-medium">
                        {group.Name}
                    </span>
                    {group.IsArchived && (
                        <span
                            className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                            title="Archived"
                        >
                            <Archive className="h-3 w-3" />
                            Archived
                        </span>
                    )}
                </div>
                <div className="flex w-full items-center gap-2 text-xs text-muted-foreground">
                    <ListOrdered className="h-3 w-3" />
                    <span>
                        {stepCount} step{stepCount === 1 ? "" : "s"}
                    </span>
                    {parentName !== null && (
                        <span className="truncate">· in {parentName}</span>
                    )}
                </div>
            </button>
        </li>
    );
}

/**
 * RunGroup target picker. Small subcomponent extracted from
 * StepEditorDialog to shrink its render body.
 */

import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { StepGroupRow } from "@/background/recorder/step-library/db";

export interface RunGroupTargetFieldProps {
    readonly value: number | null;
    readonly candidates: ReadonlyArray<StepGroupRow>;
    readonly onChange: (value: number | null) => void;
}

export function RunGroupTargetField(props: RunGroupTargetFieldProps): JSX.Element {
    const { value, candidates, onChange } = props;
    return (
        <div className="space-y-1">
            <Label htmlFor="step-target">Target group</Label>
            <Select
                value={value === null ? "" : String(value)}
                onValueChange={(next) => onChange(next === "" ? null : Number(next))}
            >
                <SelectTrigger id="step-target">
                    <SelectValue placeholder="Select a group to invoke" />
                </SelectTrigger>
                <SelectContent>
                    {candidates.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No eligible groups (a RunGroup step cannot reference its
                            own group or descendants).
                        </div>
                    ) : candidates.map((group) => (
                        <SelectItem key={group.StepGroupId} value={String(group.StepGroupId)}>
                            {group.Name} (#{group.StepGroupId})
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

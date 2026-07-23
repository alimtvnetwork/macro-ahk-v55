/**
 * Marco Extension — Step Wait Selector Dialog
 *
 * Configure (or clear) the post-step wait condition for a single Step.
 * State/effects/handlers live in `./step-wait/use-step-wait-dialog.ts`;
 * presentational fragments live in `./step-wait/StepWaitSections.tsx`.
 * This file is a thin shell so it stays under the 50-line cap.
 */

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useStepWaitDialog } from "./step-wait/use-step-wait-dialog";
import {
    SelectorField,
    KindModeField,
    ConditionField,
    TimeoutField,
} from "./step-wait/StepWaitSections";

interface Props {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly stepId: number | null;
    readonly stepLabel: string | null;
    readonly onChange?: () => void;
}

function describeStep(stepLabel: string | null): string {
    if (stepLabel === null || stepLabel.length === 0) {
        return "After this step runs, wait for the selector below to satisfy the chosen condition before continuing.";
    }
    return `After "${stepLabel}" runs, wait for this selector before continuing.`;
}

export default function StepWaitDialog(props: Props) {
    const { open, onOpenChange, stepId, stepLabel, onChange } = props;
    const s = useStepWaitDialog({ open, stepId, onChange, onOpenChange });
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Wait after this step</DialogTitle>
                    <DialogDescription>{describeStep(stepLabel)}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <SelectorField
                        selector={s.selector}
                        setSelector={s.setSelector}
                        kindMode={s.kindMode}
                        detected={s.detected}
                        effectiveKind={s.effectiveKind}
                        validation={s.validation}
                        testResult={s.testResult}
                        onTest={s.handleTest}
                    />
                    <KindModeField value={s.kindMode} onChange={s.setKindMode} />
                    <ConditionField value={s.condition} onChange={s.setCondition} />
                    <TimeoutField value={s.timeoutMs} onChange={s.setTimeoutMs} />
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                    <div>
                        {s.hasExisting && (
                            <Button variant="ghost" onClick={s.handleClear}>
                                <Trash2 className="mr-1 h-4 w-4" />
                                Remove wait
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={s.handleSave}>Save</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

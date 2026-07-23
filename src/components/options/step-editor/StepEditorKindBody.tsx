/**
 * Kind-router body for StepEditorDialog. Chooses the correct per-kind
 * subform based on the current StepKindId. Extracted so the host
 * component stays within the ESLint max-lines-per-function budget.
 */

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { StepGroupRow } from "@/background/recorder/step-library/db";
import { StepKindId } from "@/background/recorder/step-library/schema";

import { HotkeyFields } from "./HotkeyFields";
import { UrlTabClickFields } from "./UrlTabClickFields";
import { RunGroupTargetField } from "./RunGroupTargetField";
import type { UrlTabClickFormState } from "./payload-builders";

export interface StepEditorKindBodyProps {
    readonly kind: StepKindId;
    readonly targetGroupId: number | null;
    readonly targetCandidates: ReadonlyArray<StepGroupRow>;
    readonly onTargetGroupIdChange: (value: number | null) => void;
    readonly hotkeyChords: readonly string[];
    readonly hotkeyWaitMs: string;
    readonly onHotkeyChordsChange: (chords: readonly string[]) => void;
    readonly onHotkeyWaitMsChange: (value: string) => void;
    readonly urlTabClick: UrlTabClickFormState;
    readonly onUrlTabClickPatch: (patch: Partial<UrlTabClickFormState>) => void;
    readonly payloadJson: string;
    readonly onPayloadJsonChange: (value: string) => void;
    readonly payloadPlaceholder: string;
}

export function StepEditorKindBody(props: StepEditorKindBodyProps): JSX.Element {
    const { kind } = props;
    if (kind === StepKindId.RunGroup) {
        return (
            <RunGroupTargetField
                value={props.targetGroupId}
                candidates={props.targetCandidates}
                onChange={props.onTargetGroupIdChange}
            />
        );
    }
    if (kind === StepKindId.Hotkey) {
        return (
            <HotkeyFields
                chords={props.hotkeyChords}
                waitMs={props.hotkeyWaitMs}
                onChordsChange={props.onHotkeyChordsChange}
                onWaitMsChange={props.onHotkeyWaitMsChange}
            />
        );
    }
    if (kind === StepKindId.UrlTabClick) {
        return <UrlTabClickFields value={props.urlTabClick} onPatch={props.onUrlTabClickPatch} />;
    }
    return (
        <div className="space-y-1">
            <Label htmlFor="step-payload">Payload JSON</Label>
            <Textarea
                id="step-payload"
                value={props.payloadJson}
                rows={6}
                spellCheck={false}
                placeholder={props.payloadPlaceholder}
                onChange={(event) => props.onPayloadJsonChange(event.target.value)}
                className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
                Leave blank when the kind doesn't need a payload. The runner
                expects PascalCase keys (Selector, Value, WaitMs, ...).
            </p>
        </div>
    );
}

/**
 * Marco Extension — Step Editor Dialog
 *
 * Add/Edit form for a single Step inside a StepGroup. Used by the
 * Step Group Library panel's right-hand step preview.
 *
 * Modes:
 *   - "create": appended to the end of the parent group via
 *     `useStepLibrary.appendStep`. Returns focus on save.
 *   - "edit":  patches an existing step in place via
 *     `useStepLibrary.updateStep` (preserves OrderIndex).
 *
 * The form keeps the (StepKindId, TargetStepGroupId) invariant the
 * DB enforces: RunGroup steps require a target group; every other
 * kind hides the target picker.
 *
 * v4.217.0: payload build + per-kind subforms extracted into
 * `./step-editor/*` to bring this component under the ESLint
 * max-lines-per-function and cognitive-complexity budgets.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import type { StepGroupRow, StepRow } from "@/background/recorder/step-library/db";
import { StepKindId } from "@/background/recorder/step-library/schema";
import { stepKindLabel } from "@/hooks/use-step-library";

import {
    buildGenericPayload,
    buildHotkeyPayload,
    buildUrlTabClickPayload,
    hydrateUrlTabClickForm,
    URL_TAB_CLICK_DEFAULTS,
    type BuildResult,
    type UrlTabClickFormState,
} from "./step-editor/payload-builders";
import { StepEditorKindBody } from "./step-editor/StepEditorKindBody";

/* ------------------------------------------------------------------ */
/*  Public surface                                                     */
/* ------------------------------------------------------------------ */

export type StepEditorMode =
    | { Kind: "create"; StepGroupId: number }
    | { Kind: "edit"; Step: StepRow };

export interface StepEditorDialogProps {
    readonly open: boolean;
    readonly mode: StepEditorMode | null;
    readonly groups: ReadonlyArray<StepGroupRow>;
    readonly onCancel: () => void;
    readonly onSubmit: (input: {
        StepKindId: StepKindId;
        Label: string | null;
        PayloadJson: string | null;
        TargetStepGroupId: number | null;
    }) => void;
}

const KIND_OPTIONS: ReadonlyArray<StepKindId> = [
    StepKindId.Click,
    StepKindId.Type,
    StepKindId.Select,
    StepKindId.JsInline,
    StepKindId.Wait,
    StepKindId.RunGroup,
    StepKindId.Hotkey,
    StepKindId.UrlTabClick,
];

function payloadPlaceholderFor(kind: StepKindId): string {
    switch (kind) {
        case StepKindId.Click:      return '{ "Selector": "#submit-button" }';
        case StepKindId.Type:       return '{ "Selector": "#email", "Value": "user@example.com" }';
        case StepKindId.Select:     return '{ "Selector": "#country", "Value": "US" }';
        case StepKindId.JsInline:   return '{ "Script": "document.title = \\"hi\\";" }';
        case StepKindId.Wait:       return '{ "WaitMs": 1000 }';
        case StepKindId.RunGroup:   return "(payload not used \u2014 pick a target group below)";
        case StepKindId.Hotkey:     return '{ "Keys": ["Ctrl+S","Tab","Enter"], "WaitMs": 500 }';
        case StepKindId.UrlTabClick:return "(use the URL tab click form below)";
        default:                    return "{ }";
    }
}

/**
 * Hydrate hotkey chords + waitMs from a saved PayloadJson.
 * Returns defaults when the payload is missing or malformed.
 */
function hydrateHotkeyForm(
    payloadJson: string | null,
): { chords: readonly string[]; waitMs: string } {
    if (payloadJson === null) return { chords: [], waitMs: "" };
    try {
        const parsed = JSON.parse(payloadJson) as { Keys?: unknown; WaitMs?: unknown };
        const chords = Array.isArray(parsed.Keys)
            ? parsed.Keys.filter((entry): entry is string => typeof entry === "string")
            : [];
        const waitMs = typeof parsed.WaitMs === "number" ? String(parsed.WaitMs) : "";
        return { chords, waitMs };
    } catch {
        return { chords: [], waitMs: "" };
    }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StepEditorDialog(props: StepEditorDialogProps): JSX.Element {
    const { open, mode, groups, onCancel, onSubmit } = props;

    const [kind, setKind] = useState<StepKindId>(StepKindId.Click);
    const [label, setLabel] = useState("");
    const [payloadJson, setPayloadJson] = useState("");
    const [targetGroupId, setTargetGroupId] = useState<number | null>(null);
    const [hotkeyChords, setHotkeyChords] = useState<readonly string[]>([]);
    const [hotkeyWaitMs, setHotkeyWaitMs] = useState<string>("");
    const [urlTabClick, setUrlTabClick] = useState<UrlTabClickFormState>(URL_TAB_CLICK_DEFAULTS);
    const patchUrlTabClick = (patch: Partial<UrlTabClickFormState>): void =>
        setUrlTabClick((prev) => ({ ...prev, ...patch }));

    // Reset form whenever the dialog (re-)opens with a new mode.
    useEffect(() => {
        if (!open || mode === null) return;
        if (mode.Kind === "create") {
            setKind(StepKindId.Click);
            setLabel("");
            setPayloadJson("");
            setTargetGroupId(null);
            setHotkeyChords([]);
            setHotkeyWaitMs("");
            setUrlTabClick({ ...URL_TAB_CLICK_DEFAULTS });
            return;
        }
        const step = mode.Step;
        setKind(step.StepKindId);
        setLabel(step.Label ?? "");
        setPayloadJson(step.PayloadJson ?? "");
        setTargetGroupId(step.TargetStepGroupId);
        const hotkey = step.StepKindId === StepKindId.Hotkey
            ? hydrateHotkeyForm(step.PayloadJson)
            : { chords: [], waitMs: "" };
        setHotkeyChords(hotkey.chords);
        setHotkeyWaitMs(hotkey.waitMs);
        setUrlTabClick(
            step.StepKindId === StepKindId.UrlTabClick
                ? hydrateUrlTabClickForm(step.PayloadJson)
                : { ...URL_TAB_CLICK_DEFAULTS },
        );
    }, [open, mode]);

    /**
     * Forbid self-reference and (lightly) descendant-loops at the UI
     * level by hiding the current group and its descendants from the
     * target picker.
     */
    const targetCandidates = useMemo(() => {
        if (mode === null) return groups;
        const ownerId = mode.Kind === "create" ? mode.StepGroupId : mode.Step.StepGroupId;
        const descendants = new Set<number>([ownerId]);
        let grew = true;
        while (grew) {
            grew = false;
            for (const group of groups) {
                if (
                    group.ParentStepGroupId !== null &&
                    descendants.has(group.ParentStepGroupId) &&
                    !descendants.has(group.StepGroupId)
                ) {
                    descendants.add(group.StepGroupId);
                    grew = true;
                }
            }
        }
        return groups.filter((group) => !descendants.has(group.StepGroupId) && !group.IsArchived);
    }, [groups, mode]);

    const handleSubmit = (): void => {
        let result: BuildResult;
        if (kind === StepKindId.Hotkey) {
            result = buildHotkeyPayload(label, hotkeyChords, hotkeyWaitMs);
        } else if (kind === StepKindId.UrlTabClick) {
            result = buildUrlTabClickPayload(label, urlTabClick);
        } else {
            result = buildGenericPayload(kind, label, payloadJson, targetGroupId);
        }
        if (!result.Ok) {
            if (result.ErrorDescription !== undefined) {
                toast.error(result.ErrorMessage, { description: result.ErrorDescription });
            } else {
                toast.error(result.ErrorMessage);
            }
            return;
        }
        onSubmit(result.Input);
    };

    const isEdit = mode?.Kind === "edit";

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => { if (!next) onCancel(); }}
        >
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit step" : "Add step"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Change the kind, label, or payload. Order is preserved, use the up/down buttons to move the step."
                            : "Append a new step to the end of this group."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label htmlFor="step-kind">Kind</Label>
                        <Select
                            value={String(kind)}
                            onValueChange={(value) => {
                                const nextKind = Number(value) as StepKindId;
                                setKind(nextKind);
                                if (nextKind !== StepKindId.RunGroup) setTargetGroupId(null);
                            }}
                        >
                            <SelectTrigger id="step-kind"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {KIND_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={String(option)}>
                                        {stepKindLabel(option)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="step-label">Label</Label>
                        <Input
                            id="step-label"
                            value={label}
                            maxLength={200}
                            placeholder="Optional human-readable name"
                            onChange={(event) => setLabel(event.target.value)}
                        />
                    </div>

                    <StepEditorKindBody
                        kind={kind}
                        targetGroupId={targetGroupId}
                        targetCandidates={targetCandidates}
                        onTargetGroupIdChange={setTargetGroupId}
                        hotkeyChords={hotkeyChords}
                        hotkeyWaitMs={hotkeyWaitMs}
                        onHotkeyChordsChange={setHotkeyChords}
                        onHotkeyWaitMsChange={setHotkeyWaitMs}
                        urlTabClick={urlTabClick}
                        onUrlTabClickPatch={patchUrlTabClick}
                        payloadJson={payloadJson}
                        onPayloadJsonChange={setPayloadJson}
                        payloadPlaceholder={payloadPlaceholderFor(kind)}
                    />
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleSubmit}>
                        {isEdit
                            ? <><Save className="mr-1 h-4 w-4" /> Save</>
                            : <><Plus className="mr-1 h-4 w-4" /> Add step</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


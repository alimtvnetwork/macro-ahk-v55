/**
 * Marco Extension, Keyword Events, Target Picker Row
 *
 * Compact row inside `KeywordEventCard` that selects the dispatch target
 * (active element, `document.body`, or a CSS selector). Extracted from
 * `KeywordEventsPanel.tsx` in Plan 25 step 12: the inline version was 97
 * lines with CC 18. Splitting the kind-selector, the selector input, and
 * the non-selector hint into three leaves keeps every function under both
 * ceilings.
 */

import type { JSX } from "react";
import { Crosshair, Keyboard, Target } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { KeywordEventTarget } from "@/hooks/use-keyword-events";
import { cn } from "@/lib/utils";
import { classifySelector, type SelectorStatus } from "./target-picker-status";

const CSS_INPUT_INVALID = "border-destructive focus-visible:ring-destructive";

export interface TargetPickerRowProps {
    readonly eventId: string;
    readonly value: KeywordEventTarget;
    readonly onChange: (next: KeywordEventTarget) => void;
}

function KindSelector(props: {
    eventId: string;
    kind: string;
    onKindChange: (raw: string) => void;
}): JSX.Element {
    const { eventId, kind, onKindChange } = props;
    return (
        <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs font-medium">Dispatch target</Label>
            <Select value={kind} onValueChange={onKindChange}>
                <SelectTrigger
                    className="h-7 w-44 text-xs ml-auto"
                    data-testid={`keyword-event-target-kind-${eventId}`}
                    aria-label="Dispatch target"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ActiveElement">
                        <span className="inline-flex items-center gap-2">
                            <Crosshair className="h-3 w-3" /> Active element
                        </span>
                    </SelectItem>
                    <SelectItem value="Body">
                        <span className="inline-flex items-center gap-2">
                            <Target className="h-3 w-3" /> document.body
                        </span>
                    </SelectItem>
                    <SelectItem value="Selector">
                        <span className="inline-flex items-center gap-2">
                            <Keyboard className="h-3 w-3" /> CSS selector…
                        </span>
                    </SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}

function SelectorHint(props: { status: SelectorStatus }): JSX.Element {
    const { status } = props;
    if (status === "invalid") {
        return <p className="text-[10px] text-destructive">Invalid CSS selector, playback will fall back to document.body.</p>;
    }
    if (status === "no-match") {
        return <p className="text-[10px] text-amber-500">No element matches yet, playback will fall back to document.body if still unmatched.</p>;
    }
    if (status === "match") {
        return <p className="text-[10px] text-emerald-500">Matches an element on the current page.</p>;
    }
    return <p className="text-[10px] text-muted-foreground">Enter a CSS selector for the dispatch target.</p>;
}

function SelectorInputRow(props: {
    eventId: string;
    selectorText: string;
    status: SelectorStatus;
    onChange: (next: KeywordEventTarget) => void;
}): JSX.Element {
    const { eventId, selectorText, status, onChange } = props;
    return (
        <div className="space-y-1">
            <Input
                value={selectorText}
                onChange={(e) => onChange({ Kind: "Selector", Selector: e.target.value })}
                placeholder="#chat-input, textarea[name='msg'], …"
                className={cn(
                    "h-7 text-xs font-mono",
                    status === "invalid" && CSS_INPUT_INVALID,
                    status === "no-match" && "border-amber-500/60",
                    status === "match" && "border-emerald-500/60",
                )}
                aria-label="CSS selector for dispatch target"
                aria-invalid={status === "invalid" ? true : undefined}
                data-testid={`keyword-event-target-selector-${eventId}`}
                data-status={status}
            />
            <SelectorHint status={status} />
        </div>
    );
}

function NonSelectorHint(props: { kind: "ActiveElement" | "Body" }): JSX.Element {
    return (
        <p className="text-[10px] text-muted-foreground">
            {props.kind === "ActiveElement"
                ? "Dispatches on whichever element has focus when playback runs."
                : "Dispatches directly on document.body, useful for global hotkey listeners."}
        </p>
    );
}

export function TargetPickerRow(props: TargetPickerRowProps): JSX.Element {
    const { eventId, value, onChange } = props;
    const isSelector = value.Kind === "Selector";
    const selectorText = isSelector ? value.Selector : "";

    const handleKindChange = (raw: string): void => {
        if (raw === "ActiveElement" || raw === "Body") {
            onChange({ Kind: raw });
            return;
        }
        if (raw === "Selector") {
            onChange({ Kind: "Selector", Selector: selectorText });
        }
    };

    const status = classifySelector(value.Kind, selectorText);

    return (
        <div
            className="rounded border border-border/60 bg-muted/20 p-2 space-y-1.5"
            data-testid={`keyword-event-target-${eventId}`}
        >
            <KindSelector eventId={eventId} kind={value.Kind} onKindChange={handleKindChange} />
            {isSelector
                ? <SelectorInputRow eventId={eventId} selectorText={selectorText} status={status} onChange={onChange} />
                : <NonSelectorHint kind={value.Kind as "ActiveElement" | "Body"} />}
        </div>
    );
}

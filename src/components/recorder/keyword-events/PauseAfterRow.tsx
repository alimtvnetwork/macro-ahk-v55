/**
 * Marco Extension, Keyword Events, Pause After Row
 *
 * Per-event pause override extracted from `KeywordEventsPanel.tsx` in
 * Plan 25 step 13 (was 94-line inline function). Splits the enabled body,
 * disabled body, and draft-parsing hook into leaves so the shell stays
 * under the `max-lines-per-function` ceiling.
 */

import { useEffect, useRef, useState, type JSX } from "react";
import { Clock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_CHAIN_SETTINGS } from "@/lib/keyword-event-chain";
import { cn } from "@/lib/utils";

const CSS_INPUT_INVALID = "border-destructive focus-visible:ring-destructive";
const PAUSE_OVERRIDE_MIN = 0;
const PAUSE_OVERRIDE_MAX = 60_000;

export interface PauseAfterRowProps {
    readonly eventId: string;
    readonly value: number | undefined;
    readonly onChange: (next: number | undefined) => void;
}

interface DraftState {
    readonly draft: string;
    readonly draftValid: boolean;
    readonly parsed: number;
    readonly setDraft: (raw: string) => void;
}

function usePauseDraft(value: number | undefined, enabled: boolean): DraftState {
    const draftRef = useRef<string>(enabled ? String(value) : String(DEFAULT_CHAIN_SETTINGS.PauseMs));
    const [draft, setDraft] = useState<string>(draftRef.current);

    useEffect(() => {
        if (enabled && String(value) !== draftRef.current) {
            draftRef.current = String(value);
            setDraft(draftRef.current);
        }
    }, [enabled, value]);

    const parsed = Number(draft);
    const draftValid = draft.trim() !== ""
        && !Number.isNaN(parsed)
        && Number.isFinite(parsed)
        && parsed >= PAUSE_OVERRIDE_MIN
        && parsed <= PAUSE_OVERRIDE_MAX;

    return {
        draft,
        draftValid,
        parsed,
        setDraft: (raw) => { draftRef.current = raw; setDraft(raw); },
    };
}

function EnabledBody(props: {
    eventId: string;
    draft: string;
    draftValid: boolean;
    onDraftChange: (raw: string) => void;
}): JSX.Element {
    const { eventId, draft, draftValid, onDraftChange } = props;
    return (
        <div className="flex items-center gap-2">
            <Input
                type="number"
                min={PAUSE_OVERRIDE_MIN}
                max={PAUSE_OVERRIDE_MAX}
                step={50}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                className={cn("h-7 w-24 text-xs", !draftValid && CSS_INPUT_INVALID)}
                aria-label="Pause after this event in milliseconds"
                aria-invalid={!draftValid ? true : undefined}
                data-testid={`keyword-event-pause-after-input-${eventId}`}
            />
            <span className="text-[10px] text-muted-foreground">ms</span>
            <p className="text-[10px] text-muted-foreground ml-auto max-w-xs text-right">
                {draftValid
                    ? "Replaces the chain's global pause for the gap after this event."
                    : `Enter a number between ${PAUSE_OVERRIDE_MIN} and ${PAUSE_OVERRIDE_MAX}.`}
            </p>
        </div>
    );
}
function PauseAfterHeader(props: {
    eventId: string;
    enabled: boolean;
    onToggle: (checked: boolean) => void;
}): JSX.Element {
    const { eventId, enabled, onToggle } = props;
    return (
        <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <Label
                htmlFor={`kev-pause-toggle-${eventId}`}
                className="text-xs font-medium cursor-pointer"
            >
                Override chain pause after this event
            </Label>
            <Switch
                id={`kev-pause-toggle-${eventId}`}
                checked={enabled}
                onCheckedChange={onToggle}
                aria-label="Override chain pause after this event"
                data-testid={`keyword-event-pause-after-toggle-${eventId}`}
                className="ml-auto"
            />
        </div>
    );
}


export function PauseAfterRow(props: PauseAfterRowProps): JSX.Element {
    const { eventId, value, onChange } = props;
    const enabled = typeof value === "number" && Number.isFinite(value) && value >= 0;
    const { draft, draftValid, parsed, setDraft } = usePauseDraft(value, enabled);

    const handleToggle = (checked: boolean): void => {
        if (!checked) {
            onChange(undefined);
            return;
        }
        const restore = draftValid ? Math.floor(parsed) : DEFAULT_CHAIN_SETTINGS.PauseMs;
        setDraft(String(restore));
        onChange(restore);
    };

    const handleDraftChange = (raw: string): void => {
        setDraft(raw);
        if (!enabled) { return; }
        const n = Number(raw);
        if (raw.trim() === "" || Number.isNaN(n) || !Number.isFinite(n)) { return; }
        const clamped = Math.max(PAUSE_OVERRIDE_MIN, Math.min(PAUSE_OVERRIDE_MAX, Math.floor(n)));
        setDraft(String(clamped));
        onChange(clamped);
    };

    return (
        <div
            className={cn(
                "rounded border border-border/60 bg-muted/20 p-2 space-y-1.5",
                enabled && "border-primary/40",
            )}
            data-testid={`keyword-event-pause-after-${eventId}`}
            data-enabled={enabled ? "true" : "false"}
        >
            <PauseAfterHeader eventId={eventId} enabled={enabled} onToggle={handleToggle} />
            {enabled
                ? <EnabledBody eventId={eventId} draft={draft} draftValid={draftValid} onDraftChange={handleDraftChange} />
                : <p className="text-[10px] text-muted-foreground">Off, uses the chain's global pause setting.</p>}
        </div>
    );
}

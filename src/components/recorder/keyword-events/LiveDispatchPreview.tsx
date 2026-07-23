/**
 * Marco Extension, Keyword Events, Live Dispatch Preview
 *
 * Pill rendered beneath the card header while playback is running. Shows
 * the modifiers + key currently being dispatched (or the wait duration when
 * the active step is a Wait), plus a step counter so the user can correlate
 * with the step list below.
 *
 * Extracted from `KeywordEventsPanel.tsx` (Plan 25 step 11). The old inline
 * function was 74 lines; splitting the two `preview.Kind` branches into
 * `KeyPreviewBody` + `WaitPreviewBody` keeps every function under the
 * `max-lines-per-function` ceiling.
 */

import type { JSX } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KeywordEventStep } from "@/hooks/use-keyword-events";
import {
    buildDispatchPreview,
    previewToString,
    type DispatchPreview,
} from "@/lib/keyword-event-dispatch-preview";

export interface LiveDispatchPreviewProps {
    readonly eventId: string;
    readonly step: KeywordEventStep;
    readonly stepIndex: number;
    readonly totalSteps: number;
}

function KeyPreviewBody(props: {
    eventId: string;
    preview: Extract<DispatchPreview, { Kind: "Key" }>;
}): JSX.Element {
    const { eventId, preview } = props;
    return (
        <div
            className="flex items-center gap-1 flex-wrap"
            data-testid={`keyword-event-live-preview-keys-${eventId}`}
        >
            {preview.Modifiers.map((mod) => (
                <kbd
                    key={mod}
                    className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px] shadow-sm"
                    data-testid={`keyword-event-live-preview-mod-${eventId}-${mod}`}
                >
                    {mod}
                </kbd>
            ))}
            {preview.Modifiers.length > 0 && preview.HasKey && (
                <span className="text-muted-foreground text-[10px]">+</span>
            )}
            {preview.HasKey ? (
                <kbd
                    className="px-1.5 py-0.5 rounded bg-primary/20 border border-primary/50 font-mono text-[10px] text-primary-foreground shadow-sm"
                    data-testid={`keyword-event-live-preview-key-${eventId}`}
                >
                    {preview.Key}
                </kbd>
            ) : (
                <span
                    className="text-[10px] italic text-destructive"
                    data-testid={`keyword-event-live-preview-empty-${eventId}`}
                >
                    (no key)
                </span>
            )}
        </div>
    );
}

function WaitPreviewBody(props: {
    eventId: string;
    preview: Extract<DispatchPreview, { Kind: "Wait" }>;
}): JSX.Element {
    const { eventId, preview } = props;
    return (
        <div
            className="flex items-center gap-1.5"
            data-testid={`keyword-event-live-preview-wait-${eventId}`}
        >
            <Clock className="h-3 w-3 text-primary" />
            <span className="font-mono text-[11px]">
                Wait <strong>{preview.DurationMs}</strong> ms
            </span>
        </div>
    );
}

export function LiveDispatchPreview(props: LiveDispatchPreviewProps): JSX.Element {
    const { eventId, step, stepIndex, totalSteps } = props;
    const preview: DispatchPreview = buildDispatchPreview(step);
    const ariaLabel = `Now dispatching: ${previewToString(preview)}`;

    return (
        <div
            className={cn(
                "flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10",
                "px-2.5 py-1.5 text-xs animate-in fade-in slide-in-from-top-1",
            )}
            role="status"
            aria-live="polite"
            aria-label={ariaLabel}
            data-testid={`keyword-event-live-preview-${eventId}`}
            data-step-index={stepIndex}
            data-step-kind={preview.Kind}
        >
            <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                Dispatching
            </span>
            {preview.Kind === "Key"
                ? <KeyPreviewBody eventId={eventId} preview={preview} />
                : <WaitPreviewBody eventId={eventId} preview={preview} />}
            <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                Step {stepIndex + 1} / {totalSteps}
            </span>
        </div>
    );
}

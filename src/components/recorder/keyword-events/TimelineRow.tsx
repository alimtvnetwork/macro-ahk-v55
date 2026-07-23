/**
 * Marco Extension, Keyword Events, Timeline Row
 *
 * Renders a single {@link TimelineEntry} produced by the chain runner.
 * Extracted from `KeywordEventsPanel.tsx` (Plan 25 step 10) to keep the
 * discriminated-union render under the cognitive-complexity ceiling: the
 * `TimelineRow` shell dispatches to one leaf renderer per `Kind`, so no
 * single function exceeds the 15-branch budget.
 */

import type { JSX } from "react";
import { CheckCircle2, Circle, Play, Square, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineEntry } from "@/lib/keyword-event-chain-timeline";
import { formatOffset } from "./timeline-format";

const CSS_TEXT_DESTRUCTIVE = "text-destructive";


export interface TimelineRowProps {
    readonly entry: TimelineEntry;
}

function EventStartRow(props: { entry: Extract<TimelineEntry, { Kind: "EventStart" }> }): JSX.Element {
    const { entry } = props;
    return (
        <div className="flex items-start gap-2 text-foreground" data-testid="timeline-event-start">
            <span className="text-muted-foreground tabular-nums">{formatOffset(entry.AtMs)}</span>
            <Play className="h-3 w-3 mt-0.5 text-primary shrink-0" />
            <span className="truncate">
                <span className="text-muted-foreground">[{entry.Index + 1}/{entry.Total}]</span>{" "}
                <span className="font-semibold">{entry.Keyword}</span>
            </span>
        </div>
    );
}

function StepRow(props: { entry: Extract<TimelineEntry, { Kind: "Step" }> }): JSX.Element {
    const { entry } = props;
    return (
        <div className="flex items-start gap-2 text-muted-foreground pl-3" data-testid="timeline-step">
            <span className="tabular-nums">{formatOffset(entry.AtMs)}</span>
            <Circle className="h-2.5 w-2.5 mt-1 text-muted-foreground/70 shrink-0" />
            <span className="truncate">
                <span className="opacity-70">#{entry.StepIndex + 1}</span> {entry.Label}
            </span>
        </div>
    );
}

function eventEndTone(entry: Extract<TimelineEntry, { Kind: "EventEnd" }>): { tone: string; label: string; Icon: typeof CheckCircle2 } {
    if (entry.Aborted) return { tone: CSS_TEXT_DESTRUCTIVE, label: "aborted", Icon: XCircle };
    if (entry.Completed) return { tone: "text-emerald-500", label: "done", Icon: CheckCircle2 };
    return { tone: CSS_TEXT_DESTRUCTIVE, label: "failed", Icon: XCircle };
}

function EventEndRow(props: { entry: Extract<TimelineEntry, { Kind: "EventEnd" }> }): JSX.Element {
    const { entry } = props;
    const { tone, label, Icon } = eventEndTone(entry);
    return (
        <div className="flex items-start gap-2" data-testid="timeline-event-end">
            <span className="text-muted-foreground tabular-nums">{formatOffset(entry.AtMs)}</span>
            <Icon className={cn("h-3 w-3 mt-0.5 shrink-0", tone)} />
            <span className={cn("truncate", tone)}>
                <span className="font-semibold">{entry.Keyword}</span> {label}
            </span>
        </div>
    );
}

function ChainEndRow(props: { entry: Extract<TimelineEntry, { Kind: "ChainEnd" }> }): JSX.Element {
    const { entry } = props;
    const tone = entry.Aborted ? CSS_TEXT_DESTRUCTIVE : "text-emerald-500";
    return (
        <div className="flex items-start gap-2 mt-1" data-testid="timeline-chain-end">
            <span className="text-muted-foreground tabular-nums">{formatOffset(entry.AtMs)}</span>
            <Square className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
            <span className={cn("truncate font-semibold", tone)}>
                Chain {entry.Aborted ? "aborted" : "complete"}, {entry.Completed}/{entry.Attempted}
            </span>
        </div>
    );
}

export function TimelineRow(props: TimelineRowProps): JSX.Element {
    const { entry } = props;
    if (entry.Kind === "EventStart") return <EventStartRow entry={entry} />;
    if (entry.Kind === "Step") return <StepRow entry={entry} />;
    if (entry.Kind === "EventEnd") return <EventEndRow entry={entry} />;
    return <ChainEndRow entry={entry} />;
}

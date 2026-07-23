/**
 * Marco Extension: Chain timeline log
 *
 * Live-updating scroll log rendered under {@link ChainSettingsRow} during a
 * keyword-event chain run. Extracted from `KeywordEventsPanel.tsx` in Plan 25
 * Step 16 so the panel host drops below 300 lines and the log's autoscroll
 * effect can be unit-tested in isolation.
 */

import { useEffect, useRef } from "react";
import { ListOrdered } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { type TimelineState } from "@/lib/keyword-event-chain-timeline";
import { TimelineRow } from "./TimelineRow";

export interface ChainTimelineLogProps {
    readonly timeline: TimelineState;
    readonly running: boolean;
}

export function ChainTimelineLog(props: ChainTimelineLogProps): JSX.Element | null {
    const { timeline, running } = props;
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!running) { return; }
        const scroller = scrollerRef.current;
        if (scroller === null) { return; }
        scroller.scrollTop = scroller.scrollHeight;
    }, [running, timeline.Entries.length]);

    if (timeline.StartedAtMs === null && timeline.Entries.length === 0) {
        return null;
    }

    return (
        <div
            className="rounded-md border border-border bg-muted/20 p-2 space-y-1.5"
            data-testid="keyword-event-chain-timeline"
        >
            <div className="flex items-center gap-2 px-1">
                <ListOrdered className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                    Chain timeline
                </span>
                {running && (
                    <Badge
                        variant="outline"
                        className="text-[9px] border-primary/60 text-primary animate-pulse ml-1"
                    >
                        Live
                    </Badge>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                    {timeline.Entries.length} {timeline.Entries.length === 1 ? "entry" : "entries"}
                </span>
            </div>
            <div
                ref={scrollerRef}
                className="max-h-32 overflow-y-auto rounded bg-background/50 px-2 py-1.5 font-mono text-[11px] leading-5"
                data-testid="keyword-event-chain-timeline-scroll"
            >
                {timeline.Entries.map((entry) => (
                    <TimelineRow key={entry.Id} entry={entry} />
                ))}
            </div>
        </div>
    );
}

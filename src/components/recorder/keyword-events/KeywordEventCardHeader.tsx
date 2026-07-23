/**
 * Header row for a single {@link KeywordEventCard}: drag handle, selection
 * checkbox, keyword input, enable switch, run/stop button, remove button.
 *
 * Extracted from `KeywordEventsPanel.tsx` in Plan 25 Step 14 to drop the
 * card body under the `max-lines-per-function` / cognitive-complexity
 * ceilings. Pure presentational; all state lives in the parent card.
 */

import { Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { KeywordEvent } from "@/hooks/use-keyword-events";

export interface KeywordEventCardHeaderProps {
    readonly event: KeywordEvent;
    readonly isRunning: boolean;
    readonly runnable: boolean;
    readonly runDisabledReason: string | null;
    readonly dragHandle?: React.ReactNode;
    readonly selected?: boolean;
    readonly onToggleSelect?: (checked: boolean, mouseEvent?: React.MouseEvent<HTMLButtonElement>) => void;
    readonly onUpdate: (patch: Partial<Omit<KeywordEvent, "Id">>) => void;
    readonly onPlay: () => void;
    readonly onCancel: () => void;
    readonly onRemove: () => void;
}

// eslint-disable-next-line max-lines-per-function -- JSX-heavy leaf; Plan 25 Step 14
export function KeywordEventCardHeader(props: KeywordEventCardHeaderProps): JSX.Element {
    const {
        event, isRunning, runnable, runDisabledReason,
        dragHandle, selected, onToggleSelect,
        onUpdate, onPlay, onCancel, onRemove,
    } = props;
    return (
        <div className="flex items-center gap-2">
            {dragHandle}
            {onToggleSelect && (
                <Checkbox
                    checked={!!selected}
                    onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onToggleSelect(!selected, clickEvent as React.MouseEvent<HTMLButtonElement>);
                    }}
                    aria-label={`Select ${event.Keyword}`}
                    data-testid={`keyword-event-select-${event.Id}`}
                />
            )}
            <Input
                value={event.Keyword}
                onChange={(inputEvent) => onUpdate({ Keyword: inputEvent.target.value })}
                className="h-8 font-medium"
                aria-label="Keyword"
            />
            <div className="flex items-center gap-1.5">
                <Switch
                    checked={event.Enabled}
                    onCheckedChange={(value) => onUpdate({ Enabled: value })}
                    aria-label="Enabled"
                />
                <Label className="text-xs text-muted-foreground">{event.Enabled ? "On" : "Off"}</Label>
            </div>
            {isRunning ? (
                <Button
                    size="sm"
                    variant="destructive"
                    className="h-8"
                    onClick={onCancel}
                    data-testid={`keyword-event-stop-${event.Id}`}
                    aria-label="Stop keyword event playback"
                >
                    <Square className="h-3.5 w-3.5 mr-1" /> Stop
                </Button>
            ) : (
                <Button
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    onClick={onPlay}
                    disabled={!runnable}
                    data-testid={`keyword-event-play-${event.Id}`}
                    aria-label="Run keyword event"
                    title={runDisabledReason ?? "Run this keyword event"}
                >
                    <Play className="h-3.5 w-3.5 mr-1" /> Run
                </Button>
            )}
            <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                onClick={onRemove}
                aria-label="Remove keyword event"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}

/**
 * Toolbar summarising the current keyword-event selection. Extracted from
 * `KeywordEventsPanel.tsx` in Plan 25 Step 15.
 */

import { Button } from "@/components/ui/button";

export interface KeywordEventsSelectionToolbarProps {
    readonly count: number;
    readonly onClear: () => void;
}

export function KeywordEventsSelectionToolbar(props: KeywordEventsSelectionToolbarProps): JSX.Element | null {
    const { count, onClear } = props;
    if (count === 0) { return null; }
    return (
        <div
            className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs"
            data-testid="keyword-events-selection-toolbar"
        >
            <span className="font-medium" data-testid="keyword-events-selection-count">
                {count} selected
            </span>
            <span className="text-muted-foreground">
                Shift-click to extend · Ctrl/Cmd-click to toggle
            </span>
            <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-6 px-2 text-xs"
                onClick={onClear}
                data-testid="keyword-events-selection-clear"
            >
                Clear
            </Button>
        </div>
    );
}

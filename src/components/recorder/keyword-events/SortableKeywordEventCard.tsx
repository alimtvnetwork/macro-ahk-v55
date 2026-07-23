/**
 * Wraps {@link KeywordEventCard} with `useSortable` so the parent list can
 * render it inside a `SortableContext`. Extracted from
 * `KeywordEventsPanel.tsx` in Plan 25 Step 15.
 */

import { GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { KeywordEventCard, type KeywordEventCardProps } from "./KeywordEventCard";

export function SortableKeywordEventCard(props: KeywordEventCardProps): JSX.Element {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: props.event.Id,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : undefined,
    };

    const handle = (
        <button
            type="button"
            className={cn(
                "shrink-0 inline-flex items-center justify-center h-8 w-6 rounded",
                "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                "cursor-grab active:cursor-grabbing touch-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
            aria-label={`Drag to reorder ${props.event.Keyword}`}
            data-testid={`keyword-event-drag-handle-${props.event.Id}`}
            {...attributes}
            {...listeners}
        >
            <GripVertical className="h-4 w-4" />
        </button>
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            data-testid={`keyword-event-sortable-${props.event.Id}`}
            data-dragging={isDragging ? "true" : undefined}
        >
            <KeywordEventCard {...props} dragHandle={handle} />
        </div>
    );
}

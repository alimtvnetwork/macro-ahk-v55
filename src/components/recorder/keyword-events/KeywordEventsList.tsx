/**
 * DnD-enabled sortable list of keyword-event cards. Extracted from
 * `KeywordEventsPanel.tsx` in Plan 25 Step 15 so the editor host stays
 * under the `max-lines-per-function` ceiling.
 */

import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { KeywordEvent, KeywordEventStep } from "@/hooks/use-keyword-events";
import { KeywordEventBulkContextMenu } from "../KeywordEventBulkContextMenu";
import { SortableKeywordEventCard } from "./SortableKeywordEventCard";

const NOOP_DRAG_HANDLER = (): void => { /* drag-reorder disabled while filtering */ };

export interface KeywordEventsListProps {
    readonly visibleEvents: readonly KeywordEvent[];
    readonly allEvents: readonly KeywordEvent[];
    readonly isFiltering: boolean;
    readonly selection: {
        readonly isSelected: (id: string) => boolean;
        readonly handleClick: (id: string, mods: { shiftKey: boolean; toggleKey: boolean }) => void;
        readonly clear: () => void;
    };
    readonly playback: {
        readonly isRunning: (id: string) => boolean;
        readonly currentStepIndex: number | null;
        readonly play: (entry: KeywordEvent) => unknown;
        readonly cancel: () => void;
    };
    readonly onRowClick: (id: string, mouseEvent: React.MouseEvent) => void;
    readonly onReorder: (activeId: string, overId: string) => void;
    readonly onUpdateEvent: (id: string, patch: Partial<Omit<KeywordEvent, "Id">>) => void;
    readonly onRemoveEvent: (id: string) => void;
    readonly onAddStep: (eventId: string, step: Omit<KeywordEventStep, "Id">) => void;
    readonly onRemoveStep: (eventId: string, stepId: string) => void;
    readonly onMoveStep: (eventId: string, stepId: string, dir: "up" | "down") => void;
    readonly onRemoveSteps: (eventId: string, stepIds: readonly string[]) => void;
    readonly onSetStepsEnabled: (eventId: string, stepIds: readonly string[], enabled: boolean) => void;
    readonly onRelabelSteps: (eventId: string, stepIds: readonly string[], labels: readonly string[]) => void;
}

// eslint-disable-next-line max-lines-per-function -- JSX-heavy leaf; Plan 25 Step 15
export function KeywordEventsList(props: KeywordEventsListProps): JSX.Element {
    const {
        visibleEvents, allEvents, isFiltering, selection, playback,
        onRowClick, onReorder,
        onUpdateEvent, onRemoveEvent, onAddStep, onRemoveStep, onMoveStep,
        onRemoveSteps, onSetStepsEnabled, onRelabelSteps,
    } = props;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = (dragEvent: DragEndEvent): void => {
        const { active, over } = dragEvent;
        if (!over || active.id === over.id) { return; }
        onReorder(String(active.id), String(over.id));
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={isFiltering ? NOOP_DRAG_HANDLER : handleDragEnd}
        >
            <SortableContext
                items={visibleEvents.map((entry) => entry.Id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-3" data-testid="keyword-events-sortable-list">
                    {visibleEvents.map((entry) => {
                        const isSelected = selection.isSelected(entry.Id);
                        const selectedForMenu = isSelected
                            ? allEvents.filter((candidate) => selection.isSelected(candidate.Id))
                            : [entry];
                        return (
                            <KeywordEventBulkContextMenu
                                key={entry.Id}
                                isRowSelected={isSelected}
                                selectedEvents={selectedForMenu}
                                allEvents={allEvents}
                                onContextOpenForUnselected={() => {
                                    selection.handleClick(entry.Id, { shiftKey: false, toggleKey: false });
                                }}
                                onUpdateEvent={(id, patch) => onUpdateEvent(id, patch)}
                                onRemoveEvent={(id) => onRemoveEvent(id)}
                                onClearSelection={selection.clear}
                            >
                                <div>
                                    <SortableKeywordEventCard
                                        event={entry}
                                        isRunning={playback.isRunning(entry.Id)}
                                        currentStepIndex={playback.isRunning(entry.Id) ? playback.currentStepIndex : null}
                                        selected={isSelected}
                                        onRowClick={(clickEvent) => onRowClick(entry.Id, clickEvent)}
                                        onToggleSelect={(checked, clickEvent) => {
                                            if (clickEvent && clickEvent.shiftKey) {
                                                selection.handleClick(entry.Id, { shiftKey: true, toggleKey: false });
                                            } else {
                                                selection.handleClick(entry.Id, { shiftKey: false, toggleKey: true });
                                            }
                                            void checked;
                                        }}
                                        onPlay={() => { void playback.play(entry); }}
                                        onCancel={playback.cancel}
                                        onRemove={() => onRemoveEvent(entry.Id)}
                                        onUpdate={(patch) => onUpdateEvent(entry.Id, patch)}
                                        onAddStep={(step) => onAddStep(entry.Id, step)}
                                        onRemoveStep={(sid) => onRemoveStep(entry.Id, sid)}
                                        onMoveStep={(sid, dir) => onMoveStep(entry.Id, sid, dir)}
                                        onRemoveSteps={(eid, sids) => onRemoveSteps(eid, sids)}
                                        onSetStepsEnabled={(eid, sids, en) => onSetStepsEnabled(eid, sids, en)}
                                        onRelabelSteps={(eid, sids, labels) => onRelabelSteps(eid, sids, labels)}
                                    />
                                </div>
                            </KeywordEventBulkContextMenu>
                        );
                    })}
                </div>
            </SortableContext>
        </DndContext>
    );
}

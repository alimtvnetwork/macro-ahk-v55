/**
 * Marco Extension — Keyword Events Panel
 *
 * UI for managing custom keyword events that fire scripted key presses and
 * wait periods during recorder playback. Backed by {@link useKeywordEvents}
 * (localStorage-persisted). Pure presentational; mounted from the recorder
 * surface via a Dialog trigger.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Link2, ListOrdered, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    modifiersFromMouseEvent,
    useShiftClickSelection,
} from "@/hooks/use-shift-click-selection";
import { useKeywordEvents } from "@/hooks/use-keyword-events";
import { useKeywordEventPlayback } from "@/hooks/use-keyword-event-playback";
import { useRecordingSession } from "@/hooks/use-recording-session";
import { useAutoRunChainAfterRecording } from "@/hooks/use-auto-run-chain-after-recording";
import { filterKeywordEvents } from "@/lib/keyword-event-search";
import {
    loadChainSettings,
    saveChainSettings,
    type KeywordEventChainSettings,
} from "@/lib/keyword-event-chain";
import { isEventRunnable } from "@/lib/keyword-event-validation";
import {
    describeRunShortcut,
    describeStopShortcut,
    matchChainShortcut,
} from "@/lib/keyword-event-chain-shortcuts";
import { cn } from "@/lib/utils";
import { KeywordEventsList } from "./keyword-events/KeywordEventsList";
import { useKeywordEventChainRunner } from "./keyword-events/use-keyword-event-chain-runner";
import { KeywordEventsAddRow } from "./keyword-events/KeywordEventsAddRow";
import { KeywordEventsSearchRow } from "./keyword-events/KeywordEventsSearchRow";
import { KeywordEventsSelectionToolbar } from "./keyword-events/KeywordEventsSelectionToolbar";
import { ChainSettingsRow } from "./keyword-events/ChainSettingsRow";
import { ChainTimelineLog } from "./keyword-events/ChainTimelineLog";


export interface KeywordEventsPanelProps {
    readonly trigger?: React.ReactNode;
    readonly className?: string;
}

export function KeywordEventsPanel(props: KeywordEventsPanelProps): JSX.Element {
    const { trigger, className } = props;
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button
                        size="sm"
                        variant="outline"
                        className={cn("h-8 px-3", className)}
                        data-testid="keyword-events-open"
                    >
                        <Keyboard className="h-3.5 w-3.5 mr-1" />
                        Keyword Events
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Custom Keyword Events</DialogTitle>
                    <DialogDescription>
                        Attach keywords that trigger scripted key presses and wait periods during playback.
                    </DialogDescription>
                </DialogHeader>
                <KeywordEventsEditor />
            </DialogContent>
        </Dialog>
    );
}

// eslint-disable-next-line max-lines-per-function -- composition of extracted rows; Plan 25 Step 15
function KeywordEventsEditor(): JSX.Element {
    const api = useKeywordEvents();
    const playback = useKeywordEventPlayback();
    const [newKeyword, setNewKeyword] = useState("");
    const [search, setSearch] = useState("");

    const visibleEvents = useMemo(
        () => filterKeywordEvents(api.events, search),
        [api.events, search],
    );
    const isFiltering = search.trim().length > 0;

    const [chain, setChain] = useState<KeywordEventChainSettings>(() => loadChainSettings());
    useEffect(() => { saveChainSettings(chain); }, [chain]);

    const chainRunner = useKeywordEventChainRunner({ events: api.events, chain });

    const { session: recordingSession } = useRecordingSession();
    const [autoRunActive, setAutoRunActive] = useState<boolean>(false);
    useAutoRunChainAfterRecording({
        settings: chain,
        events: api.events,
        session: recordingSession,
        onAutoRunStart: () => { setAutoRunActive(true); },
        onAutoRunEnd: () => { setAutoRunActive(false); },
    });

    const enabledCount = api.events.filter((entry) => isEventRunnable(entry)).length;

    const eventIds = api.events.map((entry) => entry.Id);
    const eventSelection = useShiftClickSelection(eventIds);
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
    const handleEventRowClick = (id: string, mouseEvent: React.MouseEvent): void => {
        const tag = (mouseEvent.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "button" || tag === "textarea" || tag === "select" || tag === "label") return;
        if ((mouseEvent.target as HTMLElement | null)?.closest("button,input,textarea,select,label,[role=switch],[role=combobox]")) return;
        eventSelection.handleClick(id, modifiersFromMouseEvent(mouseEvent.nativeEvent, isMac));
    };

    const handleAdd = (): void => {
        const trimmed = newKeyword.trim();
        if (!trimmed) return;
        api.addEvent(trimmed);
        setNewKeyword("");
    };

    const runShortcutLabel = describeRunShortcut();
    const stopShortcutLabel = describeStopShortcut();
    const handlePanelKeyDown = (keyEvent: React.KeyboardEvent<HTMLDivElement>): void => {
        const action = matchChainShortcut(
            {
                key: keyEvent.key,
                ctrlKey: keyEvent.ctrlKey,
                metaKey: keyEvent.metaKey,
                altKey: keyEvent.altKey,
                shiftKey: keyEvent.shiftKey,
                target: keyEvent.target,
            },
            { chainRunning: chainRunner.running, enabledCount },
        );
        if (action === null) { return; }
        keyEvent.preventDefault();
        keyEvent.stopPropagation();
        if (action === "run") { void chainRunner.run(); }
        else { chainRunner.cancel(); }
    };

    return (
        <div
            className="space-y-3"
            data-testid="keyword-events-panel"
            onKeyDown={handlePanelKeyDown}
        >
            <KeywordEventsAddRow value={newKeyword} onChange={setNewKeyword} onAdd={handleAdd} />

            <KeywordEventsSearchRow value={search} onChange={setSearch} />


            <ChainSettingsRow
                settings={chain}
                onChange={setChain}
                enabledCount={enabledCount}
                running={chainRunner.running}
                progress={chainRunner.progress}
                autoRunActive={autoRunActive}
                runShortcutLabel={runShortcutLabel}
                stopShortcutLabel={stopShortcutLabel}
                onRun={() => { void chainRunner.run(); }}
                onCancel={chainRunner.cancel}
            />

            <ChainTimelineLog timeline={chainRunner.timeline} running={chainRunner.running} />

            <Separator />

            <KeywordEventsSelectionToolbar
                count={eventSelection.selected.size}
                onClear={eventSelection.clear}
            />

            <ScrollArea className="h-[380px] pr-3">
                {api.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">
                        No keyword events yet. Add one above to script key presses and waits.
                    </p>
                ) : visibleEvents.length === 0 ? (
                    <p
                        className="text-sm text-muted-foreground text-center py-12"
                        data-testid="keyword-events-search-empty"
                    >
                        No events match “{search.trim()}”.
                    </p>
                ) : (
                    <KeywordEventsList
                        visibleEvents={visibleEvents}
                        allEvents={api.events}
                        isFiltering={isFiltering}
                        selection={eventSelection}
                        playback={playback}
                        onRowClick={handleEventRowClick}
                        onReorder={(activeId, overId) => api.reorderEvents(activeId, overId)}
                        onUpdateEvent={(id, patch) => api.updateEvent(id, patch)}
                        onRemoveEvent={(id) => api.removeEvent(id)}
                        onAddStep={(id, step) => api.addStep(id, step)}
                        onRemoveStep={(id, sid) => api.removeStep(id, sid)}
                        onMoveStep={(id, sid, dir) => api.moveStep(id, sid, dir)}
                        onRemoveSteps={(id, sids) => api.removeSteps(id, sids)}
                        onSetStepsEnabled={(id, sids, enabled) => api.setStepsEnabled(id, sids, enabled)}
                        onRelabelSteps={(id, sids, labels) => api.relabelSteps(id, sids, labels)}
                    />
                )}
            </ScrollArea>
        </div>
    );
}



/**
 * Marco Extension — Live Recorded Actions Tree
 *
 * Real-time view of `session.Steps` from the active {@link useRecordingSession}.
 * Renders the in-flight steps (Click / Type / Select / Submit / Wait / JsInline)
 * as a clickable list inside the Floating Controller's Expanded mode. Updates
 * automatically as the recorder appends new steps because the source hook
 * re-renders on every storage change.
 *
 * This is intentionally separate from {@link RecorderLiveTreePanel}, which
 * shows the *persisted* Step Group library. This component shows the
 * *transient* draft of the active session — the actions the user is
 * recording right now.
 *
 * ## Selection scroll/highlight contract
 *
 * Selection can be either internal (user clicks a row) or external (the
 * Options page drives `selectedStepId` from the URL / detail panel).
 * Whenever the active selection changes, the matching row is scrolled
 * into view via `scrollIntoView({ block: "nearest" })` and pulses a
 * highlight ring for ~1.2s so the user can locate it without manually
 * scrolling the long action list.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
    Clock,
    FileCode2,
    MousePointerClick,
    Send,
    SquareCheck,
    Type as TypeIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
    detectTransport,
    subscribeRecorderSession,
    type RecorderSyncTransport,
} from "@/lib/recorder-session-sync";
import type {
    RecordedStep,
    RecordedStepKind,
    RecordingSession,
} from "@/background/recorder/recorder-session-types";

interface KindMeta {
    readonly Icon: typeof MousePointerClick;
    readonly LabelType: string;
    readonly Tone: string;
}

const KIND_META: Record<RecordedStepKind, KindMeta> = {
    Click:    { Icon: MousePointerClick, LabelType: "Click",  Tone: "text-primary" },
    Type:     { Icon: TypeIcon,          LabelType: "Type",   Tone: "text-blue-400" },
    Select:   { Icon: SquareCheck,       LabelType: "Select", Tone: "text-emerald-400" },
    Submit:   { Icon: Send,              LabelType: "Submit", Tone: "text-purple-400" },
    Wait:     { Icon: Clock,             LabelType: "Wait",   Tone: "text-amber-400" },
    JsInline: { Icon: FileCode2,         LabelType: "JS",     Tone: "text-pink-400" },
};

const HIGHLIGHT_PULSE_MS = 1200;

export interface LiveRecordedActionsTreeProps {
    readonly className?: string;
    readonly onStepClick?: (step: RecordedStep) => void;
    /**
    useEffect(() => {
        setTransport(detectTransport());

        return subscribeRecorderSession(setSession);
    }, []);

    const steps = session?.Steps ?? [];
    const [internalStepId, setInternalStepId] = useState<string | null>(null);

    const activeStepId = useMemo<string | null>(() => {
        if (controlledStepId !== undefined && controlledStepId !== null) { return controlledStepId; }

        return internalStepId;
    }, [controlledStepId, internalStepId]);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
    const setRowRef = (stepId: string) => (node: HTMLLIElement | null): void => {
        if (node === null) { rowRefs.current.delete(stepId);

 return; }
        rowRefs.current.set(stepId, node);
    };

    const lastCountRef = useRef<number>(0);
    useEffect(() => {
        if (activeStepId === null && steps.length > lastCountRef.current) {
            const node = scrollRef.current;
            if (node !== null) { node.scrollTop = node.scrollHeight; }
        }
        lastCountRef.current = steps.length;
    }, [steps.length, activeStepId]);

    const [pulseStepId, setPulseStepId] = useState<string | null>(null);
    useEffect(() => {
        if (activeStepId === null) { return; }
        const node = rowRefs.current.get(activeStepId);
        if (node === undefined) { return; }
        
        node.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setPulseStepId(activeStepId);
        const timer = window.setTimeout(() => { setPulseStepId(null); }, HIGHLIGHT_PULSE_MS);
        
        return () => { window.clearTimeout(timer); };
    }, [activeStepId, steps.length]);

    return { session, transport, steps, activeStepId, pulseStepId, scrollRef, setRowRef, setInternalStepId };
}

interface ActionRowProps {
    readonly step: RecordedStep;
    readonly selected: boolean;
    readonly pulsing: boolean;
    readonly onClick: () => void;
    readonly rowRef: (node: HTMLLIElement | null) => void;
}

function ActionRow(props: ActionRowProps): JSX.Element {
    const { step, selected, pulsing, onClick, rowRef } = props;
    const meta = KIND_META[step.Kind];
    const Icon = meta.Icon;
    const selectorPreview = step.Selector?.XPathRelative ?? step.Selector?.XPathFull ?? "";

    return (
        <li
            ref={rowRef}
            role="treeitem"
            aria-selected={selected}
            data-step-id={step.StepId}
            data-pulsing={pulsing ? "true" : undefined}
        >
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    "w-full text-left flex items-start gap-2 rounded px-1.5 py-1 text-[11px]",
                    "hover:bg-primary/10 transition-colors",
                    selected && "bg-primary/15 ring-1 ring-primary/40",
                    pulsing && "ring-2 ring-primary animate-pulse",
                )}
                data-testid={`live-action-${step.StepId}`}
                title={selectorPreview}
            >
                <Badge variant="outline" className="text-[9px] w-5 justify-center shrink-0 mt-0.5">
                    {step.Index + 1}
                </Badge>
                <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", meta.Tone)} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="font-medium">{meta.LabelType}</span>
                        {step.VariableName ? (
                            <code className="text-[10px] text-muted-foreground font-mono truncate">
                                ${step.VariableName}
                            </code>
                        ) : null}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                        {step.LabelType || selectorPreview || "—"}
                    </div>
                </div>
            </button>
        </li>
    );
}

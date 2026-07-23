/**
 * Owns the "run chain" side of the keyword-events editor: AbortController,
 * live progress, and the streaming timeline. Extracted from
 * `KeywordEventsPanel.tsx` in Plan 25 Step 15 so the editor host stays
 * under `max-lines-per-function`.
 */

import { useEffect, useRef, useState } from "react";
import {
    runKeywordEventChain,
    type KeywordEventChainSettings,
} from "@/lib/keyword-event-chain";
import { isEventRunnable } from "@/lib/keyword-event-validation";
import {
    EMPTY_TIMELINE,
    recordChainEnd,
    recordEventEnd,
    recordEventStart,
    recordStep,
    startTimeline,
    type TimelineState,
} from "@/lib/keyword-event-chain-timeline";
import type { KeywordEvent } from "@/hooks/use-keyword-events";

export interface UseKeywordEventChainRunnerArgs {
    readonly events: readonly KeywordEvent[];
    readonly chain: KeywordEventChainSettings;
}

export interface UseKeywordEventChainRunnerResult {
    readonly running: boolean;
    readonly progress: { current: number; total: number } | null;
    readonly timeline: TimelineState;
    readonly run: () => Promise<void>;
    readonly cancel: () => void;
}

// eslint-disable-next-line max-lines-per-function -- state + async runner; Plan 25 Step 15
export function useKeywordEventChainRunner(
    args: UseKeywordEventChainRunnerArgs,
): UseKeywordEventChainRunnerResult {
    const { events, chain } = args;
    const ctrlRef = useRef<AbortController | null>(null);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [timeline, setTimeline] = useState<TimelineState>(EMPTY_TIMELINE);

    useEffect(() => () => ctrlRef.current?.abort(), []);

    const cancel = (): void => {
        ctrlRef.current?.abort();
        ctrlRef.current = null;
    };

    // eslint-disable-next-line max-lines-per-function -- chain-runner async closure; Plan 25 Step 15
    const run = async (): Promise<void> => {
        ctrlRef.current?.abort();
        const ctrl = new AbortController();
        ctrlRef.current = ctrl;
        const runnable = events.filter((entry) => isEventRunnable(entry));
        setProgress({ current: 0, total: runnable.length });
        setRunning(true);
        setTimeline(startTimeline());
        const total = runnable.length;
        try {
            const result = await runKeywordEventChain(runnable, {
                pauseMs: chain.PauseMs,
                signal: ctrl.signal,
                onEventStart: (chainEvent, index) => {
                    setProgress((prev) => prev === null ? prev : { ...prev, current: index + 1 });
                    setTimeline((current) => recordEventStart(current, chainEvent, index, total));
                },
                onStep: (step, stepIndex, chainEvent) => {
                    setTimeline((current) => recordStep(current, chainEvent, step, stepIndex));
                },
                onEventEnd: (chainEvent, _i, chainResult) => {
                    setTimeline((current) => recordEventEnd(current, chainEvent, chainResult));
                },
            });
            setTimeline((current) => recordChainEnd(current, {
                Completed: result.EventsCompleted,
                Attempted: result.EventsAttempted,
                Aborted: result.Aborted,
            }));
        } finally {
            if (ctrlRef.current === ctrl) { ctrlRef.current = null; }
            setRunning(false);
            setProgress(null);
        }
    };

    return { running, progress, timeline, run, cancel };
}

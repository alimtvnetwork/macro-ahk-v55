import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    runGroup,
    type LeafStepExecutor,
    type RunGroupResult,
} from "@/background/recorder/step-library/run-group-runner";
import type { StepGroupRow, StepLibraryDb } from "@/background/recorder/step-library/db";
import type { BatchGroupReport } from "@/background/recorder/step-library/run-batch";
import { createLiveReplayExecutor } from "@/background/recorder/step-library/replay-bridge";

const previewExecutor: LeafStepExecutor = () => null;

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
}

export interface UseRunGroupControllerArgs {
    readonly open: boolean;
    readonly db: StepLibraryDb | null;
    readonly projectId: number | null;
    readonly group: StepGroupRow | null;
}

export function useRunGroupController(args: UseRunGroupControllerArgs) {
    const { open, db, projectId, group } = args;
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<RunGroupResult | null>(null);
    const [durationMs, setDurationMs] = useState(0);
    const [liveMode, setLiveMode] = useState(false);

    useEffect(() => {
        if (open) {
            setRunning(false);
            setResult(null);
            setDurationMs(0);
            setLiveMode(false);
        }
    }, [open, group?.StepGroupId]);

    const handleRun = useCallback(async () => {
        if (db === null || projectId === null || group === null) {
            toast.error("Library not ready");
            return;
        }
        setRunning(true);
        const executor: LeafStepExecutor = liveMode
            ? createLiveReplayExecutor({ Doc: document })
            : previewExecutor;
        const startedAt = performance.now();
        const runResult = await runGroup({
            db,
            projectId,
            rootGroupId: group.StepGroupId,
            executeLeafStep: executor,
        });
        const elapsed = Math.max(0, Math.round(performance.now() - startedAt));
        setResult(runResult);
        setDurationMs(elapsed);
        setRunning(false);
        if (runResult.Ok) {
            toast.success(`Ran "${group.Name}" - ${runResult.StepsExecuted} step(s) in ${formatDuration(elapsed)}`);
        } else {
            toast.error(`Run failed: ${runResult.Reason}`);
        }
    }, [db, projectId, group, liveMode]);

    const summaryReports = useMemo<ReadonlyArray<BatchGroupReport>>(() => {
        if (result === null || group === null) return [];
        return [{
            StepGroupId: group.StepGroupId,
            Status: result.Ok ? "Succeeded" : "Failed",
            StartedAt: null,
            EndedAt: null,
            DurationMs: durationMs,
            Result: result,
        }];
    }, [result, group, durationMs]);

    return { running, result, durationMs, liveMode, setLiveMode, handleRun, summaryReports };
}

/**
 * Marco Extension — Run Results Summary aggregators
 *
 * Extracted from `RunResultsSummaryPanel.tsx` so the panel file exports
 * only its React component (satisfies `react-refresh/only-export-components`).
 * All helpers stay pure so unit tests can exercise them without mounting.
 */

import type { BatchGroupReport } from "@/background/recorder/step-library/run-batch";
import type { RunStepTraceEntry } from "@/background/recorder/step-library/run-group-runner";

export interface AggregateCounts {
    readonly GroupsRun: number;
    readonly StepsExecuted: number;
    readonly StepsSkipped: number;
    readonly GroupsEntered: number;
    readonly Failures: number;
}

export function aggregate(reports: ReadonlyArray<BatchGroupReport>): AggregateCounts {
    let groupsRun = 0;
    let executed = 0;
    let skipped = 0;
    let entered = 0;
    let failures = 0;

    for (const r of reports) {
        if (r.Status === "Succeeded" || r.Status === "Failed") groupsRun++;
        if (r.Status === "Failed") failures++;

        const result = r.Result;
        if (result === null) continue;

        // Successful runs ship the canonical counters directly. We
        // still walk the trace for failed runs because RunGroupFailure
        // only carries the partial trace, not pre-computed counts.
        if (result.Ok) {
            executed += result.StepsExecuted;
            skipped += result.StepsSkipped;
            entered += result.GroupsEntered;
        } else {
            const partial = countsFromTrace(result.Trace);
            executed += partial.Executed;
            skipped += partial.Skipped;
            entered += partial.Entered;
        }
    }

    return {
        GroupsRun: groupsRun,
        StepsExecuted: executed,
        StepsSkipped: skipped,
        GroupsEntered: entered,
        Failures: failures,
    };
}

export function countsFromTrace(trace: ReadonlyArray<RunStepTraceEntry>): {
    Executed: number; Skipped: number; Entered: number;
} {
    let exec = 0, skip = 0, ent = 0;
    for (const t of trace) {
        if (t.Outcome === "Executed") exec++;
        else if (t.Outcome === "Skipped") skip++;
        else if (t.Outcome === "EnteredGroup") ent++;
    }
    return { Executed: exec, Skipped: skip, Entered: ent };
}

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
}

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
    let groupsRun = 0, failures = 0;
    let executed = 0, skipped = 0, entered = 0;

    for (const r of reports) {
        if (r.Status === "Succeeded" || r.Status === "Failed") groupsRun++;
        if (r.Status === "Failed") failures++;
        if (r.Result === null) continue;
        
        const c = getResultCounts(r.Result);
        executed += c.Executed;
        skipped += c.Skipped;
        entered += c.Entered;
    }

    return {
        GroupsRun: groupsRun,
        StepsExecuted: executed,
        StepsSkipped: skipped,
        GroupsEntered: entered,
        Failures: failures,
    };
}

function getResultCounts(result: NonNullable<BatchGroupReport["Result"]>) {
    if (result.Ok) {
        return { Executed: result.StepsExecuted, Skipped: result.StepsSkipped, Entered: result.GroupsEntered };
    }

    return countsFromTrace(result.Trace);
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

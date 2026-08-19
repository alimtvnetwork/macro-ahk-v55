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
  return reports.reduce(accumulateReport, {
    GroupsRun: 0,
    StepsExecuted: 0,
    StepsSkipped: 0,
    GroupsEntered: 0,
    Failures: 0,
  });
}

function accumulateReport(acc: AggregateCounts, r: BatchGroupReport): AggregateCounts {
  let { GroupsRun, StepsExecuted, StepsSkipped, GroupsEntered, Failures } = acc;

  if (r.Status === "Succeeded" || r.Status === "Failed") {
    GroupsRun++;
  }

  if (r.Status === "Failed") {
    Failures++;
  }

  const result = r.Result;

  if (result === null) {
    return { GroupsRun, StepsExecuted, StepsSkipped, GroupsEntered, Failures };
  }

  if (result.Ok) {
    StepsExecuted += result.StepsExecuted;
    StepsSkipped += result.StepsSkipped;
    GroupsEntered += result.GroupsEntered;
  } else {
    const partial = countsFromTrace(result.Trace);
    StepsExecuted += partial.Executed;
    StepsSkipped += partial.Skipped;
    GroupsEntered += partial.Entered;
  }

  return { GroupsRun, StepsExecuted, StepsSkipped, GroupsEntered, Failures };
}

export function countsFromTrace(trace: ReadonlyArray<RunStepTraceEntry>): {
    Executed: number; Skipped: number; Entered: number;
} {
  let exec = 0, skip = 0, ent = 0;
  for (const t of trace) {
    if (t.Outcome === "Executed") {
      exec++;
    } else if (t.Outcome === "Skipped") {
      skip++;
    } else if (t.Outcome === "EnteredGroup") {
      ent++;
    }
  }

  return { Executed: exec, Skipped: skip, Entered: ent };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms} ms`;
  }

  return `${(ms / 1000).toFixed(2)} s`;
}

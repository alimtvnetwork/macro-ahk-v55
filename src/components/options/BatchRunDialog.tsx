/**
 * Marco Extension — Batch Run Dialog
 *
 * Runs a user-selected list of StepGroups one after another in the
 * order chosen, and shows a live per-group status row.
 *
 * The row order is FIRST seeded from the caller-provided
 * `initialOrder` (which is the order in which the user ticked the
 * checkboxes in the library tree). Inside the dialog the user can
 * still re-arrange via ▲ / ▼ before pressing Run.
 *
 * Execution itself is delegated to the pure `runBatch` helper so the
 * same code paths the unit tests cover are what the user clicks.
 *
 * @see src/background/recorder/step-library/run-batch.ts
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

import {
    runBatch,
    type BatchFailurePolicy,
    type BatchGroupReport,
    type BatchGroupStatus,
} from "@/background/recorder/step-library/run-batch";
import type { StepGroupRow, StepLibraryDb } from "@/background/recorder/step-library/db";
import type { LeafStepExecutor, RunStepTraceEntry } from "@/background/recorder/step-library/run-group-runner";
import { createLiveReplayExecutor } from "@/background/recorder/step-library/replay-bridge";
import {
    buildBatchCompletePayload,
    buildGroupRunPayload,
    dispatchWebhook,
} from "@/background/recorder/step-library/result-webhook";
import {
    mergeInputBags,
    resolveBatchInputSnapshot,
} from "@/background/recorder/step-library/input-source";
import type { GroupInputBag } from "@/background/recorder/step-library/group-inputs";

import RunResultsSummaryPanel from "./RunResultsSummaryPanel";
import RunTraceViewer from "./RunTraceViewer";

interface BatchRunDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly db: StepLibraryDb | null;
    readonly projectId: number | null;
    readonly initialOrder: ReadonlyArray<number>;
    readonly groupsById: ReadonlyMap<number, StepGroupRow>;
    /** Locally-saved input bag per group, used as the merge baseline. */
    readonly groupInputs: ReadonlyMap<number, GroupInputBag>;
    /** Persists the merged bag back so the rest of the app sees it. */
    readonly onApplyMergedInput: (groupId: number, bag: GroupInputBag) => void;
}

const STATUS_STYLE: Record<BatchGroupStatus, string> = {
    Pending:   "bg-muted text-muted-foreground",
    Running:   "bg-primary/15 text-primary",
    Succeeded: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    Failed:    "bg-destructive/15 text-destructive",
    Skipped:   "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

function move<T>(values: ReadonlyArray<T>, from: number, to: number): T[] {
    if (to < 0 || to >= values.length) return values.slice();
    const next = values.slice();
    [next[from], next[to]] = [next[to], next[from]];
    return next;
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
}

/* ------------------------------------------------------------------ */
/*  Input snapshot merge                                               */
/* ------------------------------------------------------------------ */

interface MergeSnapshotArgs {
    readonly order: ReadonlyArray<number>;
    readonly groupInputs: ReadonlyMap<number, GroupInputBag>;
    readonly onApplyMergedInput: (groupId: number, bag: GroupInputBag) => void;
}

/**
 * Applies a resolved batch input snapshot. Returns `false` when the
 * caller must abort the run (input source failed and policy was
 * abort-on-error); `true` otherwise.
 */
async function applyInputSnapshot(args: MergeSnapshotArgs): Promise<boolean> {
    const snapshot = await resolveBatchInputSnapshot();
    if (!snapshot.Result.Ok) {
        if (!snapshot.Result.Continue) {
            toast.error(`Input source failed: ${snapshot.Result.Error}. Run aborted.`);
            return false;
        }
        toast.warning(`Input source failed: ${snapshot.Result.Error}. Continuing with local inputs.`);
        return true;
    }
    if (snapshot.Result.Skipped || snapshot.Bag === null) return true;
    const incoming = snapshot.Bag;
    for (const id of args.order) {
        const merged = mergeInputBags(args.groupInputs.get(id) ?? null, incoming);
        args.onApplyMergedInput(id, merged);
    }
    const keyCount = Object.keys(incoming).length;
    toast.success(`Input source: merged ${keyCount} key(s) into ${args.order.length} group(s)`);
    return true;
}

/* ------------------------------------------------------------------ */
/*  Per-group webhook dispatch                                         */
/* ------------------------------------------------------------------ */

function emitGroupWebhook(
    projectId: number,
    report: BatchGroupReport,
    groupsById: ReadonlyMap<number, StepGroupRow>,
): void {
    if (report.Status !== "Succeeded" && report.Status !== "Failed") return;
    const groupRow = groupsById.get(report.StepGroupId);
    const runResult = report.Result;
    const failureReason = runResult !== null && !runResult.Ok ? runResult.Reason : undefined;
    const failedStepId = runResult !== null && !runResult.Ok && runResult.FailedStepId !== null
        ? runResult.FailedStepId
        : undefined;
    void dispatchWebhook(
        report.Status === "Succeeded" ? "GroupRunSucceeded" : "GroupRunFailed",
        buildGroupRunPayload({
            ProjectId: projectId,
            GroupId: report.StepGroupId,
            GroupName: groupRow?.Name ?? `#${report.StepGroupId}`,
            DurationMs: report.DurationMs,
            StepsExecuted: runResult?.Trace.length ?? 0,
            Outcome: report.Status,
            FailureReason: failureReason,
            FailedStepId: failedStepId,
        }),
    );
}

function emitBatchCompleteWebhook(
    projectId: number,
    total: number,
    result: { readonly Succeeded: number; readonly Failed: number; readonly Skipped: number; readonly DurationMs: number; readonly Ok: boolean },
): void {
    void dispatchWebhook(
        "BatchComplete",
        buildBatchCompletePayload({
            ProjectId: projectId,
            TotalGroups: total,
            Succeeded: result.Succeeded,
            Failed: result.Failed,
            Skipped: result.Skipped,
            DurationMs: result.DurationMs,
            Ok: result.Ok,
        }),
    );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function BatchToolbar({
    orderCount, summary, liveMode, setLiveMode, continueOnFailure, setContinueOnFailure, running,
}: {
    orderCount: number;
    summary: { Succeeded: number; Failed: number; Skipped: number };
    liveMode: boolean;
    setLiveMode: (v: boolean) => void;
    continueOnFailure: boolean;
    setContinueOnFailure: (v: boolean) => void;
    running: boolean;
}) {
    const completed = summary.Succeeded + summary.Failed + summary.Skipped;
    return (
        <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="flex items-center gap-3 text-muted-foreground">
                <span>{orderCount} group(s)</span>
                {completed > 0 && (
                    <span>· {summary.Succeeded} ok · {summary.Failed} failed · {summary.Skipped} skipped</span>
                )}
            </div>
            <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                    <Switch checked={liveMode} onCheckedChange={setLiveMode}
                        disabled={running} aria-label="Live execution" />
                    <span title="When on, each leaf step dispatches real DOM events into this page via the replay bridge.">Live execution</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                    <Switch checked={continueOnFailure} onCheckedChange={setContinueOnFailure}
                        disabled={running} aria-label="Continue on failure" />
                    <span>Continue on failure</span>
                </label>
            </div>
        </div>
    );
}

function TraceSection({ flatTrace, traceOpen, setTraceOpen }: {
    flatTrace: ReadonlyArray<RunStepTraceEntry>;
    traceOpen: boolean;
    setTraceOpen: (updater: (v: boolean) => boolean) => void;
}) {
    return (
        <div className="space-y-2">
            <button type="button" onClick={() => setTraceOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                aria-expanded={traceOpen} aria-controls="run-trace-viewer">
                {traceOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {traceOpen ? "Hide" : "Show"} execution trace ({flatTrace.length} entries)
            </button>
            {traceOpen && (
                <div id="run-trace-viewer"><RunTraceViewer trace={flatTrace} /></div>
            )}
        </div>
    );
}

interface OrderRowProps {
    readonly gid: number;
    readonly idx: number;
    readonly group: StepGroupRow | undefined;
    readonly report: BatchGroupReport;
    readonly running: boolean;
    readonly orderLength: number;
    readonly onMove: (from: number, to: number) => void;
    readonly onRemove: (idx: number) => void;
}

function OrderRow(p: OrderRowProps) {
    return (
        <li className="flex items-center gap-3 px-3 py-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {p.idx + 1}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                        {p.group?.Name ?? `Group #${p.gid}`}
                    </span>
                    <StatusBadge status={p.report.Status} />
                </div>
                {p.report.Status === "Failed" && p.report.Result !== null && !p.report.Result.Ok && (
                    <p className="mt-0.5 truncate text-xs text-destructive">
                        {p.report.Result.Reason}: {p.report.Result.ReasonDetail}
                    </p>
                )}
                {p.report.DurationMs > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDuration(p.report.DurationMs)}</p>
                )}
            </div>
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"
                    disabled={p.running || p.idx === 0}
                    onClick={() => p.onMove(p.idx, p.idx - 1)} aria-label="Move up">
                    <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                    disabled={p.running || p.idx === p.orderLength - 1}
                    onClick={() => p.onMove(p.idx, p.idx + 1)} aria-label="Move down">
                    <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                    disabled={p.running} onClick={() => p.onRemove(p.idx)}
                    aria-label="Remove from batch">
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </li>
    );
}

function OrderList({ order, reports, groupsById, running, onMove, onRemove }: {
    order: ReadonlyArray<number>;
    reports: ReadonlyArray<BatchGroupReport>;
    groupsById: ReadonlyMap<number, StepGroupRow>;
    running: boolean;
    onMove: (from: number, to: number) => void;
    onRemove: (idx: number) => void;
}) {
    return (
        <ScrollArea className="max-h-[55vh] rounded-md border">
            <ol className="divide-y">
                {order.map((gid, idx) => (
                    <OrderRow key={gid} gid={gid} idx={idx}
                        group={groupsById.get(gid)}
                        report={reports[idx] ?? emptyReport(gid)}
                        running={running} orderLength={order.length}
                        onMove={onMove} onRemove={onRemove} />
                ))}
            </ol>
        </ScrollArea>
    );
}

function BatchFooter({ running, orderLength, onClose, onRun }: {
    running: boolean; orderLength: number;
    onClose: () => void; onRun: () => void;
}) {
    return (
        <DialogFooter>
            <Button variant="outline" disabled={running} onClick={onClose}>Close</Button>
            <Button disabled={running || orderLength === 0} onClick={onRun}>
                {running ? (
                    <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Running...</>
                ) : (
                    <><Play className="mr-1 h-4 w-4" /> Run {orderLength} group(s)</>
                )}
            </Button>
        </DialogFooter>
    );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface BatchRunState {
    order: ReadonlyArray<number>;
    setOrder: React.Dispatch<React.SetStateAction<ReadonlyArray<number>>>;
    reports: ReadonlyArray<BatchGroupReport>;
    setReports: React.Dispatch<React.SetStateAction<ReadonlyArray<BatchGroupReport>>>;
    running: boolean;
    setRunning: (v: boolean) => void;
    continueOnFailure: boolean;
    setContinueOnFailure: (v: boolean) => void;
    liveMode: boolean;
    setLiveMode: (v: boolean) => void;
    lastRunDurationMs: number | null;
    setLastRunDurationMs: (v: number | null) => void;
    traceOpen: boolean;
    setTraceOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function useBatchRunState(open: boolean, initialOrder: ReadonlyArray<number>): BatchRunState {
    const [order, setOrder] = useState<ReadonlyArray<number>>(initialOrder);
    const [reports, setReports] = useState<ReadonlyArray<BatchGroupReport>>([]);
    const [running, setRunning] = useState(false);
    const [continueOnFailure, setContinueOnFailure] = useState(false);
    const [liveMode, setLiveMode] = useState(false);
    const [lastRunDurationMs, setLastRunDurationMs] = useState<number | null>(null);
    const [traceOpen, setTraceOpen] = useState(false);
    useEffect(() => {
        if (open) {
            setOrder(initialOrder);
            setReports(initialOrder.map((id) => emptyReport(id)));
            setRunning(false);
            setLastRunDurationMs(null);
            setTraceOpen(false);
            setLiveMode(false);
        }
    }, [open, initialOrder]);
    return {
        order, setOrder, reports, setReports, running, setRunning,
        continueOnFailure, setContinueOnFailure, liveMode, setLiveMode,
        lastRunDurationMs, setLastRunDurationMs, traceOpen, setTraceOpen,
    };
}

interface HandleRunArgs {
    readonly db: StepLibraryDb | null;
    readonly projectId: number | null;
    readonly state: BatchRunState;
    readonly policy: BatchFailurePolicy;
    readonly groupsById: ReadonlyMap<number, StepGroupRow>;
    readonly groupInputs: ReadonlyMap<number, GroupInputBag>;
    readonly onApplyMergedInput: (groupId: number, bag: GroupInputBag) => void;
}

function reportBatchOutcome(result: {
    Ok: boolean; Succeeded: number; Failed: number; Skipped: number; DurationMs: number;
}): void {
    if (result.Ok) {
        toast.success(`Batch complete: ${result.Succeeded} group(s) ran in ${formatDuration(result.DurationMs)}`);
    } else {
        toast.error(`Batch finished with ${result.Failed} failure(s), ${result.Skipped} skipped`);
    }
}

async function executeBatch(args: HandleRunArgs): Promise<void> {
    const { db, projectId, state: s, policy, groupsById, groupInputs, onApplyMergedInput } = args;
    if (db === null || projectId === null) { toast.error("Library not ready"); return; }
    if (s.order.length === 0) return;
    s.setRunning(true);
    const proceed = await applyInputSnapshot({ order: s.order, groupInputs, onApplyMergedInput });
    if (!proceed) { s.setRunning(false); return; }
    s.setReports(s.order.map((id) => emptyReport(id)));
    const live: BatchGroupReport[] = s.order.map((id) => emptyReport(id));
    const executor: LeafStepExecutor = s.liveMode
        ? createLiveReplayExecutor({ Doc: document })
        : previewExecutor;
    const result = await runBatch({
        db, projectId, orderedGroupIds: s.order,
        executeLeafStep: executor, failurePolicy: policy,
        onGroupStatus: (report, idx) => {
            live[idx] = report;
            s.setReports(live.slice());
            emitGroupWebhook(projectId, report, groupsById);
        },
    });
    s.setRunning(false);
    s.setLastRunDurationMs(result.DurationMs);
    emitBatchCompleteWebhook(projectId, s.order.length, result);
    reportBatchOutcome(result);
}

function BatchRunBody({ s, groupsById, summary, flatTrace, handleRun, onClose }: {
    s: BatchRunState;
    groupsById: ReadonlyMap<number, StepGroupRow>;
    summary: { Succeeded: number; Failed: number; Skipped: number };
    flatTrace: ReadonlyArray<RunStepTraceEntry>;
    handleRun: () => void;
    onClose: () => void;
}) {
    const showSummary = s.lastRunDurationMs !== null && !s.running;
    return (
        <>
            <DialogHeader>
                <DialogTitle>Run groups in batch</DialogTitle>
                <DialogDescription>
                    Groups run sequentially in the order shown. Drag with the arrows to reorder before pressing Run.
                </DialogDescription>
            </DialogHeader>
            <BatchToolbar orderCount={s.order.length} summary={summary}
                liveMode={s.liveMode} setLiveMode={s.setLiveMode}
                continueOnFailure={s.continueOnFailure}
                setContinueOnFailure={s.setContinueOnFailure}
                running={s.running} />
            {showSummary && (
                <RunResultsSummaryPanel reports={s.reports}
                    totalDurationMs={s.lastRunDurationMs ?? 0}
                    groupName={(id) => groupsById.get(id)?.Name ?? `Group #${id}`} />
            )}
            {showSummary && flatTrace.length > 0 && (
                <TraceSection flatTrace={flatTrace}
                    traceOpen={s.traceOpen} setTraceOpen={s.setTraceOpen} />
            )}
            <OrderList order={s.order} reports={s.reports}
                groupsById={groupsById} running={s.running}
                onMove={(from, to) => s.setOrder((o) => move(o, from, to))}
                onRemove={(idx) => s.setOrder((o) => o.filter((_, i) => i !== idx))} />
            <BatchFooter running={s.running} orderLength={s.order.length}
                onClose={onClose} onRun={handleRun} />
        </>
    );
}

export default function BatchRunDialog(props: BatchRunDialogProps) {
    const {
        open, onOpenChange, db, projectId, initialOrder, groupsById,
        groupInputs, onApplyMergedInput,
    } = props;
    const s = useBatchRunState(open, initialOrder);
    const policy: BatchFailurePolicy = s.continueOnFailure ? "ContinueOnFailure" : "StopOnFailure";
    const handleRun = () => void executeBatch({
        db, projectId, state: s, policy, groupsById, groupInputs, onApplyMergedInput,
    });
    const summary = useMemo(() => {
        const counts = { Succeeded: 0, Failed: 0, Skipped: 0, Running: 0, Pending: 0 };
        for (const r of s.reports) counts[r.Status]++;
        return counts;
    }, [s.reports]);
    const flatTrace = useMemo<ReadonlyArray<RunStepTraceEntry>>(() => {
        const out: RunStepTraceEntry[] = [];
        for (const r of s.reports) {
            const trace = r.Result?.Trace;
            if (trace !== undefined) out.push(...trace);
        }
        return out;
    }, [s.reports]);
    return (
        <Dialog open={open} onOpenChange={(o) => { if (!s.running) onOpenChange(o); }}>
            <DialogContent className="max-w-2xl">
                <BatchRunBody s={s} groupsById={groupsById}
                    summary={summary} flatTrace={flatTrace}
                    handleRun={handleRun} onClose={() => onOpenChange(false)} />
            </DialogContent>
        </Dialog>
    );
}

function StatusBadge({ status }: { status: BatchGroupStatus }) {
    return (
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[status]}`}>
            {status}
        </span>
    );
}

function emptyReport(id: number): BatchGroupReport {
    return { StepGroupId: id, Status: "Pending", StartedAt: null, EndedAt: null, DurationMs: 0, Result: null };
}

/**
 * Preview-mode leaf executor: the Options page can't actually click DOM
 * in a target tab, so every leaf step is reported as a synthetic success.
 * This still exercises the full runner pipeline (group descent, RunGroup
 * expansion, cycle detection) which is what the batch UX is here to
 * demonstrate. In production the recorder background worker injects its
 * own real executor.
 */
const previewExecutor: LeafStepExecutor = () => null;


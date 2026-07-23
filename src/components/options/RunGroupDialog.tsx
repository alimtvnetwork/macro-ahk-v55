/**
 * Marco Extension - Run Group Dialog
 *
 * Single-group execution surface. State + handlers live in
 * `run-group/use-run-group-controller.ts`; presentational bits live in
 * `run-group/run-group-sections.tsx`.
 */

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import type { StepGroupRow, StepLibraryDb } from "@/background/recorder/step-library/db";

import RunResultsSummaryPanel from "./RunResultsSummaryPanel";
import RunTraceViewer from "./RunTraceViewer";
import { useRunGroupController } from "./run-group/use-run-group-controller";
import {
    LiveModeToggle,
    IdleBanner,
    RunningBanner,
    RunFooter,
    FailureCard,
} from "./run-group/run-group-sections";

interface RunGroupDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly db: StepLibraryDb | null;
    readonly projectId: number | null;
    readonly group: StepGroupRow | null;
    readonly groupName?: (id: number) => string;
}

export default function RunGroupDialog(props: RunGroupDialogProps): JSX.Element {
    const { open, onOpenChange, db, projectId, group, groupName } = props;
    const controller = useRunGroupController({ open, db, projectId, group });
    const { running, result, durationMs, liveMode, setLiveMode, handleRun, summaryReports } = controller;
    const canRun = group !== null && db !== null && projectId !== null;
    return (
        <Dialog open={open} onOpenChange={(next) => { if (!running) onOpenChange(next); }}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Run group{group !== null ? ` - ${group.Name}` : ""}</DialogTitle>
                    <DialogDescription>
                        Executes this group. Disabled steps are skipped; nested RunGroup steps are expanded recursively up to the runner's depth limit.
                    </DialogDescription>
                </DialogHeader>

                <LiveModeToggle liveMode={liveMode} running={running} setLiveMode={setLiveMode} />
                {result === null && !running && <IdleBanner />}
                {running && <RunningBanner />}
                {result !== null && !result.Ok && <FailureCard result={result} groupName={groupName} />}
                {result !== null && summaryReports.length > 0 && (
                    <RunResultsSummaryPanel
                        reports={summaryReports}
                        totalDurationMs={durationMs}
                        groupName={groupName}
                    />
                )}
                {result !== null && result.Trace.length > 0 && (
                    <RunTraceViewer trace={result.Trace} maxHeightClass="max-h-[40vh]" />
                )}

                <DialogFooter>
                    <RunFooter
                        running={running}
                        hasResult={result !== null}
                        canRun={canRun}
                        onClose={() => onOpenChange(false)}
                        onRun={() => void handleRun()}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

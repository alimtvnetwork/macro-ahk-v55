import { AlertTriangle, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { RunGroupResult } from "@/background/recorder/step-library/run-group-runner";

interface LiveModeToggleProps {
    liveMode: boolean;
    running: boolean;
    setLiveMode: (value: boolean) => void;
}

export function LiveModeToggle({ liveMode, running, setLiveMode }: LiveModeToggleProps): JSX.Element {
    return (
        <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="min-w-0">
                <div className="font-medium text-foreground">Live execution</div>
                <div className="text-xs text-muted-foreground">
                    {liveMode
                        ? "Each leaf step dispatches real DOM events into this page via the replay bridge."
                        : "Preview mode: every leaf reports success without touching the DOM."}
                </div>
            </div>
            <Switch
                checked={liveMode}
                onCheckedChange={setLiveMode}
                disabled={running}
                aria-label="Toggle live execution"
            />
        </div>
    );
}

export function IdleBanner(): JSX.Element {
    return (
        <div className="rounded-md border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
            Press <strong className="text-foreground">Run</strong> to execute the group and capture its trace.
        </div>
    );
}

export function RunningBanner(): JSX.Element {
    return (
        <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/30 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Running...
        </div>
    );
}

interface RunFooterProps {
    running: boolean;
    hasResult: boolean;
    canRun: boolean;
    onClose: () => void;
    onRun: () => void;
}

export function RunFooter({ running, hasResult, canRun, onClose, onRun }: RunFooterProps): JSX.Element {
    return (
        <>
            <Button variant="outline" disabled={running} onClick={onClose}>Close</Button>
            <Button disabled={running || !canRun} onClick={onRun}>
                {running
                    ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Running...</>
                    : <><Play className="mr-1 h-4 w-4" /> {hasResult ? "Run again" : "Run"}</>}
            </Button>
        </>
    );
}

interface FailureCardProps {
    readonly result: RunGroupResult & { Ok: false };
    readonly groupName?: (id: number) => string;
}

export function FailureCard({ result, groupName }: FailureCardProps): JSX.Element {
    const failedGroupName = result.FailedGroupId !== null
        ? (groupName?.(result.FailedGroupId) ?? `Group #${result.FailedGroupId}`)
        : null;
    return (
        <section className="rounded-md border border-destructive/40 bg-destructive/5 p-3" aria-label="Run failure details">
            <header className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-semibold text-destructive">Run failed</h3>
                <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                    {result.Reason}
                </span>
            </header>
            <p className="mb-2 text-xs text-foreground">{result.ReasonDetail}</p>
            <FailureCardDetails result={result} failedGroupName={failedGroupName} />
        </section>
    );
}

function FailureCardDetails({ result, failedGroupName }: {
    result: RunGroupResult & { Ok: false };
    failedGroupName: string | null;
}): JSX.Element {
    return (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {result.FailedStepId !== null && (
                <><dt className="text-muted-foreground">Failed step</dt>
                <dd className="font-mono">#{result.FailedStepId}</dd></>
            )}
            {failedGroupName !== null && (
                <><dt className="text-muted-foreground">Failed group</dt>
                <dd className="truncate" title={failedGroupName}>{failedGroupName}</dd></>
            )}
            {result.CallStack.length > 0 && (
                <><dt className="text-muted-foreground">Call stack</dt>
                <dd className="truncate font-mono" title={result.CallStack.join(" > ")}>
                    {result.CallStack.join(" > ")}
                </dd></>
            )}
            {result.FailureReport !== null && (
                <><dt className="text-muted-foreground">Leaf failure</dt>
                <dd className="truncate" title={result.FailureReport.Reason}>{result.FailureReport.Reason}</dd></>
            )}
        </dl>
    );
}

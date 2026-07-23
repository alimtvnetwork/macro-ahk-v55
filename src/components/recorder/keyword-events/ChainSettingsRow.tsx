/**
 * Marco Extension: Chain settings row
 *
 * The compound settings block sitting above the keyword-event list.
 * Extracted from `KeywordEventsPanel.tsx` in Plan 25 Step 16.
 *
 * The row is composed of four leaves:
 *   1. `ChainToggleHeader`: enable switch + status badges + run/stop button.
 *   2. `ChainRunControls`: the run/stop button family, kept isolated so the
 *      keyboard-shortcut kbd chip is only rendered where it belongs.
 *   3. `ChainPauseRow`: pause-between-events numeric input.
 *   4. `ChainAfterRecordingRow`: the "run chain after recording stops" toggle.
 *
 * Behavior is byte-identical to the pre-extraction inline definitions.
 */

import { Link2, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    DEFAULT_CHAIN_SETTINGS,
    type KeywordEventChainSettings,
} from "@/lib/keyword-event-chain";
import { cn } from "@/lib/utils";

export interface ChainSettingsRowProps {
    readonly settings: KeywordEventChainSettings;
    readonly onChange: (next: KeywordEventChainSettings) => void;
    readonly enabledCount: number;
    readonly running: boolean;
    readonly progress: { current: number; total: number } | null;
    readonly autoRunActive?: boolean;
    readonly runShortcutLabel?: string;
    readonly stopShortcutLabel?: string;
    readonly onRun: () => void;
    readonly onCancel: () => void;
}

export function ChainSettingsRow(props: ChainSettingsRowProps): JSX.Element {
    const {
        settings, onChange, enabledCount, running, progress, autoRunActive,
        runShortcutLabel, stopShortcutLabel, onRun, onCancel,
    } = props;
    return (
        <div
            className={cn(
                "rounded-md border border-border bg-muted/30 p-3 space-y-2",
                settings.Enabled && "border-primary/50",
            )}
            data-testid="keyword-event-chain-row"
        >
            <ChainToggleHeader
                settings={settings}
                onChange={onChange}
                enabledCount={enabledCount}
                running={running}
                progress={progress}
                autoRunActive={autoRunActive === true}
                runShortcutLabel={runShortcutLabel}
                stopShortcutLabel={stopShortcutLabel}
                onRun={onRun}
                onCancel={onCancel}
            />
            <ChainPauseRow settings={settings} onChange={onChange} running={running} />
            <ChainAfterRecordingRow settings={settings} onChange={onChange} />
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

interface ChainToggleHeaderProps {
    readonly settings: KeywordEventChainSettings;
    readonly onChange: (next: KeywordEventChainSettings) => void;
    readonly enabledCount: number;
    readonly running: boolean;
    readonly progress: { current: number; total: number } | null;
    readonly autoRunActive: boolean;
    readonly runShortcutLabel?: string;
    readonly stopShortcutLabel?: string;
    readonly onRun: () => void;
    readonly onCancel: () => void;
}

function ChainToggleHeader(props: ChainToggleHeaderProps): JSX.Element {
    const {
        settings, onChange, enabledCount, running, progress, autoRunActive,
        runShortcutLabel, stopShortcutLabel, onRun, onCancel,
    } = props;
    return (
        <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <Label htmlFor="kev-chain-toggle" className="text-sm font-medium cursor-pointer">
                    Auto-chain into recorder playback
                </Label>
            </div>
            <Switch
                id="kev-chain-toggle"
                checked={settings.Enabled}
                onCheckedChange={(value) => onChange({ ...settings, Enabled: value })}
                aria-label="Auto-chain keyword events into recorder playback"
                data-testid="keyword-event-chain-toggle"
            />
            <div className="ml-auto flex items-center gap-2">
                {autoRunActive && (
                    <Badge
                        variant="outline"
                        className="text-[10px] border-primary/60 text-primary animate-pulse"
                        data-testid="keyword-event-chain-auto-running"
                    >
                        Auto-running
                    </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                    {enabledCount} enabled
                </Badge>
                <ChainRunControls
                    running={running}
                    progress={progress}
                    enabledCount={enabledCount}
                    runShortcutLabel={runShortcutLabel}
                    stopShortcutLabel={stopShortcutLabel}
                    onRun={onRun}
                    onCancel={onCancel}
                />
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Run / Stop controls                                                */
/* ------------------------------------------------------------------ */

interface ChainRunControlsProps {
    readonly running: boolean;
    readonly progress: { current: number; total: number } | null;
    readonly enabledCount: number;
    readonly runShortcutLabel?: string;
    readonly stopShortcutLabel?: string;
    readonly onRun: () => void;
    readonly onCancel: () => void;
}

// eslint-disable-next-line max-lines-per-function -- JSX-heavy leaf; Plan 25 Step 16
function ChainRunControls(props: ChainRunControlsProps): JSX.Element {
    const { running, progress, enabledCount, runShortcutLabel, stopShortcutLabel, onRun, onCancel } = props;
    if (running) {
        return (
            <Button
                size="sm"
                variant="destructive"
                className="h-8"
                onClick={onCancel}
                data-testid="keyword-event-chain-cancel"
                title={stopShortcutLabel ? `Stop the chain (${stopShortcutLabel})` : "Stop the chain"}
            >
                <Square className="h-3.5 w-3.5 mr-1" />
                Stop
                {progress !== null ? ` (${progress.current}/${progress.total})` : ""}
                {stopShortcutLabel !== undefined && (
                    <kbd
                        className="ml-2 hidden sm:inline-flex items-center rounded border border-destructive-foreground/30 px-1 text-[9px] font-mono opacity-80"
                        data-testid="keyword-event-chain-stop-shortcut"
                    >
                        {stopShortcutLabel}
                    </kbd>
                )}
            </Button>
        );
    }
    return (
        <Button
            size="sm"
            variant="secondary"
            className="h-8"
            onClick={onRun}
            disabled={enabledCount === 0}
            data-testid="keyword-event-chain-run"
            title={
                runShortcutLabel !== undefined
                    ? `Run all enabled keyword events sequentially (${runShortcutLabel})`
                    : "Run all enabled keyword events sequentially"
            }
        >
            <Play className="h-3.5 w-3.5 mr-1" />
            Run chain
            {runShortcutLabel !== undefined && (
                <kbd
                    className="ml-2 hidden sm:inline-flex items-center rounded border border-border px-1 text-[9px] font-mono opacity-80"
                    data-testid="keyword-event-chain-run-shortcut"
                >
                    {runShortcutLabel}
                </kbd>
            )}
        </Button>
    );
}

/* ------------------------------------------------------------------ */
/*  Pause row                                                          */
/* ------------------------------------------------------------------ */

interface ChainPauseRowProps {
    readonly settings: KeywordEventChainSettings;
    readonly onChange: (next: KeywordEventChainSettings) => void;
    readonly running: boolean;
}

function ChainPauseRow(props: ChainPauseRowProps): JSX.Element {
    const { settings, onChange, running } = props;
    const pauseDraft = String(settings.PauseMs);
    return (
        <div className="flex items-center gap-3">
            <Label htmlFor="kev-chain-pause" className="text-xs text-muted-foreground shrink-0">
                Pause between events
            </Label>
            <Input
                id="kev-chain-pause"
                type="number"
                min={0}
                max={60_000}
                step={50}
                value={pauseDraft}
                onChange={(inputEvent) => {
                    const parsed = Number(inputEvent.target.value);
                    const nextPause = Number.isFinite(parsed) ? parsed : DEFAULT_CHAIN_SETTINGS.PauseMs;
                    onChange({ ...settings, PauseMs: nextPause });
                }}
                className="h-8 w-24 text-xs"
                aria-label="Pause between chained events in milliseconds"
                data-testid="keyword-event-chain-pause"
                disabled={running}
            />
            <span className="text-[10px] text-muted-foreground">ms</span>
            <p className="text-[10px] text-muted-foreground ml-auto max-w-md text-right">
                {settings.Enabled
                    ? "Recorder playback will run every enabled event in order with this pause between them."
                    : "Off — keyword events only fire when run manually."}
            </p>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  After-recording row                                                */
/* ------------------------------------------------------------------ */

interface ChainAfterRecordingRowProps {
    readonly settings: KeywordEventChainSettings;
    readonly onChange: (next: KeywordEventChainSettings) => void;
}

function ChainAfterRecordingRow(props: ChainAfterRecordingRowProps): JSX.Element {
    const { settings, onChange } = props;
    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                <Square className="h-3.5 w-3.5 text-primary" />
                <Label
                    htmlFor="kev-chain-after-recording"
                    className="text-xs font-medium cursor-pointer"
                >
                    Run chain after recording stops
                </Label>
            </div>
            <Switch
                id="kev-chain-after-recording"
                checked={settings.RunAfterRecording}
                onCheckedChange={(value) => onChange({ ...settings, RunAfterRecording: value })}
                aria-label="Automatically run the chain when the recorder finishes a session"
                data-testid="keyword-event-chain-after-recording"
            />
            <p className="text-[10px] text-muted-foreground ml-auto max-w-md text-right">
                {settings.RunAfterRecording
                    ? "Chain will fire automatically the moment a recording session is stopped."
                    : "Off — stopping a recording does nothing."}
            </p>
        </div>
    );
}

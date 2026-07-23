/**
 * BulkExportDialog: extracted from `KeywordEventBulkContextMenu.tsx`
 * in Plan 25 Step 17. Behaviour and testids are byte-identical.
 */

import { useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    downloadKeywordEventsZip,
    type KeywordEventsExportProgress,
} from "@/lib/keyword-events-sqlite-export";
import type { KeywordEvent } from "@/hooks/use-keyword-events";

export interface BulkExportDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly selectedEvents: ReadonlyArray<KeywordEvent>;
}

// eslint-disable-next-line max-lines-per-function -- JSX-heavy leaf dialog; Plan 25 Step 17
export function BulkExportDialog(props: BulkExportDialogProps): JSX.Element {
    const { open, onOpenChange, selectedEvents } = props;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<KeywordEventsExportProgress | null>(null);

    const handleExport = async (): Promise<void> => {
        setBusy(true);
        setError(null);
        setProgress(null);
        try {
            await downloadKeywordEventsZip(selectedEvents, (p) => {
                setProgress(p);
            });
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Export failed");
        } finally {
            setBusy(false);
            setProgress(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent data-testid="keyword-events-bulk-export-dialog">
                <DialogHeader>
                    <DialogTitle>Export selected as ZIP</DialogTitle>
                    <DialogDescription>
                        Bundles {selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"} into a
                        downloadable .zip containing a real SQLite database
                        (<code>keyword-events.db</code>) plus a
                        readable <code>keyword-events.json</code> snapshot —
                        the same export format the app uses elsewhere.
                    </DialogDescription>
                </DialogHeader>
                {progress && (
                    <div
                        className="space-y-1.5"
                        role="status"
                        aria-live="polite"
                        data-testid="keyword-events-bulk-export-progress"
                    >
                        <Progress value={Math.round(progress.fraction * 100)} />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{progress.label}…</span>
                            <span className="font-mono">
                                {Math.round(progress.fraction * 100)}%
                            </span>
                        </div>
                    </div>
                )}
                {error && (
                    <p className="text-xs text-destructive" role="alert">{error}</p>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
                    <Button
                        onClick={() => { void handleExport(); }}
                        disabled={busy || selectedEvents.length === 0}
                        data-testid="keyword-events-bulk-export-apply"
                    >
                        {busy ? (progress?.label ?? "Building") + "…" : "Download .zip"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

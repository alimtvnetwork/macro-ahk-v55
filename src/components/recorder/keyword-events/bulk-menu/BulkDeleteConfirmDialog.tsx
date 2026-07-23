/**
 * BulkDeleteConfirmDialog: extracted from `KeywordEventBulkContextMenu.tsx`
 * in Plan 25 Step 17. Behaviour and testids are byte-identical.
 */

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { KeywordEvent } from "@/hooks/use-keyword-events";

export interface BulkDeleteConfirmDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly selectedEvents: ReadonlyArray<KeywordEvent>;
    readonly onConfirm: () => void;
}

// eslint-disable-next-line max-lines-per-function -- JSX-heavy leaf dialog; Plan 25 Step 17
export function BulkDeleteConfirmDialog(props: BulkDeleteConfirmDialogProps): JSX.Element {
    const { open, onOpenChange, selectedEvents, onConfirm } = props;
    const count = selectedEvents.length;
    const previewRows = selectedEvents.slice(0, 5);
    const remainder = Math.max(0, count - previewRows.length);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-md"
                onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        onConfirm();
                    }
                }}
                data-testid="keyword-events-bulk-delete-dialog"
            >
                <DialogHeader>
                    <DialogTitle>
                        Delete {count} event{count === 1 ? "" : "s"}?
                    </DialogTitle>
                    <DialogDescription>
                        This permanently removes the selected keyword event
                        {count === 1 ? "" : "s"} and all of their steps. This
                        action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded border border-border/60 bg-muted/30 p-2 text-xs">
                    <ul className="space-y-0.5 font-mono">
                        {previewRows.map((ev) => (
                            <li
                                key={ev.Id}
                                data-testid={`keyword-events-bulk-delete-row-${ev.Id}`}
                                className="truncate"
                            >
                                {ev.Keyword || <span className="italic opacity-70">(unnamed)</span>}
                            </li>
                        ))}
                        {remainder > 0 && (
                            <li className="italic text-muted-foreground">
                                … and {remainder} more
                            </li>
                        )}
                    </ul>
                </div>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        data-testid="keyword-events-bulk-delete-cancel"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={count === 0}
                        data-testid="keyword-events-bulk-delete-confirm"
                    >
                        Delete {count} event{count === 1 ? "" : "s"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

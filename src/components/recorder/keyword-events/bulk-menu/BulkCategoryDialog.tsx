/**
 * BulkCategoryDialog: extracted from `KeywordEventBulkContextMenu.tsx`
 * in Plan 25 Step 17. Behaviour and testids are byte-identical.
 */

import { useMemo, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { collectCategories, normaliseCategory } from "@/lib/keyword-event-bulk-actions";
import type { KeywordEvent } from "@/hooks/use-keyword-events";

export interface BulkCategoryDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly selectedEvents: ReadonlyArray<KeywordEvent>;
    /** undefined means clear category. Trimmed, whitespace-collapsed string means set. */
    readonly onApply: (category: string | undefined) => void;
}

// eslint-disable-next-line max-lines-per-function -- JSX-heavy leaf dialog; Plan 25 Step 17
export function BulkCategoryDialog(props: BulkCategoryDialogProps): JSX.Element {
    const { open, onOpenChange, selectedEvents, onApply } = props;
    const [raw, setRaw] = useState("");
    const existing = useMemo(() => collectCategories(selectedEvents), [selectedEvents]);
    const normalised = normaliseCategory(raw);

    const handleSet = (): void => {
        onApply(normalised);
        setRaw("");
        onOpenChange(false);
    };

    const handleClear = (): void => {
        onApply(undefined);
        setRaw("");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) setRaw(""); onOpenChange(o); }}>
            <DialogContent data-testid="keyword-events-bulk-category-dialog">
                <DialogHeader>
                    <DialogTitle>Set category</DialogTitle>
                    <DialogDescription>
                        Assigns a single category to {selectedEvents.length} selected
                        event{selectedEvents.length === 1 ? "" : "s"}. Categories are a
                        primary grouping bucket — use labels for multi-tagging.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="bulk-category-input">Category</Label>
                        <Input
                            id="bulk-category-input"
                            value={raw}
                            onChange={(e) => setRaw(e.target.value)}
                            placeholder="e.g. Auth, Smoke, Regression"
                            autoFocus
                            data-testid="keyword-events-bulk-category-input"
                        />
                    </div>
                    {existing.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-[11px] text-muted-foreground">
                                Existing categories on selection (click to reuse):
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {existing.map(c => (
                                    <Badge
                                        key={c}
                                        variant="outline"
                                        className="cursor-pointer text-[10px]"
                                        onClick={() => setRaw(c)}
                                    >
                                        {c}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        variant="outline"
                        onClick={handleClear}
                        data-testid="keyword-events-bulk-category-clear"
                    >
                        Clear category
                    </Button>
                    <Button
                        onClick={handleSet}
                        disabled={normalised === undefined}
                        data-testid="keyword-events-bulk-category-apply"
                    >
                        Set
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

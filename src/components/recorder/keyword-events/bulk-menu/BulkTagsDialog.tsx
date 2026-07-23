/**
 * BulkTagsDialog: extracted from `KeywordEventBulkContextMenu.tsx`
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
import { parseTagInput } from "@/lib/keyword-event-bulk-actions";
import type { KeywordEvent } from "@/hooks/use-keyword-events";

export interface BulkTagsDialogProps {
    readonly mode: "add" | "remove";
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly selectedEvents: ReadonlyArray<KeywordEvent>;
    readonly onApply: (tags: string[]) => void;
}

// eslint-disable-next-line max-lines-per-function -- JSX-heavy leaf dialog; Plan 25 Step 17
export function BulkTagsDialog(props: BulkTagsDialogProps): JSX.Element {
    const { mode, open, onOpenChange, selectedEvents, onApply } = props;
    const [raw, setRaw] = useState("");
    const tags = useMemo(() => parseTagInput(raw), [raw]);
    const existing = useMemo(() => {
        const all = new Set<string>();
        for (const ev of selectedEvents) {
            (ev.Tags ?? []).forEach(t => all.add(t));
        }
        return Array.from(all).sort((a, b) => a.localeCompare(b));
    }, [selectedEvents]);

    const handleApply = (): void => {
        if (tags.length === 0) return;
        onApply(tags);
        setRaw("");
        onOpenChange(false);
    };

    const title = mode === "add" ? "Add labels" : "Remove labels";
    const desc = mode === "add"
        ? `Label ${selectedEvents.length} selected event${selectedEvents.length === 1 ? "" : "s"}.`
        : `Remove labels from ${selectedEvents.length} selected event${selectedEvents.length === 1 ? "" : "s"}.`;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) setRaw(""); onOpenChange(o); }}>
            <DialogContent data-testid={`keyword-events-bulk-tags-dialog-${mode}`}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{desc} Separate labels with commas or spaces.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="bulk-tags-input">Labels</Label>
                        <Input
                            id="bulk-tags-input"
                            value={raw}
                            onChange={(e) => setRaw(e.target.value)}
                            placeholder="e.g. login, smoke, regression"
                            autoFocus
                            data-testid="keyword-events-bulk-tags-input"
                        />
                    </div>
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {tags.map(t => (
                                <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                            ))}
                        </div>
                    )}
                    {mode === "remove" && existing.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-[11px] text-muted-foreground">Existing labels on selection:</p>
                            <div className="flex flex-wrap gap-1">
                                {existing.map(t => (
                                    <Badge
                                        key={t}
                                        variant="outline"
                                        className="cursor-pointer text-[10px]"
                                        onClick={() => setRaw(r => r.length === 0 ? t : `${r}, ${t}`)}
                                    >
                                        {t}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={handleApply}
                        disabled={tags.length === 0}
                        data-testid={`keyword-events-bulk-tags-apply-${mode}`}
                    >
                        {mode === "add" ? "Add" : "Remove"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

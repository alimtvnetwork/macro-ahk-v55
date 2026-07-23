/**
 * Drag/drop + choose-file bar for CsvInputDialog.
 */

import { useRef } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface CsvDropZoneProps {
    readonly loadedFileName: string | null;
    readonly dragOver: boolean;
    readonly onDragOverChange: (over: boolean) => void;
    readonly onDropFile: (event: React.DragEvent<HTMLDivElement>) => void;
    readonly onPickFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function CsvDropZone(props: CsvDropZoneProps): JSX.Element {
    const fileInputRef = useRef<HTMLInputElement>(null);
    return (
        <div
            onDragOver={(event) => { event.preventDefault(); if (!props.dragOver) props.onDragOverChange(true); }}
            onDragLeave={() => props.onDragOverChange(false)}
            onDrop={props.onDropFile}
            className={[
                "flex items-center justify-between gap-3 rounded border-2 border-dashed px-3 py-2 text-xs transition-colors",
                props.dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30",
            ].join(" ")}
        >
            <div className="flex items-center gap-2 text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>
                    {props.loadedFileName !== null
                        ? `Loaded: ${props.loadedFileName}`
                        : "Drop a .csv file here, or paste below"}
                </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Choose file
            </Button>
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,application/csv,text/plain"
                className="hidden"
                onChange={props.onPickFile}
            />
        </div>
    );
}

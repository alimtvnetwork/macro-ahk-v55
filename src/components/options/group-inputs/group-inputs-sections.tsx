import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GroupInputBag, parseGroupInputJson } from "@/background/recorder/step-library/group-inputs";

type GroupInputParseResult = ReturnType<typeof parseGroupInputJson>;

interface DropZoneProps {
    readonly dragOver: boolean;
    readonly setDragOver: (value: boolean) => void;
    readonly currentBag: GroupInputBag | null;
    readonly onLoadCurrent: () => void;
    readonly onFilePick: (event: React.ChangeEvent<HTMLInputElement>) => void;
    readonly onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
}

export function DropZone(props: DropZoneProps): JSX.Element {
    const { dragOver, setDragOver, currentBag, onLoadCurrent, onFilePick, onDrop } = props;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const zoneClass = [
        "flex items-center justify-between gap-3 rounded border-2 border-dashed px-3 py-2 text-xs transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30",
    ].join(" ");
    return (
        <div
            onDragOver={(event) => { event.preventDefault(); if (!dragOver) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={zoneClass}
        >
            <div className="flex items-center gap-2 text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>Drop a <code>.json</code> file here, or</span>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Choose file
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLoadCurrent}
                    disabled={currentBag === null}
                    title={currentBag === null ? "No bag is currently applied" : "Reload the saved bag"}
                >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Load current
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={onFilePick}
                />
            </div>
        </div>
    );
}

interface JsonEditorProps {
    readonly text: string;
    readonly setText: (value: string) => void;
    readonly parseResult: GroupInputParseResult;
}

export function JsonEditor({ text, setText, parseResult }: JsonEditorProps): JSX.Element {
    return (
        <div className="space-y-2">
            <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={'{\n  "Email": "you@example.com",\n  "Plan": "pro"\n}'}
                spellCheck={false}
                className="h-56 font-mono text-xs"
                aria-label="JSON input data"
            />
            <div className="min-h-[1.25rem] text-xs"><ParseStatus text={text} parseResult={parseResult} /></div>
        </div>
    );
}

function ParseStatus({ text, parseResult }: { text: string; parseResult: GroupInputParseResult }): JSX.Element {
    if (text.trim() === "") {
        return (
            <span className="text-muted-foreground">
                Tip: keys must match the placeholders in your steps (case-sensitive).
            </span>
        );
    }
    if (parseResult.Ok) {
        return (
            <span className="text-emerald-500">
                Valid: {Object.keys(parseResult.Value).length} variable(s) ready to apply.
            </span>
        );
    }
    return <span className="text-destructive">{parseResult.Reason}</span>;
}

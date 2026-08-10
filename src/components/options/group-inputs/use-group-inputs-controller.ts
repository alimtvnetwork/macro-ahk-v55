/**
 * useGroupInputsController — state + handlers for GroupInputsDialog.
 * Extracted to keep the dialog component under the 50-line component cap.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import {
    parseGroupInputJson,
    type GroupInputBag,
} from "@/background/recorder/step-library/group-inputs";

const MAX_FILE_BYTES = 1024 * 1024; // 1 MB — input bags are tiny.

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface UseGroupInputsControllerArgs {
    readonly open: boolean;
    readonly groupId: number | null;
    readonly groupName: string | null;
    readonly currentBag: GroupInputBag | null;
    readonly onApply: (groupId: number, bag: GroupInputBag) => void;
    readonly onClear: (groupId: number) => void;
    readonly onOpenChange: (open: boolean) => void;
}

function useGroupInputsFileHandlers(setText: (val: string) => void) {
    const { toast } = useToast();
    const handleFile = useCallback(async (file: File) => {
        if (file.size > MAX_FILE_BYTES) {
            toast({ variant: "destructive", title: "File too large", description: `Input bag files must be <= 1 MB (got ${formatBytes(file.size)}).` });
            return;
        }
        try { setText(await file.text()); }
        catch (err) { toast({ variant: "destructive", title: "Could not read file", description: err instanceof Error ? err.message : String(err) }); }
    }, [setText, toast]);

    const handleFilePick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        event.target.value = "";
        if (file !== null) void handleFile(file);
    }, [handleFile]);

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>, setDragOver: (val: boolean) => void) => {
        event.preventDefault();
        setDragOver(false);
        const file = event.dataTransfer.files[0] ?? null;
        if (file !== null) void handleFile(file);
    }, [handleFile]);

    return { handleFilePick, handleDrop };
}

function useGroupInputsApplyHandlers(
    groupId: number | null, groupName: string | null,
    parseResult: { Ok: boolean; Value?: GroupInputBag },
    onApply: (groupId: number, bag: GroupInputBag) => void,
    onClear: (groupId: number) => void,
    onOpenChange: (open: boolean) => void,
    setText: (val: string) => void
) {
    const { toast } = useToast();

    const handleApply = useCallback(() => {
        if (groupId === null || !parseResult.Ok || !parseResult.Value) return;
        onApply(groupId, parseResult.Value);
        toast({ title: "Input data applied", description: `Bound ${Object.keys(parseResult.Value).length} variable(s) to "${groupName ?? "(unknown)"}".` });
        onOpenChange(false);
    }, [groupId, groupName, parseResult, onApply, onOpenChange, toast]);

    const handleClear = useCallback(() => {
        if (groupId === null) return;
        onClear(groupId);
        setText("");
        toast({ title: "Input data cleared", description: `Removed input bag from "${groupName ?? "(unknown)"}".` });
        onOpenChange(false);
    }, [groupId, groupName, onClear, onOpenChange, toast, setText]);

    return { handleApply, handleClear };
}

export function useGroupInputsController(args: UseGroupInputsControllerArgs) {
    const { open, groupId, groupName, currentBag, onApply, onClear, onOpenChange } = args;
    const [text, setText] = useState("");
    const [dragOver, setDragOver] = useState(false);

    useEffect(() => {
        if (open) {
            setText(currentBag === null ? "" : JSON.stringify(currentBag, null, 2));
            setDragOver(false);
        }
    }, [open, currentBag]);

    const parseResult = useMemo(() => parseGroupInputJson(text), [text]);

    const handleLoadCurrent = useCallback(() => {
        setText(currentBag === null ? "" : JSON.stringify(currentBag, null, 2));
    }, [currentBag]);

    const fileHandlers = useGroupInputsFileHandlers(setText);
    const applyHandlers = useGroupInputsApplyHandlers(groupId, groupName, parseResult, onApply, onClear, onOpenChange, setText);

    return {
        text,
        setText,
        dragOver,
        setDragOver,
        parseResult,
        handleLoadCurrent,
        handleFilePick: fileHandlers.handleFilePick,
        handleDrop: (event: React.DragEvent<HTMLDivElement>) => fileHandlers.handleDrop(event, setDragOver),
        handleApply: applyHandlers.handleApply,
        handleClear: applyHandlers.handleClear,
    };
}

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

export function useGroupInputsController(args: UseGroupInputsControllerArgs) {
    const { open, groupId, groupName, currentBag, onApply, onClear, onOpenChange } = args;
    const { toast } = useToast();
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

    const handleFile = useCallback(async (file: File) => {
        if (file.size > MAX_FILE_BYTES) {
            toast({
                variant: "destructive",
                title: "File too large",
                description: `Input bag files must be <= 1 MB (got ${formatBytes(file.size)}).`,
            });
            return;
        }
        try {
            setText(await file.text());
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Could not read file",
                description: err instanceof Error ? err.message : String(err),
            });
        }
    }, [toast]);

    const handleFilePick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        event.target.value = "";
        if (file !== null) void handleFile(file);
    }, [handleFile]);

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragOver(false);
        const file = event.dataTransfer.files[0] ?? null;
        if (file !== null) void handleFile(file);
    }, [handleFile]);

    const handleApply = useCallback(() => {
        if (groupId === null || !parseResult.Ok) return;
        onApply(groupId, parseResult.Value);
        toast({
            title: "Input data applied",
            description: `Bound ${Object.keys(parseResult.Value).length} variable(s) to "${groupName ?? "(unknown)"}".`,
        });
        onOpenChange(false);
    }, [groupId, groupName, parseResult, onApply, onOpenChange, toast]);

    const handleClear = useCallback(() => {
        if (groupId === null) return;
        onClear(groupId);
        setText("");
        toast({
            title: "Input data cleared",
            description: `Removed input bag from "${groupName ?? "(unknown)"}".`,
        });
        onOpenChange(false);
    }, [groupId, groupName, onClear, onOpenChange, toast]);

    return {
        text,
        setText,
        dragOver,
        setDragOver,
        parseResult,
        handleLoadCurrent,
        handleFilePick,
        handleDrop,
        handleApply,
        handleClear,
    };
}

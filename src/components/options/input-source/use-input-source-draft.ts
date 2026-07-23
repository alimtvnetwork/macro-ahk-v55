/**
 * State hook for InputSourceDialog: owns the draft, test-fetch busy flag,
 * last fetch result, and mutation helpers. Keeps the dialog component
 * under the max-lines-per-function / cognitive-complexity caps.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    DEFAULT_INPUT_SOURCE_CONFIG,
    fetchInputSource,
    loadInputSourceConfig,
    saveInputSourceConfig,
    type FetchInputResult,
    type InputSourceConfig,
    type InputSourceHeader,
} from "@/background/recorder/step-library/input-source";

export interface InputSourceDraftApi {
    readonly draft: InputSourceConfig;
    readonly busy: boolean;
    readonly lastResult: FetchInputResult | null;
    readonly previewKeys: ReadonlyArray<string>;
    readonly setDraft: React.Dispatch<React.SetStateAction<InputSourceConfig>>;
    readonly addHeader: () => void;
    readonly updateHeader: (idx: number, patch: Partial<InputSourceHeader>) => void;
    readonly removeHeader: (idx: number) => void;
    readonly handleSave: () => void;
    readonly handleTest: () => Promise<void>;
}

export function useInputSourceDraft(
    open: boolean,
    onOpenChange: (open: boolean) => void,
): InputSourceDraftApi {
    const [draft, setDraft] = useState<InputSourceConfig>(DEFAULT_INPUT_SOURCE_CONFIG);
    const [busy, setBusy] = useState(false);
    const [lastResult, setLastResult] = useState<FetchInputResult | null>(null);

    useEffect(() => {
        if (!open) return;
        setDraft(loadInputSourceConfig());
        setLastResult(null);
    }, [open]);

    const headerHelpers = useHeaderMutators(setDraft);
    const handleSave = useSaveHandler(draft, setDraft, onOpenChange);
    const handleTest = useTestHandler(draft, setBusy, setLastResult);
    const previewKeys = useMemo<ReadonlyArray<string>>(
        () => (lastResult === null || !lastResult.Ok || lastResult.Skipped ? [] : Object.keys(lastResult.Bag)),
        [lastResult],
    );

    return { draft, busy, lastResult, previewKeys, setDraft, ...headerHelpers, handleSave, handleTest };
}

function useHeaderMutators(setDraft: React.Dispatch<React.SetStateAction<InputSourceConfig>>) {
    const updateHeader = useCallback((idx: number, patch: Partial<InputSourceHeader>) => {
        setDraft((prev) => ({
            ...prev,
            Headers: prev.Headers.map((h, i) => (i === idx ? { ...h, ...patch } : h)),
        }));
    }, [setDraft]);
    const addHeader = useCallback(() => {
        setDraft((prev) => ({ ...prev, Headers: [...prev.Headers, { Name: "", Value: "" }] }));
    }, [setDraft]);
    const removeHeader = useCallback((idx: number) => {
        setDraft((prev) => ({ ...prev, Headers: prev.Headers.filter((_, i) => i !== idx) }));
    }, [setDraft]);
    return { addHeader, updateHeader, removeHeader };
}

function useSaveHandler(
    draft: InputSourceConfig,
    setDraft: React.Dispatch<React.SetStateAction<InputSourceConfig>>,
    onOpenChange: (open: boolean) => void,
) {
    return useCallback(() => {
        const saved = saveInputSourceConfig(draft);
        setDraft(saved);
        toast.success("Input source settings saved");
        onOpenChange(false);
    }, [draft, setDraft, onOpenChange]);
}

function useTestHandler(
    draft: InputSourceConfig,
    setBusy: React.Dispatch<React.SetStateAction<boolean>>,
    setLastResult: React.Dispatch<React.SetStateAction<FetchInputResult | null>>,
) {
    return useCallback(async () => {
        if (draft.Url.trim().length === 0) {
            toast.error("Add a URL before sending a test fetch");
            return;
        }
        setBusy(true);
        const result = await fetchInputSource({ config: { ...draft, Enabled: true } });
        setBusy(false);
        setLastResult(result);
        reportTestOutcome(result);
    }, [draft, setBusy, setLastResult]);
}

function reportTestOutcome(result: FetchInputResult): void {
    if (result.Ok && !result.Skipped) {
        const keys = Object.keys(result.Bag);
        toast.success(`Fetched ${keys.length} key(s) (HTTP ${result.Status})`);
        return;
    }
    if (result.Ok && result.Skipped) {
        toast.warning(`Skipped: ${result.SkipReason}`);
        return;
    }
    toast.error(`Fetch failed: ${result.Error}`);
}

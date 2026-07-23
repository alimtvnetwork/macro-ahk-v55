/**
 * Marco Extension — StepWaitDialog state hook.
 *
 * Owns selector/kind/condition/timeout state, hydrates from persisted
 * config on open, and exposes save/test/clear handlers. Keeps the
 * dialog shell presentational and under the 50-line cap.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    DEFAULT_WAIT_CONFIG,
    clearStepWait,
    detectSelectorKind,
    evaluateSelector,
    readStepWait,
    validateSelector,
    writeStepWait,
    type ElementLike,
    type SelectorKind,
    type WaitCondition,
    type WaitConfig,
} from "@/background/recorder/step-library/step-wait";

export type KindMode = "Auto" | "Css" | "XPath";

export interface TestResult {
    readonly Kind: SelectorKind;
    readonly TotalCount: number;
    readonly VisibleCount: number;
    readonly DurationMs: number;
    readonly Error: string | null;
}

function countVisible(matches: ReadonlyArray<ElementLike>): number {
    let n = 0;
    for (const node of matches) {
        const w = typeof node.offsetWidth === "number" ? node.offsetWidth : 0;
        const h = typeof node.offsetHeight === "number" ? node.offsetHeight : 0;
        if (w > 0 || h > 0) { n += 1; continue; }
        if (typeof node.getClientRects === "function" && node.getClientRects().length > 0) { n += 1; }
    }
    return n;
}

interface Args {
    readonly open: boolean;
    readonly stepId: number | null;
    readonly onChange?: () => void;
    readonly onOpenChange: (open: boolean) => void;
}

function hydrateFromExisting(stepId: number, setters: {
    setSelector: (v: string) => void;
    setKindMode: (v: KindMode) => void;
    setCondition: (v: WaitCondition) => void;
    setTimeoutMs: (v: number) => void;
    setHasExisting: (v: boolean) => void;
}): void {
    const existing = readStepWait(stepId);
    if (existing === null) {
        setters.setSelector("");
        setters.setKindMode("Auto");
        setters.setCondition(DEFAULT_WAIT_CONFIG.Condition);
        setters.setTimeoutMs(DEFAULT_WAIT_CONFIG.TimeoutMs);
        setters.setHasExisting(false);
        return;
    }
    setters.setSelector(existing.Selector);
    setters.setKindMode(existing.Kind);
    setters.setCondition(existing.Condition);
    setters.setTimeoutMs(existing.TimeoutMs);
    setters.setHasExisting(true);
}

function runSelectorEvaluation(selector: string, kind: SelectorKind): TestResult {
    const startedAt = performance.now();
    try {
        const matches = evaluateSelector({ Selector: selector.trim(), Kind: kind });
        const elapsed = Math.max(0, Math.round(performance.now() - startedAt));
        return { Kind: kind, TotalCount: matches.length, VisibleCount: countVisible(matches), DurationMs: elapsed, Error: null };
    } catch (e) {
        const detail = e instanceof Error ? e.message : "Unknown evaluation error";
        return { Kind: kind, TotalCount: 0, VisibleCount: 0, DurationMs: Math.max(0, Math.round(performance.now() - startedAt)), Error: detail };
    }
}

export function useStepWaitDialog(args: Args) {
    const { open, stepId, onChange, onOpenChange } = args;
    const [selector, setSelector] = useState("");
    const [kindMode, setKindMode] = useState<KindMode>("Auto");
    const [condition, setCondition] = useState<WaitCondition>(DEFAULT_WAIT_CONFIG.Condition);
    const [timeoutMs, setTimeoutMs] = useState<number>(DEFAULT_WAIT_CONFIG.TimeoutMs);
    const [hasExisting, setHasExisting] = useState(false);
    const [testResult, setTestResult] = useState<TestResult | null>(null);

    useEffect(() => {
        if (!open || stepId === null) return;
        hydrateFromExisting(stepId, { setSelector, setKindMode, setCondition, setTimeoutMs, setHasExisting });
        setTestResult(null);
    }, [open, stepId]);

    useEffect(() => { setTestResult(null); }, [selector, kindMode]);

    const detected: SelectorKind = useMemo(() => detectSelectorKind(selector), [selector]);
    const effectiveKind: SelectorKind = kindMode === "Auto" ? detected : kindMode;

    const validation = useMemo(
        () => selector.trim().length === 0
            ? { Ok: true as const, Kind: effectiveKind }
            : validateSelector(selector, effectiveKind),
        [selector, effectiveKind],
    );

    const handleSave = () => {
        if (stepId === null) return;
        if (selector.trim().length === 0) { toast.error("Selector is required"); return; }
        if (!validation.Ok) { toast.error(validation.Reason); return; }
        const next: WaitConfig = { Selector: selector.trim(), Kind: effectiveKind, Condition: condition, TimeoutMs: timeoutMs };
        try {
            writeStepWait(stepId, next);
            toast.success("Wait condition saved");
            onChange?.();
            onOpenChange(false);
        } catch (e) {
            const detail = e instanceof Error ? e.message : "Unknown error";
            toast.error(`Could not save: ${detail}`);
        }
    };

    const handleTest = () => {
        if (selector.trim().length === 0) { toast.error("Enter a selector first"); return; }
        if (!validation.Ok) {
            setTestResult({ Kind: effectiveKind, TotalCount: 0, VisibleCount: 0, DurationMs: 0, Error: validation.Reason });
            return;
        }
        setTestResult(runSelectorEvaluation(selector, effectiveKind));
    };

    const handleClear = () => {
        if (stepId === null) return;
        clearStepWait(stepId);
        toast.success("Wait condition cleared");
        onChange?.();
        onOpenChange(false);
    };

    return {
        selector, setSelector, kindMode, setKindMode, condition, setCondition,
        timeoutMs, setTimeoutMs, hasExisting, testResult,
        detected, effectiveKind, validation,
        handleSave, handleTest, handleClear,
    };
}

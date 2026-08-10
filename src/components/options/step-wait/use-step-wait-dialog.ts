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
import { SelectorKindType } from "../../../types/enums";

export type KindMode = SelectorKindType;

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

function performSave(
    stepId: number, selector: string, effectiveKind: SelectorKind, condition: WaitCondition, timeoutMs: number,
    validation: { Ok: boolean; Reason?: string }, onChange: (() => void) | undefined, onOpenChange: (open: boolean) => void
) {
    if (selector.trim().length === 0) { toast.error("Selector is required");

 return; }
    if (!validation.Ok) { toast.error(validation.Reason);

 return; }
    try {
        writeStepWait(stepId, { Selector: selector.trim(), Kind: effectiveKind, Condition: condition, TimeoutMs: timeoutMs });
        toast.success("Wait condition saved");
        onChange?.();
        onOpenChange(false);
    } catch (e) {
        toast.error(`Could not save: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
}

function performTest(
    selector: string, effectiveKind: SelectorKind, validation: { Ok: boolean; Reason?: string }, setTestResult: (r: TestResult | null) => void
) {
    if (selector.trim().length === 0) { toast.error("Enter a selector first");

 return; }
    if (!validation.Ok) {
        setTestResult({ Kind: effectiveKind, TotalCount: 0, VisibleCount: 0, DurationMs: 0, Error: validation.Reason! });

        return;
    }
    setTestResult(runSelectorEvaluation(selector, effectiveKind));
}

function useStepWaitState(open: boolean, stepId: number | null) {
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

        return;
    }
    setTestResult(runSelectorEvaluation(selector, effectiveKind));
}

function useStepWaitState(open: boolean, stepId: number | null) {
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

    return { selector, setSelector, kindMode, setKindMode, condition, setCondition, timeoutMs, setTimeoutMs, hasExisting, testResult, setTestResult };
}

export function useStepWaitDialog(args: Args) {
    const state = useStepWaitState(args.open, args.stepId);
    const detected: SelectorKind = useMemo(() => detectSelectorKind(state.selector), [state.selector]);
    const effectiveKind: SelectorKind = state.kindMode === "Auto" ? detected : state.kindMode;
    const validation = useMemo(
        () => state.selector.trim().length === 0 ? { Ok: true as const, Kind: effectiveKind } : validateSelector(state.selector, effectiveKind),
        [state.selector, effectiveKind]
    );

    const handleSave = () => { if (args.stepId !== null) performSave(args.stepId, state.selector, effectiveKind, state.condition, state.timeoutMs, validation as unknown as { Ok: boolean; Reason?: string }, args.onChange, args.onOpenChange); };
    const handleTest = () => performTest(state.selector, effectiveKind, validation as unknown as { Ok: boolean; Reason?: string }, state.setTestResult);
    const handleClear = () => {
        if (args.stepId === null) return;
        clearStepWait(args.stepId);
        toast.success("Wait condition cleared");
        args.onChange?.();
        args.onOpenChange(false);
    };

    return { ...state, detected, effectiveKind, validation, handleSave, handleTest, handleClear };
}

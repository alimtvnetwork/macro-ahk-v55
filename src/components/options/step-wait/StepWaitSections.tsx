/**
 * Marco Extension — StepWaitDialog sub-sections.
 *
 * Presentational fragments split out of StepWaitDialog to keep the
 * shell component under the 50-line cap. Each helper renders one
 * self-contained control group.
 */

import { CheckCircle2, Eye, EyeOff, MousePointer2, SearchCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { SelectorKind, WaitCondition } from "@/background/recorder/step-library/step-wait";
import type { KindMode, TestResult } from "./use-step-wait-dialog";

const CONDITION_LABELS: Record<WaitCondition, string> = {
    Appears: "Element appears in DOM",
    Disappears: "Element disappears from DOM",
    Visible: "Element is visible (has layout)",
};

const CONDITION_ICON: Record<WaitCondition, typeof Eye> = {
    Appears: MousePointer2,
    Disappears: EyeOff,
    Visible: Eye,
};

function TestResultLine({ result }: { readonly result: TestResult }) {
    if (result.Error !== null) {
        return (
            <span className="flex items-center gap-1 text-xs text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                {result.Error}
            </span>
        );
    }
    const tone = result.TotalCount > 0
        ? "flex items-center gap-1 text-xs text-emerald-500"
        : "flex items-center gap-1 text-xs text-amber-500";
    return (
        <span className={tone}>
            {result.TotalCount > 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {result.TotalCount} match{result.TotalCount === 1 ? "" : "es"}
            {result.TotalCount > 0 && (
                <span className="text-muted-foreground">· {result.VisibleCount} visible</span>
            )}
            <span className="text-muted-foreground">· {result.DurationMs} ms</span>
        </span>
    );
}

interface SelectorFieldProps {
    readonly selector: string;
    readonly setSelector: (v: string) => void;
    readonly kindMode: KindMode;
    readonly detected: SelectorKind;
    readonly effectiveKind: SelectorKind;
    readonly validation: { readonly Ok: boolean; readonly Reason?: string };
    readonly testResult: TestResult | null;
    readonly onTest: () => void;
}

export function SelectorField(props: SelectorFieldProps) {
    const { selector, setSelector, kindMode, detected, effectiveKind, validation, testResult, onTest } = props;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label htmlFor="wait-selector" className="text-sm font-medium">Selector</Label>
                {selector.trim().length > 0 && (
                    <Badge variant={kindMode === "Auto" ? "secondary" : "outline"}>
                        {kindMode === "Auto" ? `Auto · ${detected}` : effectiveKind}
                    </Badge>
                )}
            </div>
            <Input
                id="wait-selector"
                placeholder="#submit-confirmation, .loading, //div[@id='ok']"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                className="font-mono text-sm"
            />
            {!validation.Ok && <p className="text-xs text-destructive">{validation.Reason}</p>}
            <p className="text-xs text-muted-foreground">
                Auto-detect picks XPath when the expression starts with <code>/</code>,
                <code> ./</code>, <code>(/</code>, <code>(./</code>, or contains <code>//</code>.
            </p>
            <div className="flex items-center gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={onTest} disabled={selector.trim().length === 0}>
                    <SearchCheck className="mr-1 h-3.5 w-3.5" />
                    Test selector
                </Button>
                {testResult !== null && <TestResultLine result={testResult} />}
            </div>
            {testResult !== null && testResult.Error === null && testResult.TotalCount === 0 && (
                <p className="text-xs text-muted-foreground">
                    No elements matched on the current options page. The selector will still be
                    evaluated against the recorder's target tab at run time; this preview only
                    catches typos and compile errors.
                </p>
            )}
        </div>
    );
}

export function KindModeField({ value, onChange }: { readonly value: KindMode; readonly onChange: (v: KindMode) => void }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Selector type</Label>
            <Select value={value} onValueChange={(v) => onChange(v as KindMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Auto">Auto-detect</SelectItem>
                    <SelectItem value="Css">Force CSS</SelectItem>
                    <SelectItem value="XPath">Force XPath</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}

export function ConditionField({ value, onChange }: { readonly value: WaitCondition; readonly onChange: (v: WaitCondition) => void }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Condition</Label>
            <Select value={value} onValueChange={(v) => onChange(v as WaitCondition)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    {(["Appears", "Visible", "Disappears"] as const).map((c) => {
                        const Icon = CONDITION_ICON[c];
                        return (
                            <SelectItem key={c} value={c}>
                                <span className="flex items-center gap-2">
                                    <Icon className="h-3.5 w-3.5" />
                                    {CONDITION_LABELS[c]}
                                </span>
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
}

export function TimeoutField({ value, onChange }: { readonly value: number; readonly onChange: (v: number) => void }) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor="wait-timeout" className="text-xs text-muted-foreground">
                Timeout (ms, 250 to 60 000)
            </Label>
            <Input
                id="wait-timeout"
                type="number"
                min={250}
                max={60000}
                step={250}
                value={value}
                onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || value)}
            />
        </div>
    );
}

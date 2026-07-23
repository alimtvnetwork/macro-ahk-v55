/**
 * Marco Extension — FailureReportsPanel toolbar.
 *
 * Presentational: renders the export/copy/step-picker controls in the
 * panel header. All handlers come from `useFailureReportsPanel`.
 */

import { Button } from "@/components/ui/button";
import { FileDown, ClipboardCopy } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { ExportFormat } from "../failure-export";
import { STEP_OPTION_NULL } from "./use-failure-reports-panel";

interface StepOption {
    readonly StepId: number | null;
    readonly StepKind: string | null;
    readonly Count: number;
}

interface Props {
    readonly reportsLength: number;
    readonly allSelected: boolean;
    readonly noneSelected: boolean;
    readonly exportFormat: ExportFormat;
    readonly setExportFormat: (v: ExportFormat) => void;
    readonly validPickedStep: string | null;
    readonly setPickedStep: (v: string | null) => void;
    readonly stepOptions: ReadonlyArray<StepOption>;
    readonly toggleAll: () => void;
    readonly onExport: () => void;
    readonly onExportLast: () => void;
    readonly onCopyLast: () => void;
    readonly onExportByStep: () => void;
}

function stepOptionValue(o: StepOption): string {
    return o.StepId === null ? STEP_OPTION_NULL : String(o.StepId);
}

function stepOptionLabel(o: StepOption): string {
    const label = o.StepId === null ? "(no Step ID)" : `Step #${o.StepId}`;
    const kind = o.StepKind ? ` · ${o.StepKind}` : "";
    const count = o.Count > 1 ? ` ×${o.Count}` : "";
    return `${label}${kind}${count}`;
}

function FormatSelect({ value, onChange }: { readonly value: ExportFormat; readonly onChange: (v: ExportFormat) => void }) {
    return (
        <Select value={value} onValueChange={(v) => onChange(v as ExportFormat)}>
            <SelectTrigger
                className="h-8 w-[140px] text-xs"
                aria-label="JSON output format for exported failure reports"
                title="Pretty (2-space indent, easier to read) or Minified (single line, smaller files)"
            >
                <SelectValue placeholder="Format…" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="pretty">Pretty JSON</SelectItem>
                <SelectItem value="minified">Minified JSON</SelectItem>
            </SelectContent>
        </Select>
    );
}

function StepPicker(props: {
    readonly value: string | null;
    readonly setValue: (v: string | null) => void;
    readonly options: ReadonlyArray<StepOption>;
    readonly onExport: () => void;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <Select
                value={props.value ?? ""}
                onValueChange={(v) => props.setValue(v === "" ? null : v)}
                disabled={props.options.length === 0}
            >
                <SelectTrigger className="h-8 w-[180px] text-xs" aria-label="Choose a Step ID to export its latest failure">
                    <SelectValue placeholder="Pick step…" />
                </SelectTrigger>
                <SelectContent>
                    {props.options.map((o) => (
                        <SelectItem key={stepOptionValue(o)} value={stepOptionValue(o)}>
                            {stepOptionLabel(o)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={props.onExport} disabled={props.value === null}
                aria-label="Export the latest failure report for the picked Step ID"
                title="Download the most recent failure report for the picked Step ID as JSON">
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                Export step
            </Button>
        </div>
    );
}

export function FailureReportsToolbar(props: Props) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={props.toggleAll} disabled={props.reportsLength === 0}>
                {props.allSelected ? "Clear" : "Select all"}
            </Button>
            <FormatSelect value={props.exportFormat} onChange={props.setExportFormat} />
            <Button variant="outline" size="sm" onClick={props.onCopyLast} disabled={props.reportsLength === 0}
                aria-label="Copy last failure report JSON to clipboard"
                title="Copy the most recent failure report JSON to the clipboard">
                <ClipboardCopy className="h-3.5 w-3.5 mr-1.5" />
                Copy last failure JSON
            </Button>
            <Button variant="outline" size="sm" onClick={props.onExportLast} disabled={props.reportsLength === 0}
                aria-label="Export last failure report as JSON"
                title="Download the most recent failure report as JSON">
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                Export last failure
            </Button>
            <StepPicker value={props.validPickedStep} setValue={props.setPickedStep} options={props.stepOptions} onExport={props.onExportByStep} />
            <Button variant="default" size="sm" onClick={props.onExport} disabled={props.noneSelected}
                aria-label="Export selected failure reports">
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                Export failure reports
            </Button>
        </div>
    );
}

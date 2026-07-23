/**
 * Marco Extension, FailureReportsPanel state hook.
 *
 * Extracts the selection/expansion/format state and all export handlers
 * out of the FailureReportsPanel component so the JSX shell stays under
 * the 50-line cap and each helper function stays under the 15-line cap.
 */

import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import type { FailureReport } from "@/background/recorder/failure-logger";
import {
    buildFailureBundle,
    serializeFailureBundle,
    serializeJson,
    buildFailureBundleFilename,
    pickLastFailureReport,
    buildLastFailureFilename,
    listStepFailureOptions,
    pickFailureReportByStepId,
    DEFAULT_EXPORT_FORMAT,
    type ExportFormat,
    type StepFailureOption,
} from "../failure-export";
import { validateFailureReportPayload } from "../failure-report-validator";

export const STEP_OPTION_NULL = "__null_step__";

export function rowKey(r: FailureReport, idx: number): string {
    return `${r.Timestamp}#${r.StepId ?? "noid"}#${idx}`;
}

export function defaultCopy(contents: string): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
        return Promise.reject(new Error("Clipboard API unavailable in this context"));
    }
    return navigator.clipboard.writeText(contents);
}

export function defaultDownload(filename: string, contents: string): void {
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

interface UseFailureReportsPanelArgs {
    readonly reports: ReadonlyArray<FailureReport>;
    readonly onDownload?: (filename: string, contents: string) => void;
    readonly onCopy?: (contents: string) => Promise<void>;
}

interface PanelState {
    readonly selected: ReadonlySet<string>;
    readonly setSelected: Dispatch<SetStateAction<ReadonlySet<string>>>;
    readonly expanded: ReadonlySet<string>;
    readonly setExpanded: Dispatch<SetStateAction<ReadonlySet<string>>>;
    readonly pickedStep: string | null;
    readonly setPickedStep: Dispatch<SetStateAction<string | null>>;
    readonly exportFormat: ExportFormat;
    readonly setExportFormat: Dispatch<SetStateAction<ExportFormat>>;
}

interface ActionContext {
    readonly reports: ReadonlyArray<FailureReport>;
    readonly state: PanelState;
    readonly validPickedStep: string | null;
    readonly download: (filename: string, contents: string) => void;
    readonly copy: (contents: string) => Promise<void>;
}

function toggleInSet(prev: ReadonlySet<string>, key: string): Set<string> {
    const next = new Set(prev);
    if (next.has(key)) { next.delete(key); } else { next.add(key); }
    return next;
}

function warnOrSuccess(filename: string, contents: string, okMessage: string, warnMessage: string): void {
    const validation = validateFailureReportPayload(contents);
    if (!validation.Valid) {
        toast.warning(warnMessage, { description: validation.Summary });
    } else {
        toast.success(okMessage);
    }
}

export function useFailureReportsPanel(args: UseFailureReportsPanelArgs) {
    const { reports, onDownload, onCopy } = args;
    const state = usePanelState();
    const stepOptions = useMemo(() => listStepFailureOptions(reports), [reports]);
    const allKeys = useMemo(() => reports.map((r, i) => rowKey(r, i)), [reports]);
    const validPickedStep = useValidPickedStep(state.pickedStep, stepOptions);
    const allSelected = state.selected.size > 0 && state.selected.size === reports.length;
    const actions = buildActions({ reports, state, validPickedStep, download: onDownload ?? defaultDownload, copy: onCopy ?? defaultCopy });

    return {
        selected: state.selected, expanded: state.expanded, exportFormat: state.exportFormat, setExportFormat: state.setExportFormat,
        validPickedStep, setPickedStep: state.setPickedStep, stepOptions,
        allSelected, noneSelected: state.selected.size === 0,
        toggle: actions.toggle, toggleExpanded: actions.toggleExpanded,
        toggleAll: () => state.setSelected(allSelected ? new Set() : new Set(allKeys)),
        handleExport: actions.handleExport, handleExportLast: actions.handleExportLast,
        handleCopyLast: actions.handleCopyLast, handleExportByStep: actions.handleExportByStep,
    };
}

function usePanelState(): PanelState {
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
    const [pickedStep, setPickedStep] = useState<string | null>(null);
    const [exportFormat, setExportFormat] = useState<ExportFormat>(DEFAULT_EXPORT_FORMAT);
    return { selected, setSelected, expanded, setExpanded, pickedStep, setPickedStep, exportFormat, setExportFormat };
}

function useValidPickedStep(pickedStep: string | null, stepOptions: ReadonlyArray<StepFailureOption>): string | null {
    return useMemo(() => {
        if (pickedStep === null) return null;
        const exists = stepOptions.some(
            (o) => (o.StepId === null ? STEP_OPTION_NULL : String(o.StepId)) === pickedStep,
        );
        return exists ? pickedStep : null;
    }, [pickedStep, stepOptions]);
}

function buildActions(context: ActionContext) {
    const toggle = (key: string) => context.state.setSelected((prev) => toggleInSet(prev, key));
    const toggleExpanded = (key: string) => context.state.setExpanded((prev) => toggleInSet(prev, key));
    return {
        toggle,
        toggleExpanded,
        handleExport: () => handleExport(context),
        handleExportLast: () => handleExportLast(context),
        handleCopyLast: () => handleCopyLast(context),
        handleExportByStep: () => handleExportByStep(context),
    };
}

function handleExport(context: ActionContext): void {
    const picked = context.reports.filter((report, index) => context.state.selected.has(rowKey(report, index)));
    if (picked.length === 0) { toast.error("Select at least one failure to export"); return; }
    const filename = buildFailureBundleFilename();
    const contents = serializeFailureBundle(buildFailureBundle(picked), context.state.exportFormat);
    context.download(filename, contents);
    const label = `${picked.length} failure report${picked.length === 1 ? "" : "s"}`;
    warnOrSuccess(filename, contents, `Exported ${label}`, `Exported ${filename}, schema warning`);
}

function handleExportLast(context: ActionContext): void {
    const last = pickLastFailureReport(context.reports);
    if (last === null) { toast.error("No failures recorded yet"); return; }
    const filename = buildLastFailureFilename(last);
    const contents = serializeJson(last, context.state.exportFormat);
    context.download(filename, contents);
    warnOrSuccess(filename, contents, `Downloaded ${filename}`, `Downloaded ${filename}, schema warning`);
}

async function handleCopyLast(context: ActionContext): Promise<void> {
    const last = pickLastFailureReport(context.reports);
    if (last === null) { toast.error("No failures recorded yet"); return; }
    const contents = serializeJson(last, context.state.exportFormat);
    try { await context.copy(contents); }
    catch (error) { toast.error("Copy failed, clipboard unavailable", { description: (error as Error).message }); return; }
    const stepLabel = last.StepId !== null ? ` (Step #${last.StepId})` : "";
    warnOrSuccess("", contents, `Copied last failure${stepLabel} to clipboard`, `Copied last failure${stepLabel}, schema warning`);
}

function handleExportByStep(context: ActionContext): void {
    if (context.validPickedStep === null) { toast.error("Pick a Step first"); return; }
    const stepId = context.validPickedStep === STEP_OPTION_NULL ? null : Number(context.validPickedStep);
    const report = pickFailureReportByStepId(context.reports, stepId);
    if (report === null) { showMissingStepToast(stepId); return; }
    const filename = buildLastFailureFilename(report);
    const contents = serializeJson(report, context.state.exportFormat);
    context.download(filename, contents);
    warnOrSuccess(filename, contents, `Downloaded ${filename}`, `Downloaded ${filename}, schema warning`);
}

function showMissingStepToast(stepId: number | null): void {
    toast.error(stepId === null ? "No failures without a Step ID" : `No failures recorded for Step #${stepId}`);
}

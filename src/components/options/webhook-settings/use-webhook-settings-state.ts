/**
 * State + handlers extracted from WebhookSettingsDialog so the top-level
 * component and each hook stay within max-lines-per-function caps.
 * Composed as: draft state + log state + orchestration.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    ALL_WEBHOOK_EVENTS,
    DEFAULT_WEBHOOK_CONFIG,
    clearDeliveryLog,
    dispatchWebhook,
    getDeliveryLog,
    isWebhookSkipped,
    isWebhookSuccess,
    loadWebhookConfig,
    repairDeliveryLog,
    saveWebhookConfig,
    type WebhookConfig,
    type WebhookDeliveryResult,
    type WebhookEventKind,
    type WebhookHeader,
} from "@/background/recorder/step-library/result-webhook";

import { isCorruptPlaceholder } from "./delivery-log-utils";
import type { StatusFilter } from "./DeliveryLogSection";

export interface LogCounts { readonly all: number; readonly success: number; readonly skipped: number; readonly failure: number; }

function computeLogCounts(log: ReadonlyArray<WebhookDeliveryResult>): LogCounts {
    let success = 0, skipped = 0, failure = 0;
    for (const entry of log) {
        if (isWebhookSkipped(entry)) skipped += 1;
        else if (isWebhookSuccess(entry)) success += 1;
        else failure += 1;
    }
    return { all: log.length, success, skipped, failure };
}

function entryMatchesStatus(entry: WebhookDeliveryResult, filter: StatusFilter): boolean {
    if (filter === "skipped") return isWebhookSkipped(entry);
    if (filter === "success") return isWebhookSuccess(entry);
    if (filter === "failure") return !isWebhookSkipped(entry) && !isWebhookSuccess(entry);
    return true;
}

function entryMatchesQuery(entry: WebhookDeliveryResult, query: string): boolean {
    if (query.length === 0) return true;
    const event = entry.Event?.toLowerCase() ?? "";
    const emitted = entry.EmittedAt?.toLowerCase() ?? "";
    const statusValue = isWebhookSkipped(entry) ? null : entry.Status;
    const status = statusValue === null || statusValue === undefined ? "" : String(statusValue);
    return event.includes(query) || emitted.includes(query) || status.includes(query);
}

function filterLog(log: ReadonlyArray<WebhookDeliveryResult>, statusFilter: StatusFilter, searchQuery: string): ReadonlyArray<WebhookDeliveryResult> {
    const query = searchQuery.trim().toLowerCase();
    return log.filter((entry) => entryMatchesStatus(entry, statusFilter) && entryMatchesQuery(entry, query));
}

function buildTestPayload() {
    return { ProjectId: 0, GroupId: 0, GroupName: "Webhook Test Ping", DurationMs: 0, StepsExecuted: 0, Outcome: "Succeeded" as const, IsTest: true };
}

function announceTestResult(result: WebhookDeliveryResult): void {
    if (isWebhookSkipped(result)) toast.warning(`Skipped: ${result.SkipReason}`);
    else if (isWebhookSuccess(result)) toast.success(`Webhook reached endpoint (HTTP ${result.Status})`);
    else toast.error(`Webhook failed: ${result.Error}`);
}

function announceRepairResult(report: { Removed: number; Kept: number; Errors: readonly string[] }): void {
    if (report.Removed === 0 && report.Errors.length === 0) toast.success("No corrupted entries found , log is clean");
    else if (report.Removed === 0 && report.Errors.length > 0) toast.success(`Reset corrupted webhook log storage (${report.Errors[0]})`);
    else toast.success(`Repaired webhook log , removed ${report.Removed} corrupted entr${report.Removed === 1 ? "y" : "ies"}, kept ${report.Kept}`);
}

function useDraftHandlers(setDraft: React.Dispatch<React.SetStateAction<WebhookConfig>>) {
    const toggleEvent = (kind: WebhookEventKind, on: boolean) => setDraft((prev) => {
        const next = new Set(prev.Events);
        if (on) next.add(kind); else next.delete(kind);
        return { ...prev, Events: ALL_WEBHOOK_EVENTS.filter((k) => next.has(k)) };
    });
    const updateHeader = (idx: number, patch: Partial<WebhookHeader>) => setDraft((prev) => ({ ...prev, Headers: prev.Headers.map((h, i) => (i === idx ? { ...h, ...patch } : h)) }));
    const addHeader = () => setDraft((prev) => ({ ...prev, Headers: [...prev.Headers, { Name: "", Value: "" }] }));
    const removeHeader = (idx: number) => setDraft((prev) => ({ ...prev, Headers: prev.Headers.filter((_, i) => i !== idx) }));
    return { toggleEvent, updateHeader, addHeader, removeHeader };
}

function useWebhookDraft(open: boolean) {
    const [draft, setDraft] = useState<WebhookConfig>(DEFAULT_WEBHOOK_CONFIG);
    useEffect(() => { if (open) setDraft(loadWebhookConfig()); }, [open]);
    const eventSet = useMemo(() => new Set(draft.Events), [draft.Events]);
    const handlers = useDraftHandlers(setDraft);
    return { draft, setDraft, eventSet, ...handlers };
}

function useWebhookLog(open: boolean) {
    const [log, setLog] = useState<ReadonlyArray<WebhookDeliveryResult>>([]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
    const [payloadOpenIdx, setPayloadOpenIdx] = useState<number | null>(null);
    useEffect(() => { if (open) { setLog(getDeliveryLog()); setSearchQuery(""); } }, [open]);
    const logCounts = useMemo(() => computeLogCounts(log), [log]);
    const filteredLog = useMemo(() => filterLog(log, statusFilter, searchQuery), [log, statusFilter, searchQuery]);
    const corruptCount = useMemo(() => log.reduce((acc, e) => acc + (isCorruptPlaceholder(e) ? 1 : 0), 0), [log]);
    return { log, setLog, statusFilter, setStatusFilter, searchQuery, setSearchQuery, expandedIdx, setExpandedIdx, payloadOpenIdx, setPayloadOpenIdx, logCounts, filteredLog, corruptCount };
}

function useTestHandler(draft: WebhookConfig, setDraft: React.Dispatch<React.SetStateAction<WebhookConfig>>, setLog: (log: ReadonlyArray<WebhookDeliveryResult>) => void, setBusy: (v: boolean) => void) {
    return async () => {
        const cfgToUse = saveWebhookConfig({ ...draft, Enabled: true });
        setDraft(cfgToUse);
        if (cfgToUse.Url.trim().length === 0) { toast.error("Add a URL before sending a test ping"); return; }
        setBusy(true);
        const result = await dispatchWebhook("GroupRunSucceeded", buildTestPayload(), { config: cfgToUse });
        setBusy(false);
        setLog(getDeliveryLog());
        announceTestResult(result);
    };
}

function useRepairHandler(logCtl: ReturnType<typeof useWebhookLog>, setRepairBusy: (v: boolean) => void, setRepairConfirmOpen: (v: boolean) => void) {
    return () => {
        setRepairBusy(true);
        try {
            const report = repairDeliveryLog();
            logCtl.setLog(getDeliveryLog()); logCtl.setExpandedIdx(null); logCtl.setPayloadOpenIdx(null);
            announceRepairResult(report);
        } catch (err) {
            toast.error(`Repair failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setRepairBusy(false); setRepairConfirmOpen(false);
        }
    };
}

export function useWebhookSettingsState(open: boolean, onOpenChange: (open: boolean) => void) {
    const draftCtl = useWebhookDraft(open);
    const logCtl = useWebhookLog(open);
    const [busy, setBusy] = useState(false);
    const [repairConfirmOpen, setRepairConfirmOpen] = useState(false);
    const [repairBusy, setRepairBusy] = useState(false);
    const handleSave = () => { const saved = saveWebhookConfig(draftCtl.draft); draftCtl.setDraft(saved); toast.success("Webhook settings saved"); onOpenChange(false); };
    const handleTest = useTestHandler(draftCtl.draft, draftCtl.setDraft, logCtl.setLog, setBusy);
    const handleClearLog = () => { clearDeliveryLog(); logCtl.setLog([]); logCtl.setExpandedIdx(null); logCtl.setPayloadOpenIdx(null); };
    const refreshLog = () => logCtl.setLog(getDeliveryLog());
    const handleRepair = useRepairHandler(logCtl, setRepairBusy, setRepairConfirmOpen);
    return { ...draftCtl, ...logCtl, busy, repairConfirmOpen, setRepairConfirmOpen, repairBusy, handleSave, handleTest, handleClearLog, refreshLog, handleRepair };
}

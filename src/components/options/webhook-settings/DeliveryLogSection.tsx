/**
 * Marco Extension — Delivery-log section for WebhookSettingsDialog.
 *
 * Extracted from `WebhookSettingsDialog.tsx` (v4.213.0) as part of Plan-24
 * SS-05 so the parent component drops below the `max-lines-per-function`
 * warning threshold. All state remains owned by the parent dialog; this
 * component is a pure presentation of the "Recent deliveries" section.
 */

import { ChevronDown, Copy, Download, RefreshCw, Search, Send, Webhook, Wrench, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
    isWebhookFailure,
    isWebhookSkipped,
    isWebhookSuccess,
    type WebhookDeliveryResult,
} from "@/background/recorder/step-library/result-webhook";

import {
    copyLogEntry,
    exportFilteredLog,
    formatPayloadJson,
    formatTime,
    presentVariant,
} from "./delivery-log-utils";

export type StatusFilter = "all" | "success" | "skipped" | "failure";

export interface LogCounts {
    readonly all: number;
    readonly success: number;
    readonly skipped: number;
    readonly failure: number;
}

interface Props {
    readonly log: ReadonlyArray<WebhookDeliveryResult>;
    readonly filteredLog: ReadonlyArray<WebhookDeliveryResult>;
    readonly logCounts: LogCounts;
    readonly statusFilter: StatusFilter;
    readonly setStatusFilter: Dispatch<SetStateAction<StatusFilter>>;
    readonly searchQuery: string;
    readonly setSearchQuery: Dispatch<SetStateAction<string>>;
    readonly expandedIdx: number | null;
    readonly setExpandedIdx: Dispatch<SetStateAction<number | null>>;
    readonly payloadOpenIdx: number | null;
    readonly setPayloadOpenIdx: Dispatch<SetStateAction<number | null>>;
    readonly busy: boolean;
    readonly repairBusy: boolean;
    readonly corruptCount: number;
    readonly onRefresh: () => void;
    readonly onTest: () => void;
    readonly onClear: () => void;
    readonly onOpenRepairConfirm: () => void;
    readonly draftEnabled: boolean;
    readonly draftUrl: string;
}

export function DeliveryLogSection(props: Props) {
    const {
        log,
        filteredLog,
        logCounts,
        statusFilter,
        setStatusFilter,
        searchQuery,
        setSearchQuery,
        expandedIdx,
        setExpandedIdx,
        payloadOpenIdx,
        setPayloadOpenIdx,
        busy,
        repairBusy,
        corruptCount,
        onRefresh,
        onTest,
        onClear,
        onOpenRepairConfirm,
        draftEnabled,
        draftUrl,
    } = props;

    return (
        <section className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                    Recent deliveries
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({log.length}/20)
                    </span>
                </Label>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={onRefresh} title="Refresh log">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={onTest} disabled={busy}>
                        <Send className="mr-1 h-3.5 w-3.5" />
                        {busy ? "Sending…" : "Send test ping"}
                    </Button>
                    {corruptCount > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onOpenRepairConfirm}
                            disabled={repairBusy}
                            title={`Remove ${corruptCount} corrupted entr${corruptCount === 1 ? "y" : "ies"} from the log`}
                            className="border-destructive/60 text-destructive hover:bg-destructive/10"
                        >
                            <Wrench className="mr-1 h-3.5 w-3.5" />
                            {repairBusy ? "Repairing…" : `Repair (${corruptCount})`}
                        </Button>
                    )}
                    {log.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={filteredLog.length === 0}
                                    title="Export filtered results"
                                >
                                    <Download className="mr-1 h-3.5 w-3.5" />
                                    Export ({filteredLog.length})
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                                <DropdownMenuItem onSelect={() => exportFilteredLog(filteredLog, "json")}>
                                    Download as JSON
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => exportFilteredLog(filteredLog, "csv")}>
                                    Download as CSV
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    {log.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={onClear}>
                            Clear
                        </Button>
                    )}
                </div>
            </div>
            {log.length > 0 && (
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter by event, time, or status…"
                        aria-label="Filter webhook deliveries by event, emitted time, or status"
                        className="h-8 pl-7 pr-7 text-xs"
                    />
                    {searchQuery.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            )}
            {log.length > 0 && <StatusChips statusFilter={statusFilter} setStatusFilter={setStatusFilter} logCounts={logCounts} />}
            {log.length === 0 ? (
                <EmptyState draftEnabled={draftEnabled} draftUrl={draftUrl} />
            ) : filteredLog.length === 0 ? (
                <NoMatches
                    searchQuery={searchQuery}
                    statusFilter={statusFilter}
                    onReset={() => { setStatusFilter("all"); setSearchQuery(""); }}
                />
            ) : (
                <LogEntries
                    filteredLog={filteredLog}
                    expandedIdx={expandedIdx}
                    setExpandedIdx={setExpandedIdx}
                    payloadOpenIdx={payloadOpenIdx}
                    setPayloadOpenIdx={setPayloadOpenIdx}
                />
            )}
        </section>
    );
}

function StatusChips({
    statusFilter,
    setStatusFilter,
    logCounts,
}: {
    readonly statusFilter: StatusFilter;
    readonly setStatusFilter: Dispatch<SetStateAction<StatusFilter>>;
    readonly logCounts: LogCounts;
}) {
    const chips = [
        { key: "all", label: "All", count: logCounts.all, activeClass: "bg-foreground text-background border-foreground" },
        { key: "success", label: "OK", count: logCounts.success, activeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/60" },
        { key: "skipped", label: "Skipped", count: logCounts.skipped, activeClass: "bg-muted text-foreground border-muted-foreground/60" },
        { key: "failure", label: "Failed", count: logCounts.failure, activeClass: "bg-destructive/20 text-destructive border-destructive/60" },
    ] as const;
    return (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter deliveries by status">
            {chips.map((chip) => {
                const active = statusFilter === chip.key;
                const disabled = chip.key !== "all" && chip.count === 0;
                return (
                    <button
                        key={chip.key}
                        type="button"
                        onClick={() => setStatusFilter(chip.key)}
                        disabled={disabled}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${active ? chip.activeClass : "border-border bg-transparent text-muted-foreground hover:bg-muted/40"}`}
                    >
                        {chip.label}
                        <span className={`rounded-full px-1 text-[10px] ${active ? "bg-background/30" : "bg-muted/60"}`}>
                            {chip.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function EmptyState({ draftEnabled, draftUrl }: { readonly draftEnabled: boolean; readonly draftUrl: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 px-4 py-6 text-center">
            <Webhook className="h-6 w-6 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium text-foreground">No deliveries yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
                {draftEnabled && draftUrl.trim().length > 0
                    ? "The last 20 webhook attempts will appear here, newest first. Use \"Send test ping\" to verify your endpoint."
                    : "Enable the webhook and set an endpoint URL above, then run a group or use \"Send test ping\" to see delivery results here."}
            </p>
        </div>
    );
}

function NoMatches({
    searchQuery,
    statusFilter,
    onReset,
}: {
    readonly searchQuery: string;
    readonly statusFilter: StatusFilter;
    readonly onReset: () => void;
}) {
    return (
        <p className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
            {searchQuery.trim().length > 0
                ? <>No deliveries match search “{searchQuery}”{statusFilter !== "all" ? <> in “{statusFilter}”</> : null}. </>
                : <>No deliveries match the “{statusFilter}” filter. </>}
            <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onClick={onReset}
            >
                Show all
            </button>
        </p>
    );
}

function LogEntries({
    filteredLog,
    expandedIdx,
    setExpandedIdx,
    payloadOpenIdx,
    setPayloadOpenIdx,
}: {
    readonly filteredLog: ReadonlyArray<WebhookDeliveryResult>;
    readonly expandedIdx: number | null;
    readonly setExpandedIdx: Dispatch<SetStateAction<number | null>>;
    readonly payloadOpenIdx: number | null;
    readonly setPayloadOpenIdx: Dispatch<SetStateAction<number | null>>;
}) {
    return (
        <ul className="space-y-1.5">
            {filteredLog.map((entry, i) => (
                <LogEntryRow
                    key={`${entry.EmittedAt}-${i}`}
                    entry={entry}
                    idx={i}
                    expanded={expandedIdx === i}
                    onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    payloadOpen={payloadOpenIdx === i}
                    onTogglePayload={() => setPayloadOpenIdx(payloadOpenIdx === i ? null : i)}
                />
            ))}
        </ul>
    );
}

function LogEntryRow({
    entry,
    idx,
    expanded,
    onToggle,
    payloadOpen,
    onTogglePayload,
}: {
    readonly entry: WebhookDeliveryResult;
    readonly idx: number;
    readonly expanded: boolean;
    readonly onToggle: () => void;
    readonly payloadOpen: boolean;
    readonly onTogglePayload: () => void;
}) {
    const presentation = presentVariant(entry);
    const hasSummaryDetail = presentation.summaryDetail !== null;
    return (
        <li className={presentation.rowClass}>
            <button
                type="button"
                className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left ${presentation.hoverClass}`}
                onClick={onToggle}
                aria-expanded={expanded}
                aria-controls={`hook-log-detail-${idx}`}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <Badge variant={presentation.badgeVariant} className={`shrink-0 ${presentation.badgeExtraClass}`}>
                        {presentation.badgeLabel}
                    </Badge>
                    <span className={`shrink-0 font-mono ${presentation.eventClass}`}>{entry.Event}</span>
                    {hasSummaryDetail && (
                        <span className={`truncate ${presentation.summaryDetailClass}`}>
                            , {presentation.summaryDetail}
                        </span>
                    )}
                </div>
                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                    <span>{formatTime(entry.EmittedAt)} · {entry.DurationMs} ms</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </span>
            </button>
            {expanded && (
                <div id={`hook-log-detail-${idx}`} className="border-t px-2 py-1.5">
                    <LogEntryDetails entry={entry} />
                    <PayloadPanel entry={entry} idx={idx} payloadOpen={payloadOpen} onToggle={onTogglePayload} />
                </div>
            )}
        </li>
    );
}

function LogEntryDetails({ entry }: { readonly entry: WebhookDeliveryResult }) {
    let httpText: string;
    let httpClass = "font-mono";
    if (isWebhookSuccess(entry)) {
        httpText = `${entry.Status}`;
    } else if (isWebhookSkipped(entry)) {
        httpText = ", (not sent)";
        httpClass = "font-mono text-muted-foreground";
    } else if (isWebhookFailure(entry)) {
        httpText = entry.Status !== null ? `${entry.Status}` : ", (no response)";
        httpClass = entry.Status !== null ? "font-mono text-destructive" : "font-mono text-muted-foreground";
    } else {
        httpText = ",";
        httpClass = "font-mono text-muted-foreground";
    }
    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-muted-foreground">Emitted</dt>
            <dd className="font-mono">{entry.EmittedAt}</dd>
            <dt className="text-muted-foreground">Duration</dt>
            <dd className="font-mono">{entry.DurationMs} ms</dd>
            <dt className="text-muted-foreground">HTTP</dt>
            <dd className={httpClass}>{httpText}</dd>
            {isWebhookSkipped(entry) && (
                <>
                    <dt className="text-muted-foreground">Skip reason</dt>
                    <dd className="whitespace-pre-wrap break-words font-mono">
                        {entry.SkipReason && entry.SkipReason.length > 0 ? entry.SkipReason : "(no reason recorded)"}
                    </dd>
                </>
            )}
            {isWebhookFailure(entry) && (
                <>
                    <dt className="text-muted-foreground">Error</dt>
                    <dd className="whitespace-pre-wrap break-words font-mono text-destructive">
                        {entry.Error && entry.Error.length > 0 ? entry.Error : "(no error message)"}
                    </dd>
                </>
            )}
        </dl>
    );
}

function PayloadPanel({
    entry,
    idx,
    payloadOpen,
    onToggle,
}: {
    readonly entry: WebhookDeliveryResult;
    readonly idx: number;
    readonly payloadOpen: boolean;
    readonly onToggle: () => void;
}) {
    const payloadJson = formatPayloadJson(entry);
    return (
        <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    onClick={onToggle}
                    disabled={payloadJson === null}
                    aria-expanded={payloadOpen}
                    aria-controls={`hook-log-payload-${idx}`}
                >
                    <ChevronDown className={`h-3 w-3 transition-transform ${payloadOpen ? "rotate-180" : ""}`} />
                    {payloadJson === null
                        ? "Raw JSON payload (not captured)"
                        : payloadOpen ? "Hide raw JSON payload" : "Show raw JSON payload"}
                </button>
                <Button size="sm" variant="outline" onClick={() => void copyLogEntry(entry)}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy details
                </Button>
            </div>
            {payloadOpen && payloadJson !== null && (
                <pre
                    id={`hook-log-payload-${idx}`}
                    className="max-h-64 overflow-auto rounded-md border bg-background/60 p-2 text-[11px] font-mono whitespace-pre-wrap break-words"
                >
                    {payloadJson}
                </pre>
            )}
        </div>
    );
}

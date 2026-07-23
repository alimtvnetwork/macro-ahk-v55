/**
 * Marco Extension — Delivery-log helpers for WebhookSettingsDialog.
 *
 * Extracted from `WebhookSettingsDialog.tsx` (v4.213.0) as part of Plan-24
 * SS-05: the dialog's render function had grown to 627 lines; moving these
 * pure formatters/exporters here cuts ~230 lines from the component file
 * and clears the `max-lines-per-function` warning on the dialog.
 */

import { toast } from "sonner";

import {
    isWebhookFailure,
    isWebhookSkipped,
    isWebhookSuccess,
    type WebhookDeliveryFailure,
    type WebhookDeliveryResult,
    type WebhookDeliverySkipped,
    type WebhookDeliverySuccess,
} from "@/background/recorder/step-library/result-webhook";

/**
 * A delivery-log entry is a "corrupt placeholder" when the loader could not
 * validate the original row and substituted a synthetic failure (see
 * `buildCorruptPlaceholder` in `result-webhook.ts`). We detect them by the
 * stable error-message prefix so the Repair button can show an accurate count
 * without leaking a brittle Kind discriminator.
 */
export const CORRUPT_PLACEHOLDER_PREFIX = "Corrupt webhook log entry";

export function isCorruptPlaceholder(entry: WebhookDeliveryResult): boolean {
    return isWebhookFailure(entry) && entry.Error.startsWith(CORRUPT_PLACEHOLDER_PREFIX);
}

export function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString();
    } catch {
        return iso;
    }
}

export function formatPayloadJson(entry: WebhookDeliveryResult): string | null {
    if (entry.Payload === null || entry.Payload === undefined) return null;
    try {
        return JSON.stringify(entry.Payload, null, 2);
    } catch (err) {
        return `// Failed to serialise payload: ${err instanceof Error ? err.message : String(err)}`;
    }
}

function describeSuccess(entry: WebhookDeliverySuccess): string {
    return `Status: OK (HTTP ${entry.Status})`;
}

function describeSkipped(entry: WebhookDeliverySkipped): string {
    return `Status: Skipped\nSkip reason: ${entry.SkipReason}`;
}

function describeFailure(entry: WebhookDeliveryFailure): string {
    const httpPart = entry.Status !== null ? ` (HTTP ${entry.Status})` : "";
    return `Status: Failed${httpPart}\nError: ${entry.Error}`;
}

type VariantBadgeVariant = "default" | "secondary" | "outline" | "destructive";

export interface VariantPresentation {
    readonly badgeLabel: string;
    readonly badgeVariant: VariantBadgeVariant;
    readonly badgeExtraClass: string;
    readonly rowClass: string;
    readonly hoverClass: string;
    readonly summaryDetail: string | null;
    readonly summaryDetailClass: string;
    readonly eventClass: string;
}

const ROW_SUCCESS = "rounded-md border border-emerald-500/30 bg-emerald-500/5 text-xs";
const ROW_SKIPPED = "rounded-md border border-dashed border-muted-foreground/40 bg-muted/10 text-xs";
const ROW_FAILED  = "rounded-md border border-destructive/60 bg-destructive/10 text-xs shadow-[0_0_0_1px_hsl(var(--destructive)/0.35)]";

function presentSuccess(entry: WebhookDeliverySuccess): VariantPresentation {
    return {
        badgeLabel: `OK ${entry.Status}`,
        badgeVariant: "default",
        badgeExtraClass: "",
        rowClass: ROW_SUCCESS,
        hoverClass: "hover:bg-emerald-500/10",
        summaryDetail: `HTTP ${entry.Status}`,
        summaryDetailClass: "text-emerald-300/90",
        eventClass: "",
    };
}

function presentSkipped(entry: WebhookDeliverySkipped): VariantPresentation {
    return {
        badgeLabel: "Skipped",
        badgeVariant: "outline",
        badgeExtraClass: "",
        rowClass: ROW_SKIPPED,
        hoverClass: "hover:bg-muted/30",
        summaryDetail: entry.SkipReason && entry.SkipReason.length > 0 ? entry.SkipReason : "(no reason recorded)",
        summaryDetailClass: "text-muted-foreground",
        eventClass: "",
    };
}

function presentFailure(entry: WebhookDeliveryFailure): VariantPresentation {
    const statusSuffix = entry.Status !== null ? ` ${entry.Status}` : "";
    const errorText = entry.Error && entry.Error.length > 0 ? entry.Error : "(no error message)";
    const httpPrefix = entry.Status !== null ? `HTTP ${entry.Status} , ` : "";
    return {
        badgeLabel: `Failed${statusSuffix}`,
        badgeVariant: "destructive",
        badgeExtraClass: "uppercase tracking-wide font-bold ring-1 ring-destructive/60 shadow-sm",
        rowClass: ROW_FAILED,
        hoverClass: "hover:bg-destructive/15",
        summaryDetail: `${httpPrefix}${errorText}`,
        summaryDetailClass: "text-destructive/90 font-medium",
        eventClass: "text-destructive font-semibold",
    };
}

export function presentVariant(entry: WebhookDeliveryResult): VariantPresentation {
    if (isWebhookSuccess(entry)) return presentSuccess(entry);
    if (isWebhookSkipped(entry)) return presentSkipped(entry);
    return presentFailure(entry);
}

const CLIP_SEPARATOR = "─".repeat(48);
const CLIP_EOL = "\r\n";

function variantHeader(entry: WebhookDeliveryResult): string {
    if (isWebhookSkipped(entry)) return "[SKIPPED] Webhook Delivery";
    if (isWebhookSuccess(entry)) return "[SUCCESS] Webhook Delivery";
    return "[FAILURE] Webhook Delivery";
}

function variantStatusBlock(entry: WebhookDeliveryResult): string {
    if (isWebhookSkipped(entry)) return describeSkipped(entry);
    if (isWebhookSuccess(entry)) return describeSuccess(entry);
    if (isWebhookFailure(entry)) return describeFailure(entry);
    return "Status: <unknown>";
}

function buildLogClipboardText(entry: WebhookDeliveryResult): string {
    const sections: string[] = [];
    sections.push(CLIP_SEPARATOR);
    sections.push(variantHeader(entry));
    sections.push(CLIP_SEPARATOR);
    sections.push(
        [
            `Event:    ${entry.Event ?? "<missing>"}`,
            `Emitted:  ${entry.EmittedAt ?? "<missing>"}`,
            `Duration: ${entry.DurationMs ?? 0} ms`,
        ].join(CLIP_EOL),
    );
    sections.push(CLIP_SEPARATOR);
    sections.push(variantStatusBlock(entry));
    const payloadJson = formatPayloadJson(entry);
    if (payloadJson !== null) {
        sections.push(CLIP_SEPARATOR);
        sections.push("Payload:");
        sections.push(payloadJson);
    }
    sections.push(CLIP_SEPARATOR);
    return sections.join(CLIP_EOL).replace(/\r?\n/g, CLIP_EOL);
}

export async function copyLogEntry(entry: WebhookDeliveryResult): Promise<void> {
    const text = buildLogClipboardText(entry);
    try {
        await navigator.clipboard.writeText(text);
        toast.success("Webhook details copied");
    } catch (err) {
        toast.error(`Copy failed: ${err instanceof Error ? err.message : String(err)}`);
    }
}

function entryStatusLabel(entry: WebhookDeliveryResult): string {
    if (isWebhookSkipped(entry)) return "Skipped";
    if (isWebhookSuccess(entry)) return "Success";
    return "Failure";
}

function entryStatusCode(entry: WebhookDeliveryResult): number | null {
    if (isWebhookSkipped(entry)) return null;
    return entry.Status ?? null;
}

function entryDetail(entry: WebhookDeliveryResult): string {
    if (isWebhookSkipped(entry)) return entry.SkipReason;
    if (isWebhookFailure(entry)) return entry.Error;
    return "";
}

function csvCell(value: string | number | null): string {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function buildJsonExport(entries: ReadonlyArray<WebhookDeliveryResult>): string {
    return JSON.stringify(
        {
            ExportedAt: new Date().toISOString(),
            Count: entries.length,
            Entries: entries,
        },
        null,
        2,
    );
}

function buildCsvExport(entries: ReadonlyArray<WebhookDeliveryResult>): string {
    const headers = ["Event", "EmittedAt", "Status", "HttpStatus", "DurationMs", "Detail", "PayloadJson"];
    const rows: string[] = [headers.join(",")];
    for (const entry of entries) {
        const payload = formatPayloadJson(entry);
        rows.push([
            csvCell(entry.Event ?? ""),
            csvCell(entry.EmittedAt ?? ""),
            csvCell(entryStatusLabel(entry)),
            csvCell(entryStatusCode(entry)),
            csvCell(entry.DurationMs ?? null),
            csvCell(entryDetail(entry)),
            csvCell(payload ?? ""),
        ].join(","));
    }
    return rows.join("\n");
}

function downloadFile(filename: string, mimeType: string, content: string): void {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportFilteredLog(entries: ReadonlyArray<WebhookDeliveryResult>, format: "json" | "csv"): void {
    if (entries.length === 0) {
        toast.error("No entries match the current filters");
        return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "json") {
        downloadFile(`webhook-log-${stamp}.json`, "application/json", buildJsonExport(entries));
    } else {
        downloadFile(`webhook-log-${stamp}.csv`, "text/csv", buildCsvExport(entries));
    }
    toast.success(`Exported ${entries.length} ${entries.length === 1 ? "entry" : "entries"} as ${format.toUpperCase()}`);
}

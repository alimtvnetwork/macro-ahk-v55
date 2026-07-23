/**
 * Marco Extension — Failure Toast
 *
 * Shows a Sonner toast for a {@link FailureReport} with a one-click action
 * that copies the full structured JSON to the clipboard. The user pastes it
 * straight into ChatGPT/Claude — no manual log-scraping required.
 *
 * Lives in the React/options layer so the recorder background modules stay
 * UI-free. Background or content-script callers should pass the report
 * across the message bus and let the React surface call `showFailureToast`.
 *
 * @see ./failure-logger.ts — Structured report shape.
 */

import { toast } from "sonner";
import {
    formatFailureReport,
    type FailureReport,
} from "@/background/recorder/failure-logger";

interface CopyOpts {
    readonly Clipboard?: Pick<Clipboard, "writeText">;
}

export async function copyFailureReportToClipboard(
    report: FailureReport,
    opts: CopyOpts = {},
): Promise<boolean> {
    const target = opts.Clipboard
        ?? (typeof navigator !== "undefined" ? navigator.clipboard : undefined);
    if (target === undefined) { return false; }
    const blob = `${formatFailureReport(report)}\n\n--- JSON ---\n${JSON.stringify(report, null, 2)}`;
    try {
        await target.writeText(blob);
        return true;
    } catch {
        return false;
    }
}

export interface ShowFailureToastOpts {
    /**
     * Optional re-run handler. When supplied, the toast renders a primary
     * "Retry step" action; "Copy report" stays available via the cancel
     * slot so both choices are reachable. Sonner only renders the cancel
     * button when both `action` and `cancel` are set.
     */
    readonly OnRetry?: () => void | Promise<void>;
}

export function showFailureToast(
    report: FailureReport,
    opts: ShowFailureToastOpts = {},
): string | number {
    const where = formatFailureLocation(report);
    const copyAction = buildCopyReportAction(report);
    if (opts.OnRetry === undefined) {
        return showCopyOnlyFailureToast(report, where, copyAction);
    }
    const onRetry = opts.OnRetry;
    return showRetryFailureToast(report, where, copyAction, onRetry);
}

function formatFailureLocation(report: FailureReport): string {
    const kindSuffix = report.StepKind !== null ? ` (${report.StepKind})` : "";
    return report.StepId !== null ? `Step #${report.StepId}${kindSuffix}` : `${report.Phase} failure`;
}

function buildCopyReportAction(report: FailureReport): { label: string; onClick: () => void } {
    return { label: "Copy report", onClick: () => { void copyFailureReportToClipboard(report).then(showCopyResult); } };
}

function showCopyResult(ok: boolean): void {
    if (ok) { toast.success("Failure report copied to clipboard"); } else { toast.error("Clipboard unavailable, see DevTools console"); }
}

function showCopyOnlyFailureToast(report: FailureReport, where: string, copyAction: { label: string; onClick: () => void }): string | number {
    return toast.error(`${where}: ${report.Message}`, { description: `Phase: ${report.Phase}, ${report.Timestamp}`, duration: 12000, action: copyAction });
}

function showRetryFailureToast(report: FailureReport, where: string, copyAction: { label: string; onClick: () => void }, onRetry: () => void | Promise<void>): string | number {
    return toast.error(`${where}: ${report.Message}`, {
        description: `Phase: ${report.Phase}, ${report.Timestamp}`,
        duration: 12000,
        action: {
            label: "Retry step",
            onClick: () => { void onRetry(); },
        },
        cancel: copyAction,
    });
}

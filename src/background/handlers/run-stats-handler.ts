/**
 * Marco Extension — Run Statistics Handler (Spec 15 T-7)
 *
 * Tracks per-cycle macro metrics in chrome.storage.local.
 * Capped at 500 entries (FIFO). Provides query & reset endpoints.
 *
 * @see spec/05-chrome-extension/15-expanded-popup-options-ui.md — Expanded options UI
 */

const STORAGE_KEY = "marco_run_stats";
const MAX_ENTRIES = 500;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CycleMetric {
    cycleNumber: number;
    startTime: string;
    endTime: string;
    durationMs: number;
    status: "success" | "error" | "skipped";
    errorMessage?: string;
}

export interface RunStatsResponse {
    totalCycles: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    successRate: number;
    avgDurationMs: number;
    lastErrorMessage: string | null;
    recentCycles: CycleMetric[];
}

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

async function loadMetrics(): Promise<CycleMetric[]> {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        return (result[STORAGE_KEY] as CycleMetric[]) ?? [];
    } catch {
        return [];
    }
}

async function saveMetrics(metrics: CycleMetric[]): Promise<void> {
    // FIFO cap
    const capped = metrics.length > MAX_ENTRIES
        ? metrics.slice(metrics.length - MAX_ENTRIES)
        : metrics;
    await chrome.storage.local.set({ [STORAGE_KEY]: capped });
}

/* ------------------------------------------------------------------ */
/*  Handlers                                                           */
/* ------------------------------------------------------------------ */

/** Records a single cycle metric. */
export async function handleRecordCycleMetric(payload: { projectId: string; cycleMs: number; loopCount: number; action: string }): Promise<{ isOk: true }> {
    const cycleInput = payload as {
        cycleNumber: number;
        startTime: string;
        endTime: string;
        status: "success" | "error" | "skipped";
        errorMessage?: string;
    };

    const start = new Date(cycleInput.startTime).getTime();
    const end = new Date(cycleInput.endTime).getTime();

    const metric: CycleMetric = {
        cycleNumber: cycleInput.cycleNumber,
        startTime: cycleInput.startTime,
        endTime: cycleInput.endTime,
        durationMs: end - start,
        status: cycleInput.status,
        ...(cycleInput.errorMessage ? { errorMessage: cycleInput.errorMessage } : {}),
    };

    const existing = await loadMetrics();
    existing.push(metric);
    await saveMetrics(existing);

    return { isOk: true };
}

/** Returns aggregated run statistics + last 20 cycles. */
export async function handleGetRunStats(): Promise<RunStatsResponse> {
    const metrics = await loadMetrics();

    const totalCycles = metrics.length;
    const successCount = metrics.filter(entry => entry.status === "success").length;
    const errorCount = metrics.filter(entry => entry.status === "error").length;
    const skippedCount = metrics.filter(entry => entry.status === "skipped").length;
    const successRate = totalCycles > 0 ? Math.round((successCount / totalCycles) * 1000) / 10 : 0;

    const durations = metrics.filter(entry => entry.durationMs > 0).map(entry => entry.durationMs);
    const avgDurationMs = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    const errorMetrics = metrics.filter(entry => entry.status === "error");
    const lastErrorMessage = errorMetrics.length > 0
        ? errorMetrics[errorMetrics.length - 1].errorMessage ?? null
        : null;

    const recentCycles = metrics.slice(-20);

    return {
        totalCycles,
        successCount,
        errorCount,
        skippedCount,
        successRate,
        avgDurationMs,
        lastErrorMessage,
        recentCycles,
    };
}

/** Clears all stored run statistics. */
export async function handleClearRunStats(): Promise<{ isOk: true }> {
    await chrome.storage.local.remove(STORAGE_KEY);
    return { isOk: true };
}

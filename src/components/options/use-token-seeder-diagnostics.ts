/**
 * Token Seeder diagnostics polling + derivation hook.
 *
 * Extracted from `TokenSeederStatusIndicator.tsx` (Plan 25 · Step 9): owns
 * the diagnostics cache/poll loop, the 500ms tick, and the memoised
 * retry+category summaries. The indicator component becomes a pure
 * renderer over the returned bag.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendMessage } from "@/lib/message-client";
import { logError } from "./options-logger";
import {
    loadDiagnosticsCache,
    saveDiagnosticsCache,
} from "./token-seeder-diagnostics-cache";

export interface InaccessibleSeedTarget {
    tabId: number;
    tabUrl: string;
    reason: string;
    code: string;
    firstFailureAt: number;
    lastFailureAt: number;
    attemptCount: number;
    cooldownMs: number;
}

export interface TokenSeederDiagnostics {
    targets: InaccessibleSeedTarget[];
    cooldownMs: number;
    capturedAt: string;
}

export type ErrorCategory = "host-permission" | "scripting-blocked" | "restricted-scheme" | "other";

export const CATEGORY_LABELS: Record<ErrorCategory, string> = {
    "host-permission": "Host permission",
    "scripting-blocked": "Scripting blocked",
    "restricted-scheme": "Restricted scheme",
    other: "Other",
};

const POLL_INTERVAL_MS = 5_000;
const TICK_INTERVAL_MS = 500;

export function categorizeCode(code: string): ErrorCategory {
    switch (code) {
        case "RESPECTIVE_HOST_PERMISSION":
        case "MISSING_HOST_PERMISSION":
        case "NO_HOST_PATTERN":
        case "PERMISSION_NOT_GRANTED":
            return "host-permission";
        case "PAGE_CONTENTS_BLOCKED":
        case "EXTENSIONS_GALLERY_BLOCKED":
        case "GENERIC_CANNOT_SCRIPT":
            return "scripting-blocked";
        case "RESTRICTED_SCHEME":
            return "restricted-scheme";
        default:
            return "other";
    }
}

export interface TokenSeederDiagnosticsBag {
    readonly targets: ReadonlyArray<InaccessibleSeedTarget>;
    readonly now: number;
    readonly nextRetryMs: number;
    readonly nextRetryAt: number;
    readonly categoryCounts: ReadonlyMap<ErrorCategory, number>;
}

function computeNextRetry(
    targets: ReadonlyArray<InaccessibleSeedTarget>,
    now: number,
): { nextRetryMs: number; nextRetryAt: number } {
    if (targets.length === 0) return { nextRetryMs: 0, nextRetryAt: 0 };
    let minRemaining = Number.POSITIVE_INFINITY;
    let minRetryAt = 0;
    for (const t of targets) {
        const retryAt = t.lastFailureAt + t.cooldownMs;
        const remaining = Math.max(0, retryAt - now);
        if (remaining < minRemaining) {
            minRemaining = remaining;
            minRetryAt = retryAt;
        }
    }
    return {
        nextRetryMs: minRemaining === Number.POSITIVE_INFINITY ? 0 : minRemaining,
        nextRetryAt: minRetryAt,
    };
}

function computeCategoryCounts(
    targets: ReadonlyArray<InaccessibleSeedTarget>,
): ReadonlyMap<ErrorCategory, number> {
    const counts = new Map<ErrorCategory, number>();
    for (const t of targets) {
        const cat = categorizeCode(t.code);
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
}

function useFetchDiagnostics(
    setData: (d: TokenSeederDiagnostics) => void,
): () => Promise<void> {
    return useCallback(async () => {
        try {
            const res = await sendMessage<TokenSeederDiagnostics>({
                type: "GET_TOKEN_SEEDER_DIAGNOSTICS",
            });
            setData(res);
            saveDiagnosticsCache(res);
        } catch (caught) {
            logError(
                "TokenSeederStatusIndicator.fetchDiagnostics",
                "GET_TOKEN_SEEDER_DIAGNOSTICS failed, background may not be ready, will retry on next poll",
                caught,
            );
        }
    }, [setData]);
}

function useDiagnosticsPolling(): {
    readonly data: TokenSeederDiagnostics | null;
    readonly now: number;
} {
    const [data, setData] = useState<TokenSeederDiagnostics | null>(() => loadDiagnosticsCache());
    const [now, setNow] = useState<number>(() => Date.now());
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fetchDiagnostics = useFetchDiagnostics(setData);

    useEffect(() => {
        void fetchDiagnostics();
        pollRef.current = setInterval(() => void fetchDiagnostics(), POLL_INTERVAL_MS);
        tickRef.current = setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            if (tickRef.current) clearInterval(tickRef.current);
        };
    }, [fetchDiagnostics]);

    return { data, now };
}


export function useTokenSeederDiagnostics(): TokenSeederDiagnosticsBag {
    const { data, now } = useDiagnosticsPolling();
    const targets = useMemo(() => data?.targets ?? [], [data]);
    const retry = useMemo(() => computeNextRetry(targets, now), [targets, now]);
    const categoryCounts = useMemo(() => computeCategoryCounts(targets), [targets]);
    return { targets, now, ...retry, categoryCounts };
}


export function formatRemaining(ms: number): string {
    if (ms <= 0) return "ready";
    return `${Math.ceil(ms / 1000)}s`;
}

export function formatRetryTimestamp(ts: number): string {
    try {
        return new Intl.DateTimeFormat("en-GB", {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }).format(new Date(ts));
    } catch {
        return new Date(ts).toISOString();
    }
}

export function formatOrigin(url: string): string {
    if (!url) return "(unknown)";
    try {
        const u = new URL(url);
        return u.origin;
    } catch {
        return url.length > 48 ? `${url.slice(0, 48)}...` : url;
    }
}

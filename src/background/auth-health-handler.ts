// @ts-nocheck
import { DomainConstants } from "../constants/domain";
/**
 * Marco Extension — Auth Health Handler
 *
 * Runs the full auth strategy waterfall with per-strategy timing,
 * reporting which strategies succeeded/failed and how long each took.
 * Exposed via GET_AUTH_HEALTH message type.
 *
 * NOTE: This file runs in the extension service worker context where
 * chrome.* APIs are available. It is excluded from tsconfig.app.json.
 */

import {
    readCookieValueFromCandidates,
} from "./cookie-helpers";
import { logBgWarnError, BgLogTag } from "./bg-logger";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AuthStrategyResult {
    /** Strategy name (human-readable) */
    name: string;
    /** Tier number (1-5) */
    tier: number;
    /** Whether this strategy produced a valid token */
    isSuccess: boolean;
    /** Time taken in milliseconds */
    durationMs: number;
    /** Additional detail (error message, cookie name, etc.) */
    detail: string;
}

export interface AuthHealthResponse {
    /** Overall auth status */
    status: StatusType;
    /** Which strategy ultimately provided the token (null if none) */
    resolvedVia: string | null;
    /** Total time for the full waterfall */
    totalMs: number;
    /** Per-strategy breakdown */
    strategies: AuthStrategyResult[];
    /** Timestamp of this check */
    checkedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AUTH_API_BASE = DomainConstants.API_URL;

import { LOVABLE_TAB_PATTERNS as PLATFORM_TAB_PATTERNS } from "../shared/lovable-tab-patterns";

import { getChromeRef } from "./chrome-ref";
import { StatusType } from "../types/enums";

// Chrome extension APIs — typed via shared ChromeRef
const _chrome = getChromeRef();

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Runs all auth strategies with timing and returns a diagnostic report. */
// eslint-disable-next-line max-lines-per-function
export async function buildAuthHealthResponse(): Promise<AuthHealthResponse> {
    const t0 = performance.now();
    const strategies: AuthStrategyResult[] = [];
    let resolvedVia: string | null = null;

    // Get active tab context
    let tabUrl: string | null = null;
    let projectId: string | null = null;
    try {
        const [tab] = await _chrome.tabs!.query({ active: true, currentWindow: true });
        tabUrl = tab?.url ?? null;
        projectId = extractProjectId(tabUrl);
    } catch (queryErr) {
        logBgWarnError(BgLogTag.AUTH_HEALTH, "chrome.tabs.query({active,currentWindow}) failed — proceeding with tabUrl=null and projectId=null; downstream strategies will skip URL-dependent checks", queryErr instanceof Error ? queryErr : new Error(String(queryErr)));
    }

    // ── Strategy 1: Cookie presence check ──
    const s1 = await timedStrategy("Cookie presence", 1, async () => {
        const cookie = await readCookieValueFromCandidates(
            "lovable-session-id.id",
            tabUrl,
        );
        if (cookie !== null) {
            return { isSuccess: true, detail: "Session cookie found" };
        }
        const refreshCookie = await readCookieValueFromCandidates(
            "lovable-session-id.refresh",
            tabUrl,
        );
        if (refreshCookie !== null) {
            return { isSuccess: true, detail: "Refresh cookie found (no session cookie)" };
        }

        return { isSuccess: false, detail: "No auth cookies found" };
    });
    strategies.push(s1);

    // ── Strategy 2: Supabase localStorage JWT scan ──
    const s2 = await timedStrategy("localStorage JWT scan", 2, async () => {
        const tabs = await getActivePlatformTabs();
        if (tabs.length === 0) {
            return { isSuccess: false, detail: "No platform tabs available" };
        }

        for (const tab of tabs) {
            if (typeof tab.id !== "number") continue;
            try {
                const result = await _chrome.scripting!.executeScript({
                    target: { tabId: tab.id },
                    world: "MAIN",
                    func: (): string | null => {
                        try {
                            for (let i = 0; i < localStorage.length; i++) {
                                const key = localStorage.key(i);
                                if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
                                    const raw = localStorage.getItem(key);
                                    if (raw) {
                                        const parsed = JSON.parse(raw);
                                        const token = parsed?.access_token;
                                        if (typeof token === "string" && token.startsWith("eyJ")) {
                                            return `found:${key}`;
                                        }
                                    }
                                }
                            }
                        } catch (parseErr) { console.debug("[auth-health] localStorage JWT parse skipped:", parseErr); }

                        return null;
                    },
                });
                const scanResult = result?.[0]?.result;
                if (typeof scanResult === "string" && scanResult.startsWith("found:")) {
                    return { isSuccess: true, detail: `JWT in ${scanResult.slice(6)} (tabId=${tab.id})` };
                }
            } catch (tabErr) {
                logBgWarnError(BgLogTag.AUTH_HEALTH, `chrome.scripting.executeScript JWT scan failed for tabId=${tab.id} (url=${tab.url ?? "?"}) — tab may be discarded, restricted (chrome://, devtools), or closed mid-scan`, tabErr instanceof Error ? tabErr : new Error(String(tabErr)));
            }
        }

        return { isSuccess: false, detail: `Scanned ${tabs.length} tab(s) — no JWT found` };
    });
    strategies.push(s2);
    if (s2.isSuccess && !resolvedVia) resolvedVia = s2.name;

    // ── Strategy 3: Signed URL token scan ──
    const s3 = await timedStrategy("Signed URL token", 3, async () => {
        const isMissingTabUrl = !tabUrl;
        if (isMissingTabUrl) {
            return { isSuccess: false, detail: "No active tab URL" };
        }

        try {
            const parsed = new URL(tabUrl);
            const token = parsed.searchParams.get("__lovable_token")
                ?? parsed.searchParams.get("lovable_token");

            if (typeof token === "string" && token.startsWith("eyJ") && token.split(".").length === 3) {
                return { isSuccess: true, detail: "JWT found in active URL" };
            }
        } catch (urlErr) {
            // Malformed tab URL — strategy result already returns success=false below;
            // log at warn level so a recurring pattern surfaces in diagnostics without
            // promoting a single bad URL to an error.
            logBgWarnError(
                BgLogTag.AUTH_HEALTH,
                `Strategy 3 — new URL("${tabUrl}") parse failed; skipping URL-token scan and falling through to "No signed URL token found"`,
                urlErr instanceof Error ? urlErr : new Error(String(urlErr)),
            );
        }

        return { isSuccess: false, detail: "No signed URL token found" };
    });
    strategies.push(s3);
    if (s3.isSuccess && !resolvedVia) resolvedVia = s3.name;

    // ── Strategy 4: Network auth-token exchange (disabled) ──
    const s4 = await timedStrategy("Auth-token exchange", 4, async () => {
        const detail = projectId
            ? `Disabled — cookie/localStorage-only mode (no call to ${AUTH_API_BASE}/projects/${projectId}/auth-token)`
            : `Disabled — cookie/localStorage-only mode (no call to ${AUTH_API_BASE}/projects/{id}/auth-token)`;

        return { isSuccess: false, detail };
    });
    strategies.push(s4);
    if (s4.isSuccess && !resolvedVia) resolvedVia = s4.name;

    // ── Strategy 5: Cross-tab session cookie scan ──
    const s5 = await timedStrategy("Cross-tab cookie scan", 5, async () => {
        try {
            const cookies = await _chrome.cookies!.getAll({ domain: DomainConstants.PRIMARY_DOMAIN });
            const sessionCookie = (cookies as Array<{ name: string; domain: string; expirationDate?: number }>).find(
                (c) => c.name.includes("session") || c.name.includes("auth"),
            );
            if (sessionCookie) {
                const isExpired = sessionCookie.expirationDate !== undefined &&
                    sessionCookie.expirationDate < Date.now() / 1000;
                if (isExpired) {
                    return { isSuccess: false, detail: `Cookie "${sessionCookie.name}" expired` };
                }

                return { isSuccess: true, detail: `Cookie "${sessionCookie.name}" (domain=${sessionCookie.domain})` };
            }
            const count = Array.isArray(cookies) ? cookies.length : 0;

            return { isSuccess: false, detail: `${count} cookies scanned — no session cookie` };
        } catch (e) {
            return { isSuccess: false, detail: (e as Error).message };
        }
    });
    strategies.push(s5);

    const totalMs = Math.round(performance.now() - t0);

    // Determine overall status
    const anySuccess = strategies.some(s => s.isSuccess);
    const allFailed = strategies.every(s => s.isFail);
    const status: AuthHealthResponse["status"] = allFailed
        ? "unauthenticated"
        : (resolvedVia ? "authenticated" : "degraded");

    // If no strategy explicitly resolved, but cookies exist, it's degraded
    if (!resolvedVia && anySuccess) {
        resolvedVia = strategies.find(s => s.isSuccess)?.name ?? null;
    }

    return {
        status,
        resolvedVia,
        totalMs,
        strategies,
        checkedAt: new Date().toISOString(),
    };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function timedStrategy(
    name: string,
    tier: number,
    strategyRunner: () => Promise<{ isSuccess: boolean; detail: string }>,
): Promise<AuthStrategyResult> {
    const t0 = performance.now();
    try {
        const result = await strategyRunner();

        return {
            name,
            tier,
            isSuccess: result.isSuccess,
            durationMs: Math.round(performance.now() - t0),
            detail: result.detail,
        };
    } catch (e) {
        return {
            name,
            tier,
            isSuccess: false,
            durationMs: Math.round(performance.now() - t0),
            detail: `Exception: ${(e as Error).message}`,
        };
    }
}

interface PlatformTab {
    id?: number;
    url?: string;
}

async function getActivePlatformTabs(): Promise<PlatformTab[]> {
    const results: PlatformTab[] = [];
    for (const pattern of PLATFORM_TAB_PATTERNS) {
        try {
            const tabs = await _chrome.tabs!.query({ url: pattern });
            if (Array.isArray(tabs)) results.push(...tabs);
        } catch (queryErr) {
            logBgWarnError(BgLogTag.AUTH_HEALTH, `chrome.tabs.query({url:"${pattern}"}) failed — pattern skipped, other platform tabs (if any) still scanned`, queryErr instanceof Error ? queryErr : new Error(String(queryErr)));
        }
    }
    // Dedupe by tab ID
    const seen = new Set<number>();

    return results.filter((t: PlatformTab) => {
        if (typeof t.id !== "number" || seen.has(t.id)) return false;
        seen.add(t.id);

        return true;
    });
}

function extractProjectId(url: string | null): string | null {
    const isMissingUrl = !url;
    if (isMissingUrl) return null;
    const match = url.match(/\/projects\/([a-f0-9-]{36})/);

    return match?.[1] ?? null;
}

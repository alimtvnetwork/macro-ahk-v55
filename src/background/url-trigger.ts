/**
 * Marco Extension — URL Trigger Gate (audit 2026-05-16, fixes U-1/U-2/U-3)
 *
 * Listens to the ONLY three allowed re-evaluation triggers:
 *   T1 — initial load   (webNavigation.onCompleted, frameId === 0)
 *   T2 — refresh        (webNavigation.onCommitted, transitionType === "reload")
 *   T3 — tab activate   (chrome.tabs.onActivated)
 *
 * Each trigger fingerprints the URL and consults `tabDecisionCache`
 * via `isSameDecisionFingerprint()`. If the fingerprint matches the
 * cached one for that tab, the whole pipeline is short-circuited —
 * NO `evaluateUrlMatches()`, NO sentinel re-inject, NO logs that
 * would create a hot loop on noisy SPA history events.
 *
 * On a miss, the trigger:
 *   1. calls `evaluateUrlMatches(url)` once
 *   2. stores the decision in `tabDecisionCache`
 *   3. injects the `__marco_sentinel__` div so page-side checks
 *      become O(1) `document.getElementById()` lookups
 *
 * Hard constraints (do not change without re-reading the audit):
 *   • Sub-frames are ignored — top-frame only.
 *   • No setInterval, no setTimeout retry loop, no MutationObserver.
 *   • All errors are caught and logged; this gate must NEVER throw
 *     into Chrome's event loop (would unregister the listener).
 *   • Hash-only navigation (`onReferenceFragmentUpdated`) is
 *     intentionally NOT listened to — the fingerprint strips hashes.
 */

import { evaluateUrlMatches } from "./project-matcher";
import {
    getTabDecision,
    isSameDecisionFingerprint,
    setTabDecision,
    clearTabDecision,
    type TabDecision,
} from "./state-manager";
import { urlFingerprint } from "./url-fingerprint";
import { logCaughtError, BgLogTag } from "./bg-logger";

/* ------------------------------------------------------------------ */
/*  Sentinel constants                                                 */
/* ------------------------------------------------------------------ */

/** DOM id of the page-side decision sentinel. Stable contract. */
export const MARCO_SENTINEL_ID = "__marco_sentinel__";

/** data-* attribute names — keep in sync with `readSentinel()` consumers. */
const SENTINEL_ATTR_FP = "data-fp";
const SENTINEL_ATTR_PROJECTS = "data-projects";
const SENTINEL_ATTR_CAN_RUN = "data-can-run";
const SENTINEL_ATTR_TRIGGER = "data-trigger";
const SENTINEL_ATTR_DECIDED_AT = "data-decided-at";

/* ------------------------------------------------------------------ */
/*  Registration                                                       */
/* ------------------------------------------------------------------ */

let isRegistered = false;

/** Wires the three triggers. Idempotent. */
export function registerUrlTriggers(): void {
    if (isRegistered) {
        return;
    }
    isRegistered = true;

    chrome.webNavigation.onCompleted.addListener(handleLoad);
    chrome.webNavigation.onCommitted.addListener(handleCommitted);
    chrome.tabs.onActivated.addListener(handleActivated);

    console.log("[url-trigger] Registered T1 onCompleted, T2 onCommitted(reload), T3 onActivated");
}

/* ------------------------------------------------------------------ */
/*  T1 — initial load                                                  */
/* ------------------------------------------------------------------ */

async function handleLoad(
    details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
): Promise<void> {
    const isSubFrame = details.frameId !== 0;
    if (isSubFrame) {
        return;
    }
    await runGate(details.tabId, details.url, "load");
}

/* ------------------------------------------------------------------ */
/*  T2 — refresh (transitionType === "reload")                         */
/* ------------------------------------------------------------------ */

async function handleCommitted(
    details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
): Promise<void> {
    const isSubFrame = details.frameId !== 0;
    if (isSubFrame) {
        return;
    }
    const isReload = details.transitionType === "reload";
    if (!isReload) {
        return;
    }
    // Force re-eval on refresh — user explicitly requested a fresh page.
    clearTabDecision(details.tabId);
    await runGate(details.tabId, details.url, "refresh");
}

/* ------------------------------------------------------------------ */
/*  T3 — tab activated                                                 */
/* ------------------------------------------------------------------ */

async function handleActivated(
    info: chrome.tabs.TabActiveInfo,
): Promise<void> {
    let tab: chrome.tabs.Tab;
    try {
        tab = await chrome.tabs.get(info.tabId);
    } catch (err) {
        // Tab disappeared between activate and get — non-fatal.
        logCaughtError(BgLogTag.MARCO, "tabs.onActivated: tabs.get failed", err);
        return;
    }
    const url = tab.url ?? "";
    const hasUrl = url.length > 0;
    if (!hasUrl) {
        return;
    }
    await runGate(info.tabId, url, "activate");
}

/* ------------------------------------------------------------------ */
/*  Shared gate                                                        */
/* ------------------------------------------------------------------ */

/**
 * Returns true for URLs Chrome forbids scripting into (chrome://, the
 * Web Store, other extensions, devtools, file://, view-source:, blank).
 * Avoids logging predictable "restricted URL" errors on every nav.
 */
const RESTRICTED_URL_PREFIXES: ReadonlyArray<string> = [
    "chrome://",
    "chrome-search://",
    "chrome-extension://",
    "chrome-untrusted://",
    "moz-extension://",
    "edge://",
    "brave://",
    "opera://",
    "about:",
    "devtools://",
    "view-source:",
    "file://",
    "https://chrome.google.com/webstore",
    "https://chromewebstore.google.com",
];

interface RestrictionMatch {
    readonly restricted: boolean;
    readonly branch: "empty" | "about-blank" | "prefix" | "allowed";
    readonly matchedPrefix: string | null;
}

function classifyRestriction(url: string): RestrictionMatch {
    if (url.length === 0) { return { restricted: true, branch: "empty", matchedPrefix: null }; }
    if (url === "about:blank") { return { restricted: true, branch: "about-blank", matchedPrefix: "about:blank" }; }
    const hit = RESTRICTED_URL_PREFIXES.find((prefix) => url.startsWith(prefix)) ?? null;
    if (hit !== null) { return { restricted: true, branch: "prefix", matchedPrefix: hit }; }
    return { restricted: false, branch: "allowed", matchedPrefix: null };
}

function isRestrictedUrl(url: string): boolean {
    return classifyRestriction(url).restricted;
}

/** Per-tab throttle so restricted-URL debug logs never flood the console. */
const restrictedLogSeen = new Map<number, string>();

function logRestrictedOnce(tabId: number, url: string, trigger: string, match: RestrictionMatch): void {
    const key = `${match.branch}:${match.matchedPrefix ?? ""}`;
    if (restrictedLogSeen.get(tabId) === key) { return; }
    restrictedLogSeen.set(tabId, key);
    console.debug(
        `[url-trigger] restricted (trigger=${trigger}, tab=${tabId}, branch=${match.branch}, prefix=${match.matchedPrefix ?? "n/a"}, url=${url})`,
    );
}

/** Single source of truth for the dedup gate + decision write + sentinel. */
async function runGate(
    tabId: number,
    url: string,
    trigger: TabDecision["trigger"],
): Promise<void> {
    const restriction = classifyRestriction(url);
    if (restriction.restricted) {
        // Scripting is forbidden here — clear any stale decision and exit
        // silently after ONE contextual debug log per (tab, prefix) pair.
        clearTabDecision(tabId);
        logRestrictedOnce(tabId, url, trigger, restriction);
        return;
    }
    restrictedLogSeen.delete(tabId);

    const fp = urlFingerprint(url);

    const isDuplicate = isSameDecisionFingerprint(tabId, fp);
    if (isDuplicate) {
        // Cache hit — the whole point of the gate. Stay silent.
        return;
    }

    try {
        const matches = await evaluateUrlMatches(url);
        const decision: TabDecision = {
            urlFp: fp,
            url,
            matches,
            trigger,
            decidedAt: Date.now(),
        };
        setTabDecision(tabId, decision);
        await injectSentinel(tabId, decision);
        console.log(
            `[url-trigger] ${trigger} tab=${tabId} matches=${matches.length} fp=${fp} url=${url}`,
        );
    } catch (err) {
        // NEVER rethrow — would unregister the chrome listener.
        logCaughtError(
            BgLogTag.MARCO,
            `[url-trigger] gate failed (trigger=${trigger}, tab=${tabId}, url=${url}, branch=evaluate-or-inject)`,
            err,
        );
    }
}

/* ------------------------------------------------------------------ */
/*  Sentinel injection                                                 */
/* ------------------------------------------------------------------ */

/**
 * Injects (or updates) the `<div id="__marco_sentinel__">` element at
 * the end of `<body>` with the decision summary as data-* attributes.
 * Idempotent: same fingerprint → no DOM write.
 *
 * Runs in the page MAIN world via `chrome.scripting.executeScript` so
 * the page itself (and other content scripts) can read it cheaply.
 */
async function injectSentinel(
    tabId: number,
    decision: TabDecision,
): Promise<void> {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: writeSentinelInPage,
            args: buildSentinelArgs(decision),
        });
    } catch (err) {
        handleSentinelError(tabId, decision, err);
    }
}

function buildSentinelArgs(decision: TabDecision): [
    string, string, string, string, string, string,
    string, string, boolean, string, number,
] {
    return [
        MARCO_SENTINEL_ID,
        SENTINEL_ATTR_FP,
        SENTINEL_ATTR_PROJECTS,
        SENTINEL_ATTR_CAN_RUN,
        SENTINEL_ATTR_TRIGGER,
        SENTINEL_ATTR_DECIDED_AT,
        decision.urlFp,
        decision.matches.map((m) => m.projectId).join(","),
        decision.matches.length > 0,
        decision.trigger,
        decision.decidedAt,
    ];
}

const HOST_PERMISSION_REFUSAL_MARKERS: ReadonlyArray<string> = [
    "Cannot access contents of the page",
    "Cannot access a chrome",
    "The extensions gallery cannot be scripted",
    "No tab with id",
    "The tab was closed",
];

function isHostPermissionRefusal(message: string): boolean {
    return HOST_PERMISSION_REFUSAL_MARKERS.some((marker) => message.includes(marker));
}

function matchedRefusalMarker(message: string): string | null {
    return HOST_PERMISSION_REFUSAL_MARKERS.find((marker) => message.includes(marker)) ?? null;
}

function handleSentinelError(tabId: number, decision: TabDecision, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    const marker = matchedRefusalMarker(message);
    if (marker !== null) {
        clearTabDecision(tabId);
        console.debug(
            `[url-trigger] sentinel refused (tab=${tabId}, url=${decision.url}, trigger=${decision.trigger}, branch=host-permission, marker="${marker}")`,
        );
        return;
    }
    logCaughtError(
        BgLogTag.MARCO,
        `[url-trigger] sentinel inject failed (tab=${tabId}, url=${decision.url}, trigger=${decision.trigger}, branch=execute-script)`,
        err,
    );
}

/**
 * Page-side function. Serialized by Chrome — keep self-contained
 * (no closures, no imports, only the primitives passed via `args`).
 */
function writeSentinelInPage(
    id: string,
    attrFp: string,
    attrProjects: string,
    attrCanRun: string,
    attrTrigger: string,
    attrDecidedAt: string,
    fp: string,
    projectsCsv: string,
    canRun: boolean,
    trigger: string,
    decidedAt: number,
): void {
    try {
        const existing = document.getElementById(id);
        const isSameFp = existing !== null && existing.getAttribute(attrFp) === fp;
        if (isSameFp) {
            return;
        }
        const element = existing ?? document.createElement("div");
        element.id = id;
        element.setAttribute(attrFp, fp);
        element.setAttribute(attrProjects, projectsCsv);
        element.setAttribute(attrCanRun, String(canRun));
        element.setAttribute(attrTrigger, trigger);
        element.setAttribute(attrDecidedAt, String(decidedAt));
        element.style.display = "none";
        const isNew = existing === null;
        if (isNew) {
            const host = document.body ?? document.documentElement;
            host.appendChild(element);
        }
    } catch { // allow-swallow: page may be mid-navigation / detached; sentinel element write is best-effort and re-runs on next decision.
        // Page may be mid-navigation; safe to drop.
    }
}

/* ------------------------------------------------------------------ */
/*  Public read helper (background-side mirror)                        */
/* ------------------------------------------------------------------ */

/** Returns the cached decision for a tab, or null. Sync, hot-path safe. */
export function readDecision(tabId: number): TabDecision | null {
    return getTabDecision(tabId) ?? null;
}

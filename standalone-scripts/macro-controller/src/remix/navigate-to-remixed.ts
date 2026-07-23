/**
 * MacroLoop Controller — Remix navigation helper (Issue 129 Step 7)
 *
 * Spec: spec/22-app-issues/129-prompts-cache-plan-task-gitsync-remix.md
 *       § Step 7 — navigate active tab to new project URL.
 *
 * Contract:
 *   - Always replaces the active tab (no new-tab fallback). This is the
 *     "remix and continue" flow — the user expects to land on the new
 *     project in-place so the next step (sentinel invalidation) can drive
 *     auto-reinjection.
 *   - Accepts both absolute (`https://lovable.dev/projects/<id>`) and
 *     path-relative (`/projects/<id>`) URLs returned by the remix API.
 *   - Sequential fail-fast: validates URL before navigation; rejects
 *     non-HTTP(S) schemes outright (no `javascript:`, `data:`, etc.).
 *   - Differs intentionally from `openRemixRedirect()` which honors the
 *     `openInCurrentTab` toggle for header-button flows.
 */

import { logError } from '../error-utils';
import { log } from '../logger';
import type { RemixNewProjectRow } from './new-project-cache';

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/* ------------------------------------------------------------------ */
/*  Pure helper                                                        */
/* ------------------------------------------------------------------ */

/**
 * Normalize a redirect URL into an absolute http(s) URL, resolving
 * relative paths against `origin`. Returns `null` for empty input,
 * malformed URLs, or non-http(s) schemes.
 */
export function normalizeRedirectUrl(
    redirectUrl: string,
    origin: string,
): string | null {
    if (!redirectUrl) return null;
    const trimmed = redirectUrl.trim();
    if (!trimmed) return null;
    try {
        const url = new URL(trimmed, origin);
        if (ALLOWED_PROTOCOLS.indexOf(url.protocol) === -1) return null;
        return url.toString();
    } catch (err: unknown) {
        logError('RemixNav',
            'normalizeRedirectUrl: invalid URL "' + trimmed + '" (origin=' + origin + ')',
            err);
        return null;
    }
}

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Navigate the active tab to a remix redirect URL. Returns `true` on a
 * successful nav attempt, `false` when the URL was rejected or
 * `window.location` was unavailable.
 *
 * Intentionally bypasses the `openInCurrentTab` config toggle — Issue 129
 * requires the active-tab nav for the remix-and-continue flow.
 */
export function navigateActiveTabToRemixedProject(
    redirectUrl: string,
): boolean {
    const w = (typeof window !== 'undefined' ? window : null);
    if (!w || !w.location) {
        logError('RemixNav', 'navigate refused: window.location unavailable');
        return false;
    }
    const origin = w.location.origin || 'https://lovable.dev';
    const absolute = normalizeRedirectUrl(redirectUrl, origin);
    if (!absolute) {
        logError('RemixNav',
            'navigate refused: rejected URL "' + redirectUrl + '" (origin=' + origin + ')');
        return false;
    }
    log('[RemixNav] navigating active tab → ' + absolute, 'info');
    try {
        w.location.assign(absolute);
        return true;
    } catch (err: unknown) {
        logError('RemixNav', 'location.assign threw for ' + absolute, err);
        return false;
    }
}

/**
 * Convenience wrapper — navigate using a persisted {@link RemixNewProjectRow}
 * captured by Step 6. Returns the same boolean as the underlying call.
 */
export function navigateFromCachedRemix(row: RemixNewProjectRow | null): boolean {
    if (!row || !row.RedirectUrl) {
        logError('RemixNav', 'navigateFromCachedRemix: missing row or RedirectUrl');
        return false;
    }
    return navigateActiveTabToRemixedProject(row.RedirectUrl);
}

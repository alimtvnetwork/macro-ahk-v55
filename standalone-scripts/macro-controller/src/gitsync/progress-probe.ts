/**
 * MacroLoop Controller — GitSync progress probe (v3.40.2)
 *
 * Spec: spec/22-app-issues/129-prompts-cache-plan-task-gitsync-remix.md
 *       § Step 4 — GitSync progress-probe module.
 *
 * Detects whether a project is already connected to a GitHub repo BEFORE
 * any POST `/sync` call (which would create a new repo when none exists).
 *
 * Canonical rule (spec § "Connection-detection rule"):
 *   isConnected(project) :=
 *     exists a completed progress response with result.repo_url set
 *     for some prior job_id of this project.
 *
 * Implementation: probe the well-known job id
 *   `gitsync-sync-project-{projectId}`
 * - status === 'completed' && result.repo_url → connected
 * - 404 / no such job                          → not connected
 * - status === 'running' / 'pending'           → poll sequentially within
 *                                                 a single deadline (no
 *                                                 exponential backoff; no
 *                                                 retries — honors
 *                                                 mem://constraints/no-retry-policy)
 *
 * Uses the centralized marco-sdk for auth/headers — never raw fetch().
 */

import { logError } from '../error-utils';
import { throwDiagnostic } from '../errors/diagnostic-error';
import { log } from '../logger';
import { CREDIT_API_BASE } from '../shared-state';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type GitsyncJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface GitsyncProgressResult {
    readonly repo_url?: string | null;
    readonly repo_name?: string | null;
    readonly owner?: string | null;
}

export interface GitsyncProgressBody {
    readonly type?: string;
    readonly status?: GitsyncJobStatus | string;
    readonly step?: string;
    readonly title?: string;
    readonly description?: string;
    readonly result?: GitsyncProgressResult | null;
}

export type GitsyncConnectionState =
    | { connected: true; repoUrl: string; repoName: string | null; owner: string | null }
    | { connected: false; reason: 'no_job' | 'no_repo_url' | 'deadline' | 'error'; httpStatus?: number };

interface SdkApiResponse {
    readonly ok: boolean;
    readonly status: number;
    readonly data: unknown;
}

interface SdkBridge {
    api: {
        call(path: string, options: { params: Record<string, string>; baseUrl: string }): Promise<SdkApiResponse>;
    };
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Default deadline for `resolveConnection` (single sequential window). */
export const DEFAULT_PROBE_DEADLINE_MS = 8_000;

/** Sequential poll interval — fixed (no exponential backoff). */
export const PROBE_POLL_INTERVAL_MS = 1_000;

/** Well-known job id the server uses for sync-project jobs. */
export function wellKnownJobId(projectId: string): string {
    return 'gitsync-sync-project-' + projectId;
}

/* ------------------------------------------------------------------ */
/*  SDK accessor                                                       */
/* ------------------------------------------------------------------ */

function getSdk(): SdkBridge | null {
    const sdk = (window as unknown as { marco?: SdkBridge }).marco;
    if (!sdk || !sdk.api || typeof sdk.api.call !== 'function') return null;
    return sdk;
}

/* ------------------------------------------------------------------ */
/*  probeProgress — single GET on the progress endpoint                */
/* ------------------------------------------------------------------ */

/**
 * Fetch a single progress snapshot. Returns:
 *   - parsed body on HTTP 200
 *   - `null` on 404 (job does not exist yet)
 *   - throws on transport/unexpected error so callers can decide.
 *
 * Never retries internally — sequential fail-fast.
 */
export async function probeProgress(
    wsId: string,
    projectId: string,
    jobId: string,
): Promise<GitsyncProgressBody | null> {
    if (!wsId || !projectId || !jobId) {
        const missing: string[] = [];
        if (!wsId) missing.push('wsId');
        if (!projectId) missing.push('projectId');
        if (!jobId) missing.push('jobId');
        throwDiagnostic('GITSYNC_PROBE_E001', { missingArgs: missing.join(',') });
    }
    const sdk = getSdk();
    if (!sdk) {
        const reason = 'marco.api.call unavailable (SDK not injected)';
        logError('GitsyncProbe', 'probeProgress: ' + reason
            + ' [ws=' + wsId + ' pid=' + projectId + ' job=' + jobId + ']');
        throwDiagnostic('GITSYNC_PROBE_E002', { reason });
    }

    const resp = await sdk.api.call('gitsync.progress', {
        params: { wsId, projectId, jobId },
        baseUrl: CREDIT_API_BASE,
    });

    if (resp.status === 404) {
        log('[GitsyncProbe] 404 — no job yet for ws=' + wsId + ' pid=' + projectId
            + ' job=' + jobId, 'info');
        return null;
    }
    if (resp.status === 401 || resp.status === 403) {
        // Caller lacks access → treat as no visible job.
        log('[GitsyncProbe] HTTP ' + resp.status + ' for ws=' + wsId
            + ' pid=' + projectId + ' → null', 'info');
        return null;
    }
    if (!resp.ok) {
        const preview = JSON.stringify(resp.data).substring(0, 200);
        logError('GitsyncProbe', 'probeProgress HTTP ' + resp.status
            + ' [ws=' + wsId + ' pid=' + projectId + ' job=' + jobId + ']'
            + ' bodyPreview=' + preview);
        throwDiagnostic('GITSYNC_PROBE_E003', {
            status: resp.status,
            url: 'gitsync.progress?wsId=' + wsId + '&projectId=' + projectId + '&jobId=' + jobId,
        });
    }

    return (resp.data ?? {}) as GitsyncProgressBody;
}

/* ------------------------------------------------------------------ */
/*  resolveConnection — poll until terminal or deadline                */
/* ------------------------------------------------------------------ */

function isTerminal(body: GitsyncProgressBody | null): boolean {
    if (!body) return false;
    const s = body.status;
    return s === 'completed' || s === 'failed';
}

function toConnected(body: GitsyncProgressBody): GitsyncConnectionState | null {
    const url = body.result?.repo_url;
    if (typeof url === 'string' && url.length > 0) {
        return {
            connected: true,
            repoUrl: url,
            repoName: body.result?.repo_name ?? null,
            owner: body.result?.owner ?? null,
        };
    }
    return null;
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Resolve whether a project is connected to a GitHub repo.
 *
 * NOTE: `connId` is accepted for forward-compat with the `/sync` POST path
 * but the `progress` GET endpoint does NOT require it — the server keys
 * progress by `(wsId, projectId, jobId)` alone. The argument is kept to
 * preserve the signature documented in the spec (Step 4).
 *
 * @param wsId        workspace id
 * @param _connId     connection id (reserved; not used by progress GET)
 * @param projectId   project id
 * @param deadlineMs  total polling budget (default {@link DEFAULT_PROBE_DEADLINE_MS})
 */
export async function resolveConnection(
    wsId: string,
    _connId: string,
    projectId: string,
    deadlineMs: number = DEFAULT_PROBE_DEADLINE_MS,
): Promise<GitsyncConnectionState> {
    if (!wsId || !projectId) {
        return { connected: false, reason: 'error' };
    }
    const jobId = wellKnownJobId(projectId);
    const start = Date.now();

    // First probe — fast path for "already connected".
    let body: GitsyncProgressBody | null;
    try {
        body = await probeProgress(wsId, projectId, jobId);
    } catch (err: unknown) {
        logError('GitsyncProbe', 'resolveConnection initial probe failed'
            + ' [ws=' + wsId + ' pid=' + projectId + ']', err);
        return { connected: false, reason: 'error' };
    }

    if (body === null) {
        return { connected: false, reason: 'no_job' };
    }

    const initial = toConnected(body);
    if (initial) return initial;
    if (isTerminal(body)) return { connected: false, reason: 'no_repo_url' };

    // In-flight — poll sequentially within deadline.
    while (Date.now() - start < deadlineMs) {
        await sleep(PROBE_POLL_INTERVAL_MS);
        try {
            body = await probeProgress(wsId, projectId, jobId);
        } catch (err: unknown) {
            logError('GitsyncProbe', 'resolveConnection poll probe failed'
                + ' [ws=' + wsId + ' pid=' + projectId + ']', err);
            return { connected: false, reason: 'error' };
        }
        if (body === null) {
            return { connected: false, reason: 'no_job' };
        }
        const next = toConnected(body);
        if (next) return next;
        if (isTerminal(body)) return { connected: false, reason: 'no_repo_url' };
    }

    log('[GitsyncProbe] resolveConnection deadline ws=' + wsId
        + ' pid=' + projectId + ' after ' + deadlineMs + 'ms', 'info');
    return { connected: false, reason: 'deadline' };
}

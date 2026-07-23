/**
 * Marco Extension — Recorder Capture Handler
 *
 * Phase 06↔09 wiring.
 *
 * Receives `RECORDER_CAPTURE_PERSIST` (single) or
 * `RECORDER_CAPTURE_PERSIST_BATCH` (coalesced) messages forwarded from the
 * content-script's `XPATH_CAPTURED` queue, resolves the active recording
 * project from `recorder-session-storage`, looks up an anchor `Selector`
 * row when the capture produced a relative XPath, builds a `StepDraft`
 * via the `capture-to-step-bridge`, and persists through `insertStep`.
 *
 * PERF-R6: the batch path resolves the ProjectSlug + opens the project DB
 * ONCE per flush instead of once per click, then persists each payload
 * sequentially (fail-fast). One IPC round-trip replaces N.
 *
 * Messages:
 *   - RECORDER_CAPTURE_PERSIST        → { isOk, step, selectors }
 *   - RECORDER_CAPTURE_PERSIST_BATCH  → { isOk, results: Array<...> }
 *
 * @see ../recorder/capture-to-step-bridge.ts — pure converter
 * @see ../recorder/step-persistence.ts        — Step + Selector rows
 * @see spec/31-macro-recorder/13-capture-to-step-bridge.md
 */

import type { MessageRequest } from "../../shared/messages";
import { initProjectDb } from "../project-db-manager";
import { loadSession } from "../recorder/recorder-session-storage";
import {
    buildStepDraftFromCapture,
    findAnchorSelectorId,
    type XPathCapturePayload,
} from "../recorder/capture-to-step-bridge";
import {
    insertStep,
    type PersistedSelector,
    type PersistedStep,
} from "../recorder/step-persistence";

interface CaptureRequest {
    /** Optional override; falls back to the active session's ProjectSlug. */
    projectSlug?: string;
    payload: XPathCapturePayload;
}

interface CaptureBatchRequest {
    projectSlug?: string;
    payloads: ReadonlyArray<XPathCapturePayload>;
}

interface PersistedCaptureResult {
    readonly step: PersistedStep;
    readonly selectors: ReadonlyArray<PersistedSelector>;
}

export async function handleRecorderCapturePersist(
    message: MessageRequest,
): Promise<{
    isOk: true;
    step: PersistedStep;
    selectors: ReadonlyArray<PersistedSelector>;
}> {
    const req = message as unknown as CaptureRequest;
    if (!req.payload || typeof req.payload.XPathFull !== "string") {
        throw new Error(
            "RECORDER_CAPTURE_PERSIST requires payload.XPathFull (string)",
        );
    }

    const projectSlug = await resolveProjectSlug(req.projectSlug);
    const result = await persistOneCapture(projectSlug, req.payload);
    return { isOk: true, step: result.step, selectors: result.selectors };
}

/**
 * PERF-R6 batch entry. Persists every payload sequentially under a single
 * resolved ProjectSlug. Fails fast on the first error (HEFF semantics) —
 * any payloads already written stay; the caller receives the partial
 * `results` plus the thrown error.
 */
export async function handleRecorderCapturePersistBatch(
    message: MessageRequest,
): Promise<{
    isOk: true;
    results: ReadonlyArray<PersistedCaptureResult>;
}> {
    const req = message as unknown as CaptureBatchRequest;
    if (!Array.isArray(req.payloads) || req.payloads.length === 0) {
        throw new Error(
            "RECORDER_CAPTURE_PERSIST_BATCH requires payloads (non-empty array)",
        );
    }
    for (const p of req.payloads) {
        if (!p || typeof p.XPathFull !== "string") {
            throw new Error(
                "RECORDER_CAPTURE_PERSIST_BATCH: every payload must include XPathFull (string)",
            );
        }
    }

    const projectSlug = await resolveProjectSlug(req.projectSlug);

    const results: PersistedCaptureResult[] = [];
    for (const payload of req.payloads) {
        const result = await persistOneCapture(projectSlug, payload);
        results.push(result);
    }
    return { isOk: true, results };
}

/* ------------------------------------------------------------------ */
/*  Shared core                                                        */
/* ------------------------------------------------------------------ */

async function persistOneCapture(
    projectSlug: string,
    payload: XPathCapturePayload,
): Promise<PersistedCaptureResult> {
    let anchorSelectorId: number | null = null;
    if (payload.XPathRelative !== null && payload.AnchorXPath !== null) {
        const mgr = await initProjectDb(projectSlug);
        anchorSelectorId = findAnchorSelectorId(
            mgr.getDb(),
            payload.AnchorXPath,
        );
    }

    const draft = buildStepDraftFromCapture(payload, anchorSelectorId);
    const { step, selectors } = await insertStep(projectSlug, draft);
    return { step, selectors };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function resolveProjectSlug(override?: string): Promise<string> {
    if (override && override.length > 0) return override;
    const session = await loadSession();
    if (session === null || session.Phase === "Idle") {
        throw new Error(
            "RECORDER_CAPTURE_PERSIST: no active recording session — start the recorder first",
        );
    }
    if (!session.ProjectSlug) {
        throw new Error(
            "RECORDER_CAPTURE_PERSIST: active session has empty ProjectSlug",
        );
    }
    return session.ProjectSlug;
}

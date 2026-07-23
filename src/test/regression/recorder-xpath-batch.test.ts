/**
 * Integration tests, PERF-R6 recorder XPath capture batch protocol.
 *
 * Covers two halves of the pipeline:
 *
 *   1. `xpath-capture-coalescer` (content-script side)
 *        - debounced flush
 *        - MAX_BATCH (8) immediate flush
 *        - single-capture path uses `RECORDER_CAPTURE_PERSIST`
 *        - multi-capture path uses `RECORDER_CAPTURE_PERSIST_BATCH`
 *        - flushNow() drains and tolerates an in-flight flush
 *        - send error is swallowed (fail-fast, no-retry)
 *
 *   2. `recorder-capture-handler` (background side)
 *        - batch entry resolves ProjectSlug once and persists sequentially
 *        - batch validates payloads
 *        - single entry validates payload
 *        - session fallback throws when no active recording
 *
 * @see src/content-scripts/xpath-capture-coalescer.ts
 * @see src/background/handlers/recorder-capture-handler.ts
 * @see mem://constraints/no-retry-policy
 */

import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
} from "vitest";

import {
    enqueueCapture,
    flushNow,
    __setSendForTests,
    __resetForTests,
    __queueLength,
    type CapturePayload,
} from "../../content-scripts/xpath-capture-coalescer";

// Background-side mocks
vi.mock("../../background/project-db-manager", () => ({
    initProjectDb: vi.fn(async () => ({ getDb: () => ({}) })),
}));
vi.mock("../../background/recorder/recorder-session-storage", () => ({
    loadSession: vi.fn(),
}));
vi.mock("../../background/recorder/capture-to-step-bridge", () => ({
    buildStepDraftFromCapture: vi.fn(() => ({ kind: "draft" })),
    findAnchorSelectorId: vi.fn(() => 42),
}));
vi.mock("../../background/recorder/step-persistence", () => ({
    insertStep: vi.fn(async () => ({
        step: { StepId: 1 },
        selectors: [{ SelectorId: 10 }],
    })),
}));

import {
    handleRecorderCapturePersist,
    handleRecorderCapturePersistBatch,
} from "../../background/handlers/recorder-capture-handler";
import { loadSession } from "../../background/recorder/recorder-session-storage";
import { initProjectDb } from "../../background/project-db-manager";
import { insertStep } from "../../background/recorder/step-persistence";

function makeCapture(xpath: string): CapturePayload {
    return {
        type: "XPATH_CAPTURED",
        XPathFull: xpath,
        XPathRelative: null,
        AnchorXPath: null,
    } as CapturePayload;
}

/* ------------------------------------------------------------------ */
/*  Coalescer                                                          */
/* ------------------------------------------------------------------ */

describe("xpath-capture-coalescer", () => {
    let send: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useFakeTimers();
        send = vi.fn(async () => ({ isOk: true }));
        __setSendForTests(send);
        __resetForTests();
    });

    afterEach(() => {
        __setSendForTests(null);
        __resetForTests();
        vi.useRealTimers();
    });

    it("single capture flushes via RECORDER_CAPTURE_PERSIST after debounce", async () => {
        enqueueCapture(makeCapture("/a"));
        expect(send).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(250);

        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toMatchObject({
            type: "RECORDER_CAPTURE_PERSIST",
            payload: { XPathFull: "/a" },
        });
    });

    it("multiple captures coalesce into RECORDER_CAPTURE_PERSIST_BATCH", async () => {
        enqueueCapture(makeCapture("/a"));
        enqueueCapture(makeCapture("/b"));
        enqueueCapture(makeCapture("/c"));

        await vi.advanceTimersByTimeAsync(250);

        expect(send).toHaveBeenCalledTimes(1);
        const msg = send.mock.calls[0][0] as {
            type: string;
            payloads: unknown[];
        };
        expect(msg.type).toBe("RECORDER_CAPTURE_PERSIST_BATCH");
        expect(msg.payloads).toHaveLength(3);
    });

    it("reaching MAX_BATCH (8) flushes immediately without waiting for debounce", async () => {
        for (let i = 0; i < 8; i++) enqueueCapture(makeCapture(`/n${i}`));
        // Allow the microtask queue to settle (flushNow is async).
        await vi.advanceTimersByTimeAsync(0);

        expect(send).toHaveBeenCalledTimes(1);
        const msg = send.mock.calls[0][0] as { payloads: unknown[] };
        expect(msg.payloads).toHaveLength(8);
        expect(__queueLength()).toBe(0);
    });

    it("flushNow() drains the queue eagerly", async () => {
        enqueueCapture(makeCapture("/x"));
        enqueueCapture(makeCapture("/y"));

        await flushNow();

        expect(send).toHaveBeenCalledTimes(1);
        expect(__queueLength()).toBe(0);
    });

    it("flushNow() with empty queue is a no-op", async () => {
        await flushNow();
        expect(send).not.toHaveBeenCalled();
    });

    it("send failure is swallowed (fail-fast, no retry)", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        send.mockRejectedValueOnce(new Error("worker asleep"));

        enqueueCapture(makeCapture("/a"));
        enqueueCapture(makeCapture("/b"));
        await flushNow();

        expect(send).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalled();
        // Next enqueue starts fresh, no retry of the dropped batch.
        enqueueCapture(makeCapture("/c"));
        await flushNow();
        expect(send).toHaveBeenCalledTimes(2);
        warn.mockRestore();
    });

    it("concurrent flushNow calls serialize (no overlapping sends)", async () => {
        let resolveFirst: (v: unknown) => void = () => {};
        send.mockImplementationOnce(
            () => new Promise((r) => (resolveFirst = r)),
        );

        enqueueCapture(makeCapture("/a"));
        const first = flushNow();

        enqueueCapture(makeCapture("/b"));
        const second = flushNow();

        // First send is in flight; second flush is queued behind it.
        expect(send).toHaveBeenCalledTimes(1);

        resolveFirst({ isOk: true });
        await first;
        await second;

        expect(send).toHaveBeenCalledTimes(2);
    });
});

/* ------------------------------------------------------------------ */
/*  Background handler                                                 */
/* ------------------------------------------------------------------ */

describe("recorder-capture-handler, batch protocol", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (loadSession as ReturnType<typeof vi.fn>).mockResolvedValue({
            Phase: "Recording",
            ProjectSlug: "proj-1",
        });
    });

    function batch(payloads: unknown[]) {
        return {
            type: "RECORDER_CAPTURE_PERSIST_BATCH",
            payloads,
        } as never;
    }

    it("persists every payload sequentially under one resolved slug", async () => {
        const res = await handleRecorderCapturePersistBatch(
            batch([
                { XPathFull: "/a", XPathRelative: null, AnchorXPath: null },
                { XPathFull: "/b", XPathRelative: null, AnchorXPath: null },
                { XPathFull: "/c", XPathRelative: null, AnchorXPath: null },
            ]),
        );

        expect(res.isOk).toBe(true);
        expect(res.results).toHaveLength(3);
        expect(loadSession).toHaveBeenCalledTimes(1); // resolved ONCE per batch
        expect(insertStep).toHaveBeenCalledTimes(3);
        expect((insertStep as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
            "proj-1",
        );
    });

    it("opens project DB only when payload carries a relative xpath anchor", async () => {
        await handleRecorderCapturePersistBatch(
            batch([
                { XPathFull: "/a", XPathRelative: null, AnchorXPath: null },
                {
                    XPathFull: "/b",
                    XPathRelative: "./span",
                    AnchorXPath: "/html/body",
                },
            ]),
        );
        expect(initProjectDb).toHaveBeenCalledTimes(1);
    });

    it("rejects empty / non-array payloads", async () => {
        await expect(
            handleRecorderCapturePersistBatch(batch([])),
        ).rejects.toThrow(/non-empty array/);
        await expect(
            handleRecorderCapturePersistBatch({
                type: "RECORDER_CAPTURE_PERSIST_BATCH",
            } as never),
        ).rejects.toThrow(/non-empty array/);
    });

    it("rejects payloads missing XPathFull", async () => {
        await expect(
            handleRecorderCapturePersistBatch(
                batch([{ XPathFull: "/a" }, { nope: true }]),
            ),
        ).rejects.toThrow(/XPathFull/);
    });

    it("single-capture handler validates payload", async () => {
        await expect(
            handleRecorderCapturePersist({
                type: "RECORDER_CAPTURE_PERSIST",
                payload: {},
            } as never),
        ).rejects.toThrow(/XPathFull/);
    });

    it("falls back to session ProjectSlug when override is empty", async () => {
        const res = await handleRecorderCapturePersist({
            type: "RECORDER_CAPTURE_PERSIST",
            payload: {
                XPathFull: "/a",
                XPathRelative: null,
                AnchorXPath: null,
            },
        } as never);
        expect(res.isOk).toBe(true);
        expect((insertStep as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
            "proj-1",
        );
    });

    it("throws when no active recording session", async () => {
        (loadSession as ReturnType<typeof vi.fn>).mockResolvedValue({
            Phase: "Idle",
        });
        await expect(
            handleRecorderCapturePersist({
                type: "RECORDER_CAPTURE_PERSIST",
                payload: {
                    XPathFull: "/a",
                    XPathRelative: null,
                    AnchorXPath: null,
                },
            } as never),
        ).rejects.toThrow(/no active recording session/);
    });
});

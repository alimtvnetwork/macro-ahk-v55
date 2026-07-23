/**
 * Marco Extension — smoke tests for `src/test/support/act-helpers.ts`.
 *
 * Plan 10 Step 2 verification: proves each helper actually silences the
 * class of `act(...)` warning it targets. Each test installs a
 * `console.error` spy scoped to "not wrapped in act" and asserts the
 * spy is NEVER hit while running a component that would otherwise
 * emit the warning.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

import { actRerender, flushEffects, waitRealMs, withFakeTimers } from "@/test/support";

/* ── Fixtures ───────────────────────────────────────────────────── */

function AsyncMountProbe(): React.ReactElement {
    const [ready, setReady] = React.useState(false);
    React.useEffect(() => {
        let cancelled = false;
        void Promise.resolve().then(() => {
            if (!cancelled) setReady(true);
        });
        return () => { cancelled = true; };
    }, []);
    return <div data-testid="probe">{ready ? "ready" : "loading"}</div>;
}

function PropDrivenEffect({ token }: { token: string }): React.ReactElement {
    const [seen, setSeen] = React.useState<string>("initial");
    React.useEffect(() => { setSeen(token); }, [token]);
    return <div data-testid="seen">{seen}</div>;
}

function DelayedFlip(): React.ReactElement {
    const [flipped, setFlipped] = React.useState(false);
    React.useEffect(() => {
        const timer = setTimeout(() => setFlipped(true), 50);
        return () => clearTimeout(timer);
    }, []);
    return <div data-testid="flip">{flipped ? "on" : "off"}</div>;
}

/* ── Warning spy ────────────────────────────────────────────────── */

let actWarnings: string[] = [];
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    actWarnings = [];
    errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        const first = args[0];
        if (typeof first === "string" && first.includes("not wrapped in act")) {
            actWarnings.push(first);
        }
    });
});

afterEach(() => {
    errorSpy.mockRestore();
    cleanup();
});

/* ── Tests ──────────────────────────────────────────────────────── */

describe("act-helpers.flushEffects", () => {
    it("resolves async mount setState inside act so no warning fires", async () => {
        render(<AsyncMountProbe />);
        await flushEffects();
        expect(screen.getByTestId("probe").textContent).toBe("ready");
        expect(actWarnings).toEqual([]);
    });
});

describe("act-helpers.actRerender", () => {
    it("wraps rerender + prop-change effect in act", async () => {
        const view = render(<PropDrivenEffect token="a" />);
        await flushEffects();
        await actRerender((ui) => view.rerender(ui), <PropDrivenEffect token="b" />);
        expect(screen.getByTestId("seen").textContent).toBe("b");
        expect(actWarnings).toEqual([]);
    });
});

describe("act-helpers.waitRealMs", () => {
    it("wraps a real-timer wait so setTimeout-driven setState stays inside act", async () => {
        render(<DelayedFlip />);
        await waitRealMs(80);
        expect(screen.getByTestId("flip").textContent).toBe("on");
        expect(actWarnings).toEqual([]);
    });
});

describe("act-helpers.withFakeTimers", () => {
    it("installs and restores real timers even when body throws", async () => {
        await expect(
            withFakeTimers(async () => { throw new Error("boom"); }),
        ).rejects.toThrow("boom");
        // Real timers restored: setTimeout resolves without vi.advanceTimersByTime.
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        expect(actWarnings).toEqual([]);
    });
});

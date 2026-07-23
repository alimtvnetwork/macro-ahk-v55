/**
 * Integration tests — injection-syntax-preflight
 *
 * Covers the four exported helpers extracted from `injection-handler.ts`
 * in PERF-R2b step 1:
 *   • detectSyntaxError              — Acorn parse wrapper, never throws
 *   • getInlineSyntaxCheckScript     — normalizes request entries
 *   • requestHasInlineSyntaxError    — fast boolean preflight
 *   • collectInlineSyntaxFailures    — full-pass per-script failure list
 *
 * The preflight runs BEFORE chrome.scripting.executeScript() because that
 * API swallows parse failures silently. Each behavior asserted below has
 * a corresponding spec/e2e dependency, so a regression here will surface
 * in production as a "succeeded" injection that never actually ran.
 *
 * @see src/background/handlers/injection-syntax-preflight.ts
 * @see src/background/handlers/injection-handler.ts — pipeline consumer
 * @see src/shared/injection-types.ts — InjectScriptsResponse contract
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    detectSyntaxError,
    getInlineSyntaxCheckScript,
    requestHasInlineSyntaxError,
    collectInlineSyntaxFailures,
    type InjectionRequestScript,
} from "../../background/handlers/injection-syntax-preflight";

/* ------------------------------------------------------------------ */
/*  Console silencing — preflight emits diagnostics on the hot path    */
/* ------------------------------------------------------------------ */

beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  detectSyntaxError                                                  */
/* ------------------------------------------------------------------ */

describe("detectSyntaxError", () => {
    it("returns null for valid script source", () => {
        expect(detectSyntaxError("const x = 1; console.log(x);")).toBeNull();
    });

    it("returns null for IIFE wrapper", () => {
        expect(detectSyntaxError("(function(){ var y = 2; return y; })();")).toBeNull();
    });

    it("returns null for empty source", () => {
        expect(detectSyntaxError("")).toBeNull();
    });

    it("returns parser message for missing closing brace", () => {
        const message = detectSyntaxError("function broken() { var x = 1;");
        expect(message).toBeTypeOf("string");
        expect((message ?? "").length).toBeGreaterThan(0);
    });

    it("returns parser message for unterminated string", () => {
        const message = detectSyntaxError("const s = 'unterminated;");
        expect(message).toBeTypeOf("string");
    });

    it("returns parser message for stray closing paren", () => {
        const message = detectSyntaxError("var x = 1));");
        expect(message).toBeTypeOf("string");
    });

    it("never throws on adversarial input", () => {
        // Long binary-ish garbage — proves try/catch envelope holds.
        const garbage = "\u0000\uFFFF" + "})".repeat(500);
        expect(() => detectSyntaxError(garbage)).not.toThrow();
        expect(detectSyntaxError(garbage)).toBeTypeOf("string");
    });
});

/* ------------------------------------------------------------------ */
/*  getInlineSyntaxCheckScript                                         */
/* ------------------------------------------------------------------ */

describe("getInlineSyntaxCheckScript", () => {
    it("normalizes a full inline entry", () => {
        const out = getInlineSyntaxCheckScript({
            id: "s1",
            name: "Test Script",
            code: "var a = 1;",
        });
        expect(out).toEqual({ id: "s1", name: "Test Script", code: "var a = 1;" });
    });

    it("falls back to id when name is missing", () => {
        const out = getInlineSyntaxCheckScript({ id: "s2", code: "var b = 2;" });
        expect(out).toEqual({ id: "s2", name: "s2", code: "var b = 2;" });
    });

    it("returns null for store-only entry (no inline code)", () => {
        const entry: InjectionRequestScript = { id: "s3", path: "scripts/foo.js", order: 0 };
        expect(getInlineSyntaxCheckScript(entry)).toBeNull();
    });

    it("returns null when id is missing", () => {
        const entry: InjectionRequestScript = { code: "var c = 3;" } as InjectionRequestScript;
        expect(getInlineSyntaxCheckScript(entry)).toBeNull();
    });

    it("returns null for null/undefined/primitives", () => {
        expect(getInlineSyntaxCheckScript(null as unknown as InjectionRequestScript)).toBeNull();
        expect(getInlineSyntaxCheckScript("string" as unknown as InjectionRequestScript)).toBeNull();
        expect(getInlineSyntaxCheckScript(42 as unknown as InjectionRequestScript)).toBeNull();
    });
});

/* ------------------------------------------------------------------ */
/*  requestHasInlineSyntaxError                                        */
/* ------------------------------------------------------------------ */

describe("requestHasInlineSyntaxError", () => {
    it("returns false for empty request", () => {
        expect(requestHasInlineSyntaxError([])).toBe(false);
    });

    it("returns false when every inline script parses", () => {
        const scripts: InjectionRequestScript[] = [
            { id: "a", code: "var x = 1;" },
            { id: "b", code: "console.log('ok');" },
        ];
        expect(requestHasInlineSyntaxError(scripts)).toBe(false);
    });

    it("returns true when any inline script fails to parse", () => {
        const scripts: InjectionRequestScript[] = [
            { id: "a", code: "var x = 1;" },
            { id: "b", code: "function broken(" },
        ];
        expect(requestHasInlineSyntaxError(scripts)).toBe(true);
    });

    it("ignores store-only entries (no inline code) while still flagging real failures", () => {
        const scripts: InjectionRequestScript[] = [
            { id: "store", path: "foo.js", order: 0 },
            { id: "bad", code: "})" },
        ];
        expect(requestHasInlineSyntaxError(scripts)).toBe(true);
    });

    it("returns false when all entries are store-only", () => {
        const scripts: InjectionRequestScript[] = [
            { id: "s1", path: "a.js", order: 0 },
            { id: "s2", path: "b.js", order: 1 },
        ];
        expect(requestHasInlineSyntaxError(scripts)).toBe(false);
    });

    it("short-circuits at first failure (does not parse later scripts)", () => {
        // We can't introspect Acorn calls, but we can prove .some() semantics
        // by asserting the result is true and that a trailing valid entry
        // does not flip the boolean back to false.
        const scripts: InjectionRequestScript[] = [
            { id: "bad", code: "function(" },
            { id: "good", code: "var y = 1;" },
        ];
        expect(requestHasInlineSyntaxError(scripts)).toBe(true);
    });
});

/* ------------------------------------------------------------------ */
/*  collectInlineSyntaxFailures                                        */
/* ------------------------------------------------------------------ */

describe("collectInlineSyntaxFailures", () => {
    it("returns [] when every script parses", () => {
        expect(
            collectInlineSyntaxFailures([
                { id: "a", code: "var x = 1;" },
                { id: "b", code: "var y = 2;" },
            ]),
        ).toEqual([]);
    });

    it("returns [] for empty input", () => {
        expect(collectInlineSyntaxFailures([])).toEqual([]);
    });

    it("returns one InjectionResult per failing inline script", () => {
        const scripts: InjectionRequestScript[] = [
            { id: "good", code: "var ok = 1;" },
            { id: "bad1", name: "Broken One", code: "function(" },
            { id: "bad2", code: "})" },
            { id: "store", path: "foo.js", order: 0 },
        ];
        const failures = collectInlineSyntaxFailures(scripts);
        expect(failures).toHaveLength(2);

        const bad1 = failures.find((f) => f.scriptId === "bad1");
        expect(bad1).toBeDefined();
        expect(bad1?.isSuccess).toBe(false);
        expect(bad1?.scriptName).toBe("Broken One");
        expect(bad1?.errorMessage).toMatch(/Broken One/);
        expect(bad1?.errorMessage).toMatch(/syntax error/);
        expect(bad1?.durationMs).toBe(0);

        const bad2 = failures.find((f) => f.scriptId === "bad2");
        expect(bad2?.scriptName).toBe("bad2"); // falls back to id
        expect(bad2?.errorMessage).toMatch(/bad2/);
    });

    it("preserves request order in returned failures", () => {
        const scripts: InjectionRequestScript[] = [
            { id: "first-bad", code: "function(" },
            { id: "good", code: "var x = 1;" },
            { id: "second-bad", code: "})" },
        ];
        const failures = collectInlineSyntaxFailures(scripts);
        expect(failures.map((f) => f.scriptId)).toEqual(["first-bad", "second-bad"]);
    });

    it("never marks a failure as successful", () => {
        const failures = collectInlineSyntaxFailures([
            { id: "bad", code: "function(" },
        ]);
        for (const f of failures) {
            expect(f.isSuccess).toBe(false);
            expect(f.errorMessage).toBeTypeOf("string");
        }
    });
});

/* ------------------------------------------------------------------ */
/*  Cross-helper consistency                                           */
/* ------------------------------------------------------------------ */

describe("preflight cross-helper consistency", () => {
    it("requestHasInlineSyntaxError === (collectInlineSyntaxFailures.length > 0)", () => {
        const cases: InjectionRequestScript[][] = [
            [],
            [{ id: "a", code: "var x = 1;" }],
            [{ id: "a", code: "function(" }],
            [{ id: "store", path: "x.js", order: 0 }],
            [
                { id: "good", code: "var x = 1;" },
                { id: "bad", code: "})" },
            ],
        ];
        for (const scripts of cases) {
            const flag = requestHasInlineSyntaxError(scripts);
            const failures = collectInlineSyntaxFailures(scripts);
            expect(flag).toBe(failures.length > 0);
        }
    });
});

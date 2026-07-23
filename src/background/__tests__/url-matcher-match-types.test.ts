/**
 * Issue 119 Step 5, URL matcher honors UrlRule.matchType.
 *
 * Locks the contract that the seeder-preserved matchType (exact/glob/regex/prefix)
 * is correctly dispatched by isUrlMatch.
 */

import { describe, it, expect } from "vitest";
import { isUrlMatch } from "../url-matcher";
import type { UrlRule } from "../../shared/project-types";

function rule(matchType: UrlRule["matchType"], pattern: string): UrlRule {
    return { matchType, pattern };
}

describe("url-matcher, honors UrlRule.matchType (Issue 119 Step 5)", () => {
    it("exact matches identical URL and rejects subpath", () => {
        const r = rule("exact", "https://lovable.dev/projects/abc");
        expect(isUrlMatch("https://lovable.dev/projects/abc", r)).toBe(true);
        expect(isUrlMatch("https://lovable.dev/projects/abc/edit", r)).toBe(false);
    });

    it("exact ignores query and fragment", () => {
        const r = rule("exact", "https://lovable.dev/projects/abc");
        expect(isUrlMatch("https://lovable.dev/projects/abc?x=1#h", r)).toBe(true);
    });

    it("prefix matches any URL starting with the pattern", () => {
        const r = rule("prefix", "https://lovable.dev/projects/");
        expect(isUrlMatch("https://lovable.dev/projects/abc", r)).toBe(true);
        expect(isUrlMatch("https://other.dev/projects/abc", r)).toBe(false);
    });

    it("glob expands * across path segments", () => {
        const r = rule("glob", "https://lovable.dev/projects/*/edit");
        expect(isUrlMatch("https://lovable.dev/projects/abc/edit", r)).toBe(true);
        expect(isUrlMatch("https://lovable.dev/projects/abc/view", r)).toBe(false);
    });

    it("glob ? matches exactly one character", () => {
        const r = rule("glob", "https://lovable.dev/p?");
        expect(isUrlMatch("https://lovable.dev/pa", r)).toBe(true);
        expect(isUrlMatch("https://lovable.dev/pab", r)).toBe(false);
    });

    it("regex matches via RegExp semantics", () => {
        const r = rule("regex", "^https://lovable\\.dev/projects/[a-f0-9]{3}$");
        expect(isUrlMatch("https://lovable.dev/projects/abc", r)).toBe(true);
        expect(isUrlMatch("https://lovable.dev/projects/abcd", r)).toBe(false);
    });

    it("invalid regex returns false instead of throwing", () => {
        const r = rule("regex", "([unclosed");
        expect(isUrlMatch("https://lovable.dev/", r)).toBe(false);
    });

    it("dispatch is matchType-driven, same pattern behaves differently per type", () => {
        const pattern = "https://lovable.dev/projects/abc";
        expect(isUrlMatch("https://lovable.dev/projects/abc/edit", rule("exact", pattern))).toBe(false);
        expect(isUrlMatch("https://lovable.dev/projects/abc/edit", rule("prefix", pattern))).toBe(true);
    });

    it("unknown matchType falls through to false (defensive)", () => {
        const bogus = { matchType: "bogus", pattern: "x" } as unknown as UrlRule;
        expect(isUrlMatch("x", bogus)).toBe(false);
    });
});

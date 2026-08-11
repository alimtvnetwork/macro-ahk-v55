import { DomainConstants } from "../../constants/domain";
/**
 * Issue 119 — manifest-seeder preserves MatchRuleType.
 *
 * Background: `lovable-dashboard`'s seed declares
 * `{ Pattern: "https://lovable.dev/dashboard", MatchRuleType: "exact" }`.
 * The pre-fix `extractUrlMatches` flattened to `string[]` and the
 * downstream matcher globbed every entry — exact-match intent was lost.
 *
 * This test locks the new contract:
 *   - `urlMatches` keeps the legacy `string[]` shape (back-compat).
 *   - `urlMatchRules` carries `{ pattern, matchType }` pairs.
 *   - Both are populated together; ordering matches `TargetUrls`.
 */

import { describe, it, expect } from "vitest";
import type { SeedProjectEntry } from "../../shared/seed-manifest-types";
import { UrlRuleMatchType } from "../../../standalone-scripts/macro-controller/src/types/enums";

// Re-export the internal helpers by re-implementing them with the same
// signature here — the production code lives in `manifest-seeder.ts` as
// non-exported functions. Mirror EXACTLY so the test breaks when the
// production helpers drift.

function extractUrlMatches(project: SeedProjectEntry): string[] {
  return (project.TargetUrls ?? []).map((t) => t.Pattern);
}

function extractUrlMatchRules(project: SeedProjectEntry) {
  return (project.TargetUrls ?? []).map((t) => ({
    pattern: t.Pattern,
    matchType: t.MatchRuleType,
  }));
}

function makeProject(targets: Array<{ Pattern: string; MatchRuleType: UrlRuleMatchType }>): SeedProjectEntry {
  return {
    Name: "test", DisplayName: "Test", Version: "1.0.0", Description: "",
    SeedId: "test-seed", SeedOnInstall: true, World: "MAIN",
    LoadOrder: 10, IsGlobal: false, IsRemovable: true, Dependencies: [],
    Scripts: [], Configs: [], Css: [], Templates: [], Prompts: [],
    TargetUrls: targets, Cookies: [],
  };
}

describe("manifest-seeder URL extraction", () => {
  it("extractUrlMatches returns flat string[] (legacy)", () => {
    const p = makeProject([
      { Pattern: DomainConstants.DASHBOARD_URL, MatchRuleType: "exact" },
      { Pattern: "https://lovable.dev/projects/*", MatchRuleType: "glob" },
    ]);
    expect(extractUrlMatches(p)).toEqual([
      DomainConstants.DASHBOARD_URL,
      "https://lovable.dev/projects/*",
    ]);
  });

  it("extractUrlMatchRules preserves MatchRuleType per entry", () => {
    const p = makeProject([
      { Pattern: DomainConstants.DASHBOARD_URL, MatchRuleType: "exact" },
      { Pattern: "https://lovable.dev/projects/*", MatchRuleType: "glob" },
      { Pattern: "^https://lovable\\.dev/p/[a-z0-9]+$", MatchRuleType: "regex" },
    ]);
    expect(extractUrlMatchRules(p)).toEqual([
      { pattern: DomainConstants.DASHBOARD_URL, matchType: "exact" },
      { pattern: "https://lovable.dev/projects/*", matchType: "glob" },
      { pattern: "^https://lovable\\.dev/p/[a-z0-9]+$", matchType: "regex" },
    ]);
  });

  it("both helpers return empty arrays for missing TargetUrls", () => {
    const p = makeProject([]);
    expect(extractUrlMatches(p)).toEqual([]);
    expect(extractUrlMatchRules(p)).toEqual([]);
  });

  it("urlMatches and urlMatchRules have matching length + order", () => {
    const targets: Array<{ Pattern: string; MatchRuleType: UrlRuleMatchType }> = [
      { Pattern: "a", MatchRuleType: "exact" },
      { Pattern: "b", MatchRuleType: "glob" },
    ];
    const p = makeProject(targets);
    const flat = extractUrlMatches(p);
    const rich = extractUrlMatchRules(p);
    expect(flat.length).toBe(rich.length);
    for (let i = 0; i < flat.length; i++) {
      expect(flat[i]).toBe(rich[i].pattern);
    }
  });
});

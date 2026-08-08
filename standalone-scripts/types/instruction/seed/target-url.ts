import type { UrlPattern } from "../primitives/url-pattern";
import type { MatchRuleType } from "../enums/match-type";

/**
 * One URL pattern used by the injection scheduler. `MatchRuleType`
 * disambiguates how `Pattern` is evaluated.
 *
 * `MatchRuleType` uses the shared enum at authoring time and compiles to the
 * runtime matcher's stable string vocabulary in JSON artifacts.
 */
export type TargetUrl = {
    readonly Pattern: UrlPattern;
    readonly MatchRuleType: MatchRuleType;
};

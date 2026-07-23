# SS-25 — Reduce top 5 sonarjs/cognitive-complexity offenders

Slug: ss-25-complexity-top5
Status: pending
Created: 2026-07-19
Parent: 25-eslint-cleanup-continuation-30

## Goal

Bring the 5 highest cognitive-complexity functions listed in `.lovable/audits/eslint-baseline-25.md` under the configured threshold without regressing behavior.

## Techniques (apply per offender)

1. Early-return guard clauses instead of nested `if/else`.
2. Extract each independent branch predicate into a named `is<X>()` helper (adjacent to the function).
3. Replace long `switch`/`if` ladders with a lookup table keyed by the discriminant.
4. Move logging + telemetry side-effects into a dedicated helper so the main function reads as pure control flow.
5. Preserve public signatures; refactors are internal.

## Verification

- ESLint reports 0 `sonarjs/cognitive-complexity` hits for the 5 targeted functions.
- Existing unit tests for those modules pass unchanged. If none exist, add one positive + one negative case before landing the refactor (per `mem://preferences/test-with-features`).
- `npx tsgo --noEmit` stays green.

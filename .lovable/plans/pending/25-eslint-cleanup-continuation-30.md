# ESLint Cleanup Continuation — Second 30-Step Sweep

Slug: eslint-cleanup-continuation-30
Steps: 30
Status: pending
Created: 2026-07-19

## Context

Plan 24 (`.lovable/plans/pending/24-eslint-warnings-cleanup-30.md`) resolved SS-01..SS-09 (Steps 1-15) and shipped through v4.220.0. The ESLint baseline in `.lovable/audits/eslint-baseline-24.md` still shows 193 warnings + 8 errors, dominated by `max-lines-per-function` (151) and `sonarjs/cognitive-complexity` (27). This plan continues that cleanup: re-baseline the offenders on the current tree, decompose the next 20 largest, then re-lock `--max-warnings=0` in CI so drift cannot return.

No new commands or user-reported issues were surfaced in this turn's prompt, so nothing was appended to `.lovable/spec/commands/` or `.lovable/issues/`.

## Steps

1. Re-run `npx eslint . -f json > .lovable/audits/eslint-baseline-25.json` and generate a fresh markdown summary at `.lovable/audits/eslint-baseline-25.md` with totals by rule and per-file offender ranking. See ./subtasks/25-eslint-cleanup-continuation-30/01-rebaseline.md
2. Resolve the 2 parse errors flagged in baseline-24 (they mask further linting); confirm baseline-25 shows 0 parse errors.
3. Fix the 8 remaining `id-denylist` errors surfaced by baseline-25 (rename `arr`/`cb`/`fn`/`el`/`msg` -> descriptive names) across whatever files still trip it.
4. Fix the 7 `sonarjs/no-duplicate-string` warnings by extracting constants near the top of each offender module.
5. Fix the 2 `sonarjs/no-collapsible-if` warnings by flattening nested conditionals.
6. Fix the 2 `react-refresh/only-export-components` warnings by moving non-component exports into sibling files.
7. Fix the 2 `react-hooks/exhaustive-deps` warnings by either adding the missing dep or extracting a stable callback with `useCallback`.
8. Collapse `LibraryDialogs` prop surface into grouped bags (06 Phase 4 carry-over from Plan 24). See ./subtasks/25-eslint-cleanup-continuation-30/08-library-dialogs-props.md
9. 10: decompose the #1 remaining `max-lines-per-function` offender identified by baseline-25 (extract controller hook + leaf children, keep host <120 lines). See ./subtasks/25-eslint-cleanup-continuation-30/10-offender-1.md
10. 11: decompose the #2 offender using the same recipe.
11. 12: decompose the #3 offender.
12. 13: decompose the #4 offender.
13. 14: decompose the #5 offender.
14. 15: decompose the #6 offender.
15. 16: decompose the #7 offender.
16. 17: decompose the #8 offender.
17. 18: decompose the #9 offender.
18. 19: decompose the #10 offender.
19. 20: decompose the #11 offender.
20. 21: decompose the #12 offender.
21. 22: decompose the #13 offender.
22. 23: decompose the #14 offender.
23. 24: decompose the #15 offender (last of the `max-lines-per-function` big-15 batch).
24. 25: tackle the top 5 `sonarjs/cognitive-complexity` offenders by extracting predicate helpers and early-returns. See ./subtasks/25-eslint-cleanup-continuation-30/25-complexity-top5.md
25. 26: tackle the remaining `sonarjs/cognitive-complexity` offenders (rank 6..27 or whatever survives).
26. Add a Vitest regression that mounts/unmounts each newly decomposed host component and asserts no interval/listener leak (extend the pattern from `macro-ui-mount-unmount-leaks.test.ts`).
27. Run `npx tsgo --noEmit` and confirm 0 diagnostics; fix any type fallout from the decompositions in place.
28. Run `npx eslint . --max-warnings=0` locally and confirm exit code 0; save the clean output as `.lovable/audits/eslint-clean-25.txt`.
29. Update `.github/workflows/spec-gates.yml` (or the ESLint gate workflow) to run `eslint . --max-warnings=0` on every push with no `paths:` filter; add a canary test asserting the workflow trigger stays unfiltered (mirror the `ci-workflow-trigger-policy.test.mjs` pattern).
30. Release ceremony: bump minor to v4.221.0 across `manifest.json`, `version.json`, `src/shared/constants.ts`, `readme.md`, `marco-sdk` (`index.ts` + `prompts.ts` `CACHE_SCHEMA_VERSION`), `macro-controller/shared-state.ts`, `payment-banner-hider/index.ts`, every `standalone-scripts/*/src/instruction.ts`; append `changelog.md` entry; update `RELEASE_NOTES.md`; run `scripts/update-stale-version-refs.mjs` and confirm clean; move this plan file to `.lovable/plans/completed/25-eslint-cleanup-continuation-30.md` with `Status: completed`.

## Verification

- Steps 1-2: baseline-25.md exists, 0 parse errors, offender ranking present.
- Steps 3-7: `npx eslint .` shows 0 hits for the targeted rule families.
- Steps 8-23: each host file <120 lines; `npx tsgo --noEmit` stays green after each step.
- Step 24-25: cognitive-complexity count drops to 0.
- Step 26: new Vitest suite passes; subscriber/interval registries return to baseline.
- Step 27: `npx tsgo --noEmit` returns 0 diagnostics.
- Step 28: `npx eslint . --max-warnings=0` exits 0; artifact saved.
- Step 29: workflow file diff shows unfiltered `on: push:`; canary test passes.
- Step 30: `scripts/update-stale-version-refs.mjs` reports clean; `changelog.md` head entry matches v4.221.0; plan file physically located under `completed/`.

## Appended from prior pending tasks

Carry-overs from `.lovable/plans/pending/24-eslint-warnings-cleanup-30.md` folded into Steps 8, 9-23, 24-25, 28:
- SS-06 Phase 4 (LibraryDialogs prop bags) → Step 8
- SS-10..SS-29 (remaining decompositions) → Steps 9-25 (rescoped against a fresh baseline instead of the stale baseline-24 ranking)
- SS-30 (re-baseline `--max-warnings=0`) → Steps 28-29

Other pending plans (10, 11, 13, 22, 23) are unrelated scope and remain independent.

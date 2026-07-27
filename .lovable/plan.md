## Root cause

Tag-is-source-of-truth switch made `version.json` a build-time artifact whose local-dev fallback is `0.0.0-dev`. Three tests still assume a strict `X.Y.Z` literal:

1. `src/test/regression/macro-controller-recovery.test.ts` asserts `pkg.version` matches `/^\d+\.\d+\.\d+$/` (strict).
2. `prompt-library-modal-round-trip.test.ts` and `prompt-sample-json.test.ts` build a bundle whose `exporterVersion` comes from `VERSION` (= `0.0.0-dev`), then `parsePromptsText` fails validation against `SEMVER_RE = /^\d+\.\d+\.\d+$/` in `prompt-bundle-types.ts`.

Not flaky, deterministic: any test run without a tag or `VERSION` env produces `0.0.0-dev` and both regexes reject it. The prior fix to `version.json` was reverted (correctly) to `0.0.0-dev` per the non-negotiable rule.

## Fix

Align consumers with `write-version-from-tag.mjs`'s own SEMVER pattern (`/^[0-9]+\.[0-9]+\.[0-9]+([.-].+)?$/`), which already permits the dev suffix, and regenerate `version.json` before tests so real tags populate it in CI.

1. `standalone-scripts/macro-controller/src/ui/prompt-bundle-types.ts` - widen `SEMVER_RE` to accept optional prerelease/build suffix so `0.0.0-dev` and `5.13.0-rc.1` both validate. Update the error message accordingly.
2. `src/test/regression/macro-controller-recovery.test.ts` - update the regex to the same shared pattern.
3. `package.json` - add `pretest` (and `pretest:*` where applicable) that runs `node scripts/write-version-from-tag.mjs` so CI-with-tag runs use the real version and local runs fall back cleanly.
4. Add a tiny memory note under `mem://constraints/` recording that any new version validator must accept the `-dev` fallback, so this class of failure cannot regress.

## Release

5. Do NOT edit `version.json`. Cut MINOR bump by creating and pushing tag `v5.13.0` (surface the exact commands; sandbox cannot run stateful git).
6. Add a changelog entry under `.lovable/changelog/` (or the existing changelog file, whichever matches project convention discovered on read) explaining the RCA in plain terms.
7. Update the pinned "Latest release" line in root `readme.md` to `v5.13.0`.
8. Verify: `bunx vitest run` green, `tsgo` green.

## Non-goals

- No hand-edit of `version.json`.
- No new CI stale-version gate.
- No change to release ceremony (tag remains sole source).
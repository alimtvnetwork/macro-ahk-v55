# 15. Macro-Controller Missing IIFE in E2E Tests

## Pipeline / Workflow
`.github/workflows/ci.yml` (specifically the `e2e` job)

## Description
The `e2e` Playwright test suite fails on CI with a `Missing IIFE bundle` error thrown by `macro-controller-harness.ts`. The harness is attempting to mount `/home/runner/work/macro-ahk-v55/macro-ahk-v55/standalone-scripts/macro-controller/dist/macro-looping.js`, but the file is not found.

## First Seen
2026-08-08 during a CI/CD run on a PR or main branch.

## Root Cause
The `build-macro-controller` job properly compiles the standalone script and uploads it as an artifact named `macro-controller-dist`. However, the `e2e` job only downloads the `chrome-extension-dist` artifact into `dist/`. Because the test harness explicitly requires the standalone build file from `standalone-scripts/macro-controller/dist/`, the file is physically missing from the `e2e` job's workspace.

## Status
Active

## Fix
(Pending) Add a step in `.github/workflows/ci.yml` inside the `e2e` job to download the `macro-controller-dist` artifact and place it in `standalone-scripts/macro-controller/dist/`.

## Prevention
Any e2e test that depends on standalone scripts bypassing the extension bundle needs to explicitly declare those dependencies in the CI workflow, ensuring the corresponding artifacts are downloaded before testing begins.

## References
- `.github/workflows/ci.yml` (`e2e` job)
- `tests/e2e/utils/macro-controller-harness.ts`

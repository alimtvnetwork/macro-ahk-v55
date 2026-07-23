# SS-04 logger-contract scan

Parent: 16-standalone-scripts-coding-guideline-audit
Status: pending
Created: 2026-07-27

## Rules sourced from

- `spec/03-error-manage/02-error-architecture/**`
- `mem://standards/error-logging-via-namespace-logger`
- `mem://standards/verbose-logging-and-failure-diagnostics`

## Contract

Every non-test file under `standalone-scripts/**/src/**` must reach the namespace logger through `RiseupAsiaMacroExt.Logger.error()` / `.warn()` / `.info()` (or a project-local `logError`/`logWarn` that ultimately delegates there). Bare `console.error` / `console.warn` are P1 violations. Bare `console.log` in prod code paths is P2 (allowed in dev-only guarded blocks).

## Grep sweeps

- `rg -n 'console\.(error|warn)' standalone-scripts/**/src` (exclude `__tests__`).
- `rg -n 'catch\s*\([^)]*\)\s*{\s*}' standalone-scripts/**/src` (empty catch = P0).
- `rg -n 'catch\s*\([^)]*\)\s*{[^}]*console\.' standalone-scripts/**/src` (catch that only console-logs = P1, needs Reason+ReasonDetail).

## Output shape

`| file:line | offendingCall | severity | requiredReplacement |`

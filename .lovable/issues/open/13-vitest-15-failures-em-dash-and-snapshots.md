---
Slug: vitest-15-failures-em-dash-and-snapshots
Status: open
Created: 2026-07-20
Related-Plan: 34-fix-vitest-15-failures
---

# Vitest: 4 files / 15 tests failing on main (v4.358.0)

## Symptom (from `user-uploads://file-55`, `pnpm run test` CI log)

Summary line 3546-3547:

```
Test Files  4 failed | 482 passed (486)
     Tests  15 failed | 5259 passed | 7 todo (5281)
```

## Failure clusters

1. **Em-dash regression in retry notes** (1 test)
   - `src/background/recorder/__tests__/retry-step.test.ts:99`
   - Source emits `Retry of step #42 — from toast` (em dash).
   - Test asserts `Retry of step #42, from toast` (ASCII comma).
   - Violates `mem://~user` "Never use em dashes" + `.lovable/prompts/14-release.md` "No em dashes".
   - Fix location: the note-builder that prefixes retry drafts (likely `src/background/recorder/retry-step.ts` or wherever the "Retry of step #N" string is composed).

2. **FailureReport snapshot drift, UrlTabClick + Condition + XPath/CSS predicate** (11 tests)
   - `src/background/recorder/__tests__/failure-report-snapshots.test.ts` at lines 119, 139, 186, 217, 239, 254, 269, 284.
   - Canonical JSON snapshots no longer match the emitted `FailureReport` shape after recent recorder refactors (Plan 30/31/33).
   - Either the snapshots are stale (regenerate after review) or the emitter added/renamed a field. Must diff before choosing.

3. **`macro-controller-recovery.test.ts:132` extMatch null** (1 test)
   - `src/test/regression/macro-controller-recovery.test.ts:132` — `expect(extMatch).not.toBeNull()` failed.
   - Suggests the regex in that test no longer matches the current controller-recovery source (likely a comment or version string removed by a refactor).

4. **Startup.ts "Passive attach, no visible UI" comment removed** (1 test)
   - `expect('/**\n * MacroLoop Controller, Startu...').toContain('Passive attach, no visible UI')` failed.
   - A doc comment was stripped from `standalone-scripts/macro-controller/src/startup.ts` (or its equivalent) during a refactor. Either restore the comment or update the assertion.

Note lines 1843 + 2452: em dash appears in an unrelated stdout dump for `MacroLoop Controller — Startup` — that comment itself uses an em dash, which is a separate hygiene fix.

## Expected

`pnpm run test` -> `Test Files 486 passed`, `Tests 15 failed -> 0 failed`.

## Related files

- src/background/recorder/retry-step.ts (retry note builder)
- src/background/recorder/failure-logger.ts (emitter for FailureReport shape)
- src/background/recorder/__tests__/failure-report-snapshots.test.ts
- src/background/recorder/__tests__/retry-step.test.ts
- src/test/regression/macro-controller-recovery.test.ts (line 132 regex)
- standalone-scripts/macro-controller/src/startup.ts (header comment)

## Status

open

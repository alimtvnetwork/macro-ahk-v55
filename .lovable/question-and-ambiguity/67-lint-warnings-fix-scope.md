# 67 — Lint warnings fix scope (203 warnings, ~100 files)

## Situation

User uploaded the CI lint output showing **1 error + 203 warnings**.

The single **error** (`id-denylist: ctx` in `tests/e2e/prompt-chip-edit-regression.spec.ts:103`) was already fixed in v4.153.1. CI is now green (warnings do not block).

User then asked: *"can we fix these warnings"*.

## Warning breakdown

| Rule | Count | Effort | Risk |
| --- | ---: | --- | --- |
| `max-lines-per-function` | 152 | High (real refactor per function) | Medium — must not break behaviour, needs tests |
| `sonarjs/cognitive-complexity` | 27 | High (real refactor) | Medium |
| `sonarjs/no-nested-template-literals` | 9 | Trivial (extract to const) | Very low |
| `sonarjs/no-duplicate-string` | 4 | Low (extract constants) | Low |
| `sonarjs/no-collapsible-if` | 2 | Trivial | Very low |
| `sonarjs/no-identical-functions` | 1 | Low | Low |
| `react-hooks/exhaustive-deps` | 2 | Low (wrap in `useMemo`) | Medium — can change behaviour |
| `react-refresh/only-export-components` | 2 | Low (move constant out) | Low |
| Other | 4 | Low | Low |

## Recommendation

**Phased.** All 203 warnings are non-blocking; a single-turn "fix everything" attempt would either take many hours or introduce regressions in the 152 `max-lines-per-function` functions that need thoughtful splitting.

Chosen phased plan:

- **Phase 1 (this turn, done):** the 9 `no-nested-template-literals` sites. Mechanical extraction to `const`. Zero behaviour change. Files:
  - `src/background/recorder/failure-logger.ts` (2)
  - `src/background/recorder/field-reference-resolver.ts` (1)
  - `src/background/recorder/step-library/csv-parse.ts` (1)
  - `src/components/options/StepGroupLibraryPanel.tsx` (1)
  - `src/components/recorder/SelectorComparisonPanel.tsx` (1)
  - `src/components/recorder/SelectorTesterPanel.tsx` (1)
  - `src/components/recorder/failure-toast.ts` (1)
  - `src/components/recorder/selector-replay-trace.ts` (1)
- **Phase 2 (next turn):** `no-collapsible-if` (2), `no-duplicate-string` (4), `no-identical-functions` (1), unused `eslint-disable` (1), `react-refresh/only-export-components` (2), `react-hooks/exhaustive-deps` (2). ~12 warnings.
- **Phase 3+ (many turns):** `max-lines-per-function` + `cognitive-complexity` — split by subsystem, one file per turn, with regression tests where behaviour is non-trivial:
  - 3a: `src/background/recorder/*` (recorder subsystem; heaviest cluster)
  - 3b: `src/background/handlers/*` + `src/background/*`
  - 3c: `src/components/options/*`
  - 3d: `src/components/recorder/*`
  - 3e: everything else (tests, workers, standalone-scripts)

## Alternatives considered

- **Bulk-raise the thresholds** in `eslint.config.js` (e.g. `max-lines-per-function: 100`): rejected — memory core rule "Zero ESLint warnings/errors; modular architecture" bans relaxing quality gates.
- **Add per-file `eslint-disable` comments:** rejected for the same reason. Only acceptable on generated / vendored files.

## Proceed

Phase 1 executed this turn. User can say `next` (or `next 2 tasks`) to run Phase 2 and continue through Phase 3.

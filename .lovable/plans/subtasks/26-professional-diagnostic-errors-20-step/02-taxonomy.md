---
Slug: taxonomy
Status: completed
Created: 2026-07-19
Parent: 26-professional-diagnostic-errors-20-step
---

# SS-02 Error-code taxonomy (finalized)

## Code format
`<AREA>_<ACTION>_E<NNN>` where NNN is zero-padded 3 digits, allocated per (area, action) namespace. Codes are FROZEN once shipped: deprecate, never renumber.

## Severity
`fatal` (extension cannot continue), `error` (feature failed, user must retry or fix), `warn` (degraded, auto-recovered), `info` (surfaced context only).

## Registry entry shape
```ts
export interface ErrorCodeEntry {
  readonly code: string;                 // 'PROMPT_VALIDATE_E001'
  readonly area: ErrorArea;              // 'PROMPT'
  readonly action: string;               // 'VALIDATE'
  readonly severity: ErrorSeverity;      // 'error'
  readonly humanTemplate: string;        // 'Cannot save {role} prompt: expected {expected} {{n}} token(s), found {actual}. Add {missing} more.'
  readonly requiredContextKeys: readonly string[]; // ['role','slug','expected','actual','ruleId']
  readonly nextFixHint?: string;         // 'Open the editor and add the missing token before saving.'
}
```

## Areas and initial code slots (feeds step 3 registry)

| Area | Actions | Initial slot count | Notes |
|------|---------|-------------------:|-------|
| `PROMPT` | `EDIT`, `VALIDATE`, `LOAD`, `SAVE`, `RESET` | 12 | user-facing prompt editor + validation |
| `PROMPT_IO` | `IMPORT`, `EXPORT`, `ZIP`, `SQLITE` | 10 | import/export bundles |
| `SEED` | `INSERT`, `PROMOTE`, `UPGRADE`, `AUDIT` | 6 | seed-plan-next + audit table |
| `HEALTH` | `CHECK`, `REPAIR` | 4 | health-check + auto-repair pipeline |
| `REPAIR` | `RUN`, `REOPEN` | 4 | chip-gear repair action + report modal |
| `HISTORY` | `RESOLVE`, `LOAD` | 4 | history panel slug resolution |
| `DB` | `READ`, `WRITE`, `MIGRATE` | 6 | SQLite adapter |
| `HTTP` | `REQUEST` | 6 | shared HTTP failure code (context.op differentiates callsites) |
| `SDK` | `NOT_READY`, `MISSING_API` | 4 | marco SDK readiness gate |
| `WS_MEMBERS` | `LIST`, `INVITE`, `REMOVE`, `PROMOTE` | 6 | workspace members |
| `WS_MOVE` | `RUN`, `POST_SYNC` | 4 | move + post-move refresh |
| `WS_CONTEXT` | `OPEN`, `ACTION` | 4 | right-click menu |
| `REMIX` | `LIST`, `INIT`, `BULK` | 4 | remix flows |
| `RENAME` | `RUN` | 2 | rename-api |
| `GITSYNC` | `PROBE`, `TRIGGER` | 4 | gitsync progress + trigger |
| `CREDIT` | `FETCH`, `PARSE` | 4 | credit fetch pipeline |
| `PROZERO` | `ADAPTER` | 2 | pro_0 SDK adapter |
| `SETTINGS` | `VALIDATE`, `PERSIST` | 4 | settings modal + store |
| `SPLITTER` | `VALIDATE` | 2 | task splitter prompt |
| `TELEMETRY` | `EMIT` | 2 | telemetry sink |
| `UI` | `RENDER`, `TEMPLATE` | 2 | template renderer, generic UI |

Total initial slots: ~96 (well above the 151 audited sites because each `HTTP_REQUEST` code collapses 11+ callsites via `context.op` + `context.url`).

## Message-writing rules (enforced by tests in step 16)

1. **No profanity, no "oops", no "WTF"**, no bare "Failed".
2. `humanTemplate` MUST state: (a) what was attempted, (b) why it failed, (c) next fix step (either in the template or in `nextFixHint`).
3. `humanTemplate` uses `{placeholder}` variables that MUST all appear in `requiredContextKeys`.
4. `requiredContextKeys` MUST list every variable needed to triage the error (role, slug, url, status, wsId, projectId, ruleId, expected, actual — as appropriate to the area).
5. Templates for user-facing toasts are professional English, ≤ 240 chars body + separate footer with the code in monospace.

## Codes are frozen
- Once a code ships in a release, its `code`, `area`, `action`, and `requiredContextKeys` cannot be changed. `humanTemplate` may be reworded but must retain the same placeholders.
- To retire a code, mark `deprecated: true` and add `replacedBy: '<newCode>'`. Never reuse a retired number.

## Blocks / unblocks
- Blocks: step 3 (registry file), step 4 (DiagnosticError enforcement of requiredContextKeys), step 14 (CI uniqueness check).
- Unblocked by: SS-01 audit slot allocation.

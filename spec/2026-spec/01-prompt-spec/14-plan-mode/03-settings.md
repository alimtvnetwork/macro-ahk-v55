# 03 — Plan Settings

**Date:** 2026-06-02
**Task:** T88

## Shape

```ts
interface PlanSettings {
  promptSlug: string;        // default "plan-default"
  stepCount: number;         // default 10, range 1..50
  delay: DelayConfig;        // default baseMs 12000, jitter 0.2, skipFirst false
  idleTimeoutMs: number;     // default 180000 (3 min, plans stream longer)
  autoOpenResult: boolean;   // default true — focus host output after completion
}
```

## Validation

- `stepCount` clamped to `[1, 50]`. Beyond 50 the model output degrades and the prompt template breaks numbering. Inline warning above 30.
- `idleTimeoutMs` clamped to `[30000, 600000]`. Below 30s plans routinely false-timeout.
- `promptSlug` MUST resolve at save time — unresolved slug surfaces a save error and the prior value is kept.

## Persistence

Single key `prompts.planSettings`. Schema-validated on load; corruption falls back to defaults with one warn log per session.

## Per-host overrides

Hosts may ship their own defaults by registering a `PlanDefaultsProvider` at boot. User edits always win over host defaults; user **reset** restores the host default, not the spec default.

## Acceptance

- [ ] The implementation satisfies the `03 — Plan Settings` contract in this file and the folder-level acceptance target: PlanLoop renders, queues, edits, and compares against NextLoop without autorun ambiguity.
- [ ] Verification passes when `E2E-plan-001..003` passes, and `node scripts/audit/check-acceptance.mjs --root=spec/2026-spec` reports this file has a machine-checkable acceptance contract.

---

<!-- audit: numeric constants source-of-truth -->

Numeric defaults referenced in this file are canonical in [Runtime Defaults](../reference/05-runtime-defaults.md). If a value differs, the SOT wins.

<!-- audit: determinism+pitfalls footer -->

## Determinism (MUST)

- **MUST** render the Plan row in the prompts dropdown at the position defined by `PLAN_ROW_INDEX` (0) — never deeper (see `mem://features/macro-controller/plan-task-ux-20-step`).
- **MUST** keep the Plan prompt template in `02-prompt-template.md` as the single source; settings only override variables, never the template body.
- **MUST** compare Plan vs Next side-by-side per `04-vs-next-comparison.md`; UI MUST surface the active mode chip at all times.
- **MUST** anchor the Task Next button to the right edge per the closed 20-step plan; left-anchoring is forbidden.

## Pitfalls / Counter-examples

- ❌ Re-ordering the Plan row "to match alphabetic sort". ✅ Plan row is pinned at index 0.
- ❌ Auto-running Plan macros on load. ✅ Macro no-autorun guard is mandatory.
- ❌ Sharing template state between Plan and Next. ✅ Each mode owns its own template + variable scope.
- ❌ Hiding the mode chip when the dropdown is closed. ✅ Always visible.
- ❌ Adding exponential backoff to Plan re-fetch on failure. ✅ Fail fast; show error chip.

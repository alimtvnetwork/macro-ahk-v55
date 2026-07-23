# 01 — Plan Mode Overview

**Date:** 2026-06-02
**Task:** T86

## Definition

**Plan mode** runs a single prompt — typically a "plan the next N steps" template — through the same queue engine as Next mode, but with different defaults tuned for longer, heavier responses.

It is **not** a new engine. It is a configuration profile + a designated default prompt slug.

## Differences from Next mode

| Aspect | Next | Plan |
|--------|------|------|
| Task `kind` | `"next"` | `"plan"` |
| Default count | user input, no cap suggestion | typically 1 |
| Default delay | 7000 ms | 12000 ms (longer streams) |
| `skipFirst` | true | false (small lead-in helps UI) |
| Default prompt | user-chosen | host-designated slug, overridable |
| Failure tone | per-task warning | per-task error (a failed plan derails the user) |

## Same as Next

- Queue store, task shape, statuses, ordering.
- Editor adapters, submit-button contract, interruption observer.
- Cancel / pause / resume semantics.
- Failure taxonomy and mandatory log shape.

## Why a separate mode at all

- Distinct entry point in the UI (dedicated button + shortcut).
- Distinct delay/observer defaults without polluting Next's settings.
- Distinct telemetry bucket so observability can show plan-vs-next health separately (see Step 16).

## Acceptance

- [ ] The implementation satisfies the `01 — Plan Mode Overview` contract in this file and the folder-level acceptance target: PlanLoop renders, queues, edits, and compares against NextLoop without autorun ambiguity.
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

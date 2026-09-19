# 01 — Default Delay

**Date:** 2026-06-02
**Task:** T76

## Default source of truth

Implementations MUST use `DELAY_MS` from [Runtime Defaults](../reference/05-runtime-defaults.md) as the base delay. Settings validation MUST clamp delay input to the `DELAY_MS` range in that same table; prose examples in this file are non-authoritative when they differ from the table.

```ts
const DELAY_DEFAULTS = {
  baseMs: 7000,
  minMs: 5000,
  maxMs: 10000,
} as const;
```

## Why this window

- **< 5s** races common host autosave/streaming finalisers — submit click can land before the previous reply settles.
- **> 10s** wastes user time on simple prompts; perceived latency dominates.
- The configured `DELAY_MS` default is the observed "fully idle" baseline for the reference corpus.

## Where the delay sits

Between iterations: `submit → observer.Idle → delay → next insertText`. It is **not** applied before the first task (see `04-skip-first.md`).

## Validation

Settings UI MUST clamp user input to the `DELAY_MS` range in [Runtime Defaults](../reference/05-runtime-defaults.md) and MUST surface a warning when the value leaves the recommended host-idle window. Below the recommended window risks host throttling; above it degrades UX.

## Acceptance

- [ ] The implementation satisfies the `01 — Default Delay` contract in this file and the folder-level acceptance target: default delay, settings, jitter, skip-first, and pause semantics use runtime defaults.
- [ ] Verification passes when `UT-delay-001..006` passes, and `node scripts/audit/check-acceptance.mjs --root=spec/2026-spec` reports this file has a machine-checkable acceptance contract.

---

<!-- audit: numeric constants source-of-truth -->

Numeric defaults referenced in this file are canonical in [Runtime Defaults](../reference/05-runtime-defaults.md). If a value differs, the SOT wins.

<!-- audit: determinism+pitfalls footer -->

## Determinism (MUST)

- **MUST** bind `DELAY_MS`, `JITTER_MS`, `SKIP_FIRST_DELAY` to `reference/05-runtime-defaults.md`; settings UI MUST clamp to declared min/max.
- **MUST** compute jitter as `DELAY_MS + randInt(-JITTER_MS, +JITTER_MS)` with `Math.random()` seeded by `crypto.getRandomValues` when available.
- **MUST** honour `SKIP_FIRST_DELAY=true` by emitting the first prompt with zero delay; subsequent prompts apply the full delay+jitter.
- **MUST** pause the delay timer when `pauseRequested=true` and resume from the remaining ms — never restart from zero.

## Pitfalls / Counter-examples

- ❌ `setTimeout(fn, DELAY_MS)` with no `clearTimeout` on cancel. ✅ Pair with teardown (see `mem://standards/timer-and-observer-teardown`).
- ❌ Jitter that can produce negative delays. ✅ `Math.max(0, DELAY_MS + jitter)`.
- ❌ Restarting the delay on pause/resume. ✅ Track `remainingMs` at pause; resume schedules `remainingMs`.
- ❌ Hardcoding 1500ms inline. ✅ Import the named constant.
- ❌ Adding exponential backoff on send failure. ✅ Fail fast; surface to user (no-retry policy).

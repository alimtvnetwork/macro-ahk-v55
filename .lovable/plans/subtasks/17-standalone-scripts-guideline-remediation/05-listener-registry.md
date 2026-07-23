---
Slug: listener-registry
Status: pending
Created: 2026-07-17
Parent: 17-standalone-scripts-guideline-remediation
---

# SS-05 — Listener registry (P1-02 + P1-03)

Root cause: 143 `addEventListener` vs 48 `removeEventListener` = 95 net-unbalanced listeners across the codebase. MutationObservers own 7 of those imbalances without `pagehide` teardown, meaning every Chrome tab restore leaks another observer generation.

## Primitives

`standalone-scripts/macro-controller/src/lifecycle/scope-listeners.ts`

- `createListenerScope(name: string): ListenerScope` — returns an object with:
  - `on(target, event, handler, options?)` — registers via `AbortController.signal`.
  - `observe(node, config, callback)` — wraps `MutationObserver`, disconnects on scope teardown.
  - `dispose()` — aborts the controller + disconnects every observer.
  - Auto-registers a `pagehide` handler that calls `dispose()` (unregistered on manual dispose).

## Migration

1. Wire every top-level UI module (`plan-task-ui`, `task-next-ui`, `credit-totals`, `projects-modal`, `ws-list-renderer`, `prompt-dropdown`, `settings-ui`) to one scope owned by that module.
2. Convert the top 20 unbalanced `addEventListener` sites (grep result-ordered) first — that's enough to drop parity to ≤ 100:100.
3. Convert the 7 MutationObserver owners in the same PR to close P1-02 in the same touch.

## Verification

- `scripts/check-timer-teardown.mjs` passes: 0 tracked observers without `pagehide`.
- `check-standalone-baselines.mjs` `mutationObserversMissingPagehide` = 0.
- Manual: open panel, close panel, reopen — `chrome://inspect` heap snapshot shows detached MutationObserver count = 0 after GC (recorded in the PR).

## Non-goals

Not migrating every `addEventListener` in this PR (~123 remaining). Those land in a follow-up cleanup after parity is confirmed working for the top 20.

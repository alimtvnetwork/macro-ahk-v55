# SS-05 timer + observer teardown scan

Parent: 16-standalone-scripts-coding-guideline-audit
Status: pending
Created: 2026-07-27

## Rule

`mem://standards/timer-and-observer-teardown`: every `setInterval`/`setTimeout`/`MutationObserver`/`addEventListener` needs a paired teardown and a `pagehide` shutdown. Tick UIs must pause on `document.hidden`. Reinstall loops must use finite backoff (no unbounded retry — cross-check with No-Retry Policy).

## Grep sweeps

- `rg -n 'setInterval\(' standalone-scripts/**/src`
- `rg -n 'setTimeout\(' standalone-scripts/**/src`
- `rg -n 'new MutationObserver' standalone-scripts/**/src`
- `rg -n "addEventListener\('(pagehide|visibilitychange)'" standalone-scripts/**/src` — count of matches per file; files with timers but zero teardown listeners are automatic P1.

## Output shape

`| file | timersCount | observersCount | listenersCount | teardownCount | hasPagehide | severity | note |`

Automatic severity: `timersCount + observersCount > teardownCount` → P1. No `pagehide` at all in a file that owns timers → P1.

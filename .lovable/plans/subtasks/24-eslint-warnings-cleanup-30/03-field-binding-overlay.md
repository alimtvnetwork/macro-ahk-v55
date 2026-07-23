---
Slug: field-binding-overlay
Parent: 24-eslint-warnings-cleanup-30
Status: pending
Created: 2026-07-19
---

# `src/background/recorder/field-binding-overlay.ts`

Largest offender: `mountFieldBindingOverlay` (266 lines) + `renderColumns` (78).

## Target module split

Move helpers into a sibling folder `field-binding-overlay/`:

```
field-binding-overlay/
  index.ts                (public: mountFieldBindingOverlay)
  build-shell.ts          (buildOverlayShell, mountRoot)
  render-columns.ts       (renderColumns split into renderHeader/renderRows/renderFooter)
  wire-events.ts          (wireDragAndDrop, wireKeyboard, wireResize returns disposer)
  state.ts                (createOverlayState, mutators)
  teardown.ts             (removes listeners, observers, timers via trackedSetInterval registry)
```

## `mountFieldBindingOverlay` shape (target ≤ 30 lines)

```ts
export function mountFieldBindingOverlay(host: HTMLElement, opts: MountOpts): Disposer {
  const state = createOverlayState(opts);
  const shell = buildOverlayShell(host, state);
  renderColumns(shell, state);
  const disposers = [
    wireDragAndDrop(shell, state),
    wireKeyboard(shell, state),
    wireResize(shell, state),
    subscribeStateToRender(state, shell),
  ];
  return () => teardown(shell, disposers);
}
```

## `renderColumns` split

- `renderHeader(shell, state)` — column titles + sort chevrons.
- `renderRows(shell, state)` — row virtualization loop.
- `renderFooter(shell, state)` — bulk actions + counts.

Each < 40 lines. `renderColumns` becomes a 6-line orchestrator.

## Teardown contract (mandatory)

Follow `mem://standards/timer-and-observer-teardown`: every listener, MutationObserver, and `trackedSetInterval` acquired in wire-* helpers MUST be returned as a disposer and invoked in `teardown()`. Add a leak test mirroring `macro-ui-mount-unmount-leaks.test.ts` under `src/background/recorder/__tests__/field-binding-overlay-leaks.test.ts` (5+ mount/unmount cycles).

---
Slug: step-group-library-panel-body-decompose
Parent: 24-eslint-warnings-cleanup-30
Status: pending
Created: 2026-07-19
---

# SS-04a. Decompose the 1174-line `StepGroupLibraryPanel` render body

## Context

Plan 24 Step 3 landed the low-risk portion: the three siblings
(`StepRowItem` 160 lines, `TreeNodeRow` 226 lines, `EmptyTreeState`) plus the
duplicate `"Select a group first"` literal are now under
`src/components/options/step-group-library/`. That cleared 3 of the 5
warnings on this file:

Before (v4.193.0):
```
  173:16  max-lines-per-function     Function 'StepGroupLibraryPanel' 1174 lines
  173:25  sonarjs/cognitive-complexity  18 > 15
  1239:63 sonarjs/no-duplicate-string   "Select a group first" x4
  1635:1  max-lines-per-function     Function 'StepRowItem' 160 lines
  1807:1  max-lines-per-function     Function 'TreeNodeRow' 226 lines
```

After (v4.194.0):
```
  178:16  max-lines-per-function     Function 'StepGroupLibraryPanel' 1174 lines
  178:25  sonarjs/cognitive-complexity  18 > 15
```

The remaining two warnings both live on the main component body which is
1174 lines because it owns ~25 useState hooks, ~15 handlers, and a giant
JSX tree covering toolbar / tree pane / step preview pane / all dialogs.
Cognitive complexity 18 traces to nested conditional rendering of dialogs
against `activeGroup`.

## Root cause

Single component holds toolbar UI, two pane bodies, plus every modal.
Decomposition requires moving state ownership, not just JSX slicing.

## Target decomposition

Under `src/components/options/step-group-library/`:

1. `useStepGroupLibraryState.ts` — custom hook owning all `useState`s,
   `useEffect`s, `useMemo`s and persisted state. Returns a typed
   view-model with `handlers` and `derived` sub-records.
2. `LibraryToolbar.tsx` — top toolbar (project chip, batch buttons,
   import/export).
3. `LibraryTreePane.tsx` — left pane (search, filter, tree list,
   EmptyTreeState wiring).
4. `LibraryStepPane.tsx` — right pane (active group header, step list,
   dialog-open buttons — this is where the four `SELECT_GROUP_FIRST_TOOLTIP`
   usages live).
5. `LibraryDialogs.tsx` — bundle of AlertDialog / Dialog / Csv / Wait /
   Webhook / InputSource dialogs, wired to the hook.
6. `StepGroupLibraryPanel.tsx` shrinks to <80 lines: instantiate the
   hook, render toolbar + two panes + dialogs, mount `Toaster`.

## Acceptance

- `npx eslint src/components/options/StepGroupLibraryPanel.tsx` returns
  0 warnings.
- No behavioural change: existing E2E / unit / component tests remain
  green.
- P0-10 double-cast ≤ 71, `noUncheckedIndexedAccess` unchanged.

## Time estimate

3-4 hours (state-ownership move is the tricky bit; JSX split is
mechanical).

## Followups after SS-04a lands

- Plan 24 Step 3 can be marked complete.
- Move to Step 4 (StepGroupListPanel 766 lines) per SS-04 rebinding.

# Plan 10 Step 1 — Vitest `act(...)` warning inventory

Parent: 32-plan-10
Slug: 01-vitest-inventory
Status: completed
Created: 2026-07-20

## Baseline

- Command: `pnpm test --reporter=verbose 2>&1 | tee /tmp/vitest-full.log`
- Exit code: 0 (all suites pass functionally)
- Hard failures: 0
- `not wrapped in act(...)` warnings: **54**

## Warnings by component (source of the setState)

| Count | Component (updater) | Category |
|-------|---------------------|----------|
| 12 | `SessionCopyButton` | async-mount (clipboard capability probe) |
| 9  | `DiagnosticsPanel` | async-mount (status/health fetch) |
| 8  | `PopupFooter` | async-mount (version/env probe) |
| 8  | `InjectionCopyButton` | async-mount (clipboard capability probe) |
| 6  | `BootFailureBanner` | async-mount (boot-trail hydrate) |
| 4  | `ProjectsSection` | async-mount (project list load) |
| 3  | `ErrorDrawer` | async-mount + subscription |
| 2  | `KeywordEventsEditor` | prop-change setState |
| 1  | `RecorderControlBar` | async-mount |
| 1  | `FloatingControllerHost` | async-mount |

## Offending test files (7)

1. `src/components/popup/__tests__/BootFailureBanner.report.test.tsx` — BootFailureBanner mount effect.
2. `src/components/recorder/__tests__/KeywordEventsPanel.selection.test.tsx` — KeywordEventsEditor + FloatingControllerHost + RecorderControlBar.
3. `src/options/sections/DiagnosticsPanel.test.tsx` — DiagnosticsPanel status/health effect (uses `waitFor` but initial render assertion trips).
4. `src/options/sections/ProjectEditor.test.tsx` — ErrorDrawer + BootFailureBanner (indirect).
5. `src/options/sections/ProjectsSection.test.tsx` — ProjectsSection async load.
6. `src/pages/__tests__/Popup.test.tsx` — SessionCopyButton, PopupFooter, InjectionCopyButton, BootFailureBanner (all four probe effects, dominant contributor: ~30 of 54 warnings).
7. `src/test/snapshots/Options.snapshot.test.tsx` — same set as Popup + ProjectsSection.

## Root-cause categories

- **A. async-mount effect (dominant)**: component runs an async probe (clipboard, boot trail, project list, version fetch) in `useEffect`; a synchronous test assertion runs before the microtask that flips `setState` resolves. Fix pattern: `await flushEffects()` before assertions (already applied in `Popup.snapshot.test.tsx`).
- **B. prop-change setState**: parent test rerenders with new props, triggering internal `useEffect` that flips state without an `act` wrap. Fix: wrap `rerender` in `await act(async () => view.rerender(...))`.
- **C. real-timer waits**: `await new Promise(r => setTimeout(r, N))` outside `act(...)` (patched in `LiveRecordedActionsTree.scroll.test.tsx` this session).

## Plan 10 Step 3 target list (in priority order)

1. `Popup.test.tsx` (~30 warnings resolved via `flushEffects`)
2. `Options.snapshot.test.tsx` (same helpers)
3. `DiagnosticsPanel.test.tsx` (convert first two sync assertions to `waitFor`)
4. `ProjectsSection.test.tsx`
5. `ProjectEditor.test.tsx`
6. `KeywordEventsPanel.selection.test.tsx`
7. `BootFailureBanner.report.test.tsx`

## Verification signal after Step 3+4

`grep -c "not wrapped in act" /tmp/vitest-full.log` must return **0**.
Current: 54.

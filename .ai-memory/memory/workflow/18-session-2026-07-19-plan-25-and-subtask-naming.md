---
name: Session 2026-07-19 - Plan 25 Steps 39-48 + subtask naming policy
description: Modularization batch (bulk-actions, message-relay, prompt-injector, use-draggable, recorder/session hooks, step-group hooks, step-group-export) plus sequence-first subtask filename policy and CI enforcement.
type: feature
---

## Shipped

- **v4.239.0** - decomposed `computeSequencePreview` in `src/lib/keyword-event-bulk-actions.ts` and `forwardToBackground` in `src/content-scripts/message-relay.ts`.
- **v4.240.0** - decomposed `appendToEditor` (prompt-injector) and `useDraggable` hook (extracted `useResizeReclamp`, `usePointerDragHandlers`, `clearStoredPosition`).
- **v4.241.0** - `useRecorderProjectData` split into transport helpers + `EMPTY_DATA`; `useRecordingSession` split into `useSessionSubscription`, `dispatchAction`, `startSession`.
- **v4.242.0** - `useShiftClickSelection` + `buildDeletePreview` decomposed (`indexGroups`, `hasSelectedAncestor`, `countSubtree`).
- **v4.242.0 hotfix** - `standalone-scripts/macro-controller/src/ui/prompt-io.ts` fixed TS2339 (`rows`->`.value`, `slug`->`.Slug`). Changelog heading normalized to `## [v4.242.0] - YYYY-MM-DD <title>` (em dash removed).
- **v4.243.0** - `useStepGroupExport` decomposed (`triggerZipDownload`, `isLibraryReady`, `useExportDialogState`, `useRequestExport`, `useConfirmExport`).
- **v4.244.0** - P0-10 double-cast regression cleared (70 vs baseline 71): removed `as unknown as number[]` in `next-inline-ui.ts` via tuple spread; extended `WorkspaceMember` with optional `id?`/`name?`; dropped legacy casts in `ws-members-aggregate.ts`.

## Policy shift: subtask filenames

- **Before:** `.lovable/plans/subtasks/NN-slug/ss-XX-*.md` (double-prefix; `SS-` variants also seen).
- **After:** `.lovable/plans/subtasks/NN-slug/XX-*.md` (sequence-first, lowercase kebab-case; `NN[a]-` letter suffix allowed for splits, e.g. `04a-*.md`).
- **Rationale:** `SS-` uppercase tripped the release workflow lowercase-`.md` guard; double prefix was redundant with the parent folder's `NN-slug`.
- **Migration:** renamed 39 files across plan subtask folders. Updated `.lovable/memory/workflow/plan-mode-convention.md`, `.lovable/prompts/13-plan-steps-v7.md`, `.lovable/plans/README.md`, `.lovable/README.md`, and CI guard in `.github/workflows/release.yml` to reject `ss-`/`SS-` under `subtasks/`.
- **Legacy references** in `changelog.md` (v4.220.0 entries) were left as historical strings; new work MUST use sequence-first paths.

## Regression-guard reminders

- P0-10 baseline is **71**. Any new double-cast trips the audit; fix at the type source (extend interface, spread tuples) rather than adding suppressions.
- Version pins across `standalone-scripts/*` must move together: run `scripts/update-stale-version-refs.mjs <old> <new>` after any bump, then `scripts/check-version-sync.mjs`.
- Changelog headings for every release MUST match `## [vX.Y.Z] - YYYY-MM-DD <short title>` (hyphen, not em dash). CI script: `scripts/check-changelog-entry.mjs`.

## What the next AI needs to know first

1. Sequence-first subtask naming is now enforced by CI - never reintroduce `ss-`/`SS-`.
2. Em dashes are banned in all output (chat, code comments, changelog, docs); use hyphens or colons.
3. Plan 25 remaining scope: ~13 items (further `max-lines-per-function` / `cognitive-complexity` offenders in `src/hooks/`, `src/lib/step-library/`, `src/content-scripts/`). Continue the extract-helpers pattern used in v4.239-v4.244.

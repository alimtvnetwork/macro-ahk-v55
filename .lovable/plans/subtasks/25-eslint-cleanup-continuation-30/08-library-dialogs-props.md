# SS-08 — Collapse LibraryDialogs prop surface into grouped bags

Slug: ss-08-library-dialogs-props
Status: pending
Created: 2026-07-19
Parent: 25-eslint-cleanup-continuation-30

## Goal

Reduce the prop count on `LibraryDialogs` (introduced during Plan 24 SS-06) from a flat wide surface to 3-4 grouped bags so downstream refactors do not re-trip `max-lines-per-function` on the render call site.

## Actions

1. Read `src/options/sections/step-group-library/LibraryDialogs.tsx` (or nearest current path — confirm via `rg -l LibraryDialogs src`).
2. Group the flat prop list into cohesive bags:
   - `deleteDialog: { open, onOpenChange, target, onConfirm }`
   - `renameDialog: { open, onOpenChange, target, onConfirm }`
   - `importDialog: { open, onOpenChange, onImport, progress }`
   - `exportDialog: { open, onOpenChange, selected, onExport }`
   (Exact bag names follow whatever dialogs are wired at the current call site.)
3. Update the parent (`StepGroupLibraryPanel.tsx` and/or `LibraryTwoPaneBody.tsx`) to construct the bags via `useMemo` so identity is stable.
4. Derive bag types from the child dialog components via `ComponentProps<typeof DeleteDialog>` etc. — no `any`, no double-casts.
5. Confirm `npx tsgo --noEmit` stays green.
6. Confirm ESLint no longer flags `LibraryDialogs` for `max-lines-per-function` or `max-params`.

## Verification

- Prop count on `LibraryDialogs` drops to <=5 top-level props.
- No new `any`, `as unknown as`, or `// @ts-expect-error` introduced.
- Snapshot tests (if any) for the library panel still pass unchanged, or updated deliberately with a note in the changelog.

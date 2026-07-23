# SS-10 — Decompose #1 max-lines-per-function offender

Slug: ss-10-offender-1
Status: pending
Created: 2026-07-19
Parent: 25-eslint-cleanup-continuation-30

## Goal

Bring the single largest `max-lines-per-function` offender in `.lovable/audits/eslint-baseline-25.md` under the limit using the SS-04..SS-09 recipe.

## Recipe (reused for SS-11..SS-24)

1. Read the offender file end-to-end; name the exact function, start line, end line, and the ESLint reported length.
2. Extract state + effects + callbacks into a `use-<name>-controller.ts` sibling hook. Callers receive a single controller object.
3. Split the render tree into leaf components under a sibling folder. Each leaf owns one visual region (header, body, row, footer, dialogs).
4. Derive leaf prop types from the leaf itself via `ComponentProps<typeof Leaf>` — never define parallel prop interfaces on the host.
5. Host file must end up <120 lines total, with its default-exported render function <60 lines.
6. Run `npx tsgo --noEmit` after the change — 0 diagnostics.
7. Run `npx eslint <file>` — 0 warnings for that file.
8. If the offender is covered by an existing test, keep the test green without modifying assertions; if not, add a minimal render smoke test alongside the new leaf folder.

## Verification

- File appears in baseline-25 but is absent from a fresh `eslint <file>` run after the change.
- No new double-casts introduced; `grep -c "as unknown as" <file>` stays 0.
- Line-count drop recorded in the Step's release note bullet.

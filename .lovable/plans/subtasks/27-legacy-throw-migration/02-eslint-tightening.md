# SS-02 — ESLint tightening for `no-restricted-syntax`

Slug: eslint-tightening
Parent: 27-legacy-throw-migration
Status: pending
Created: 2026-07-19

## Purpose

Once every PROD file is migrated (Plan 27 steps 4–13), the `no-restricted-syntax` rule in `eslint.config.js` must widen from the current per-directory allowlist to a repo-wide ban with a small, explicitly documented exemption glob.

## Current state (as of v4.265.0)

`eslint.config.js` bans bare `throw new Error(...)` only in the directories that have already been migrated (see the `files:` glob in the relevant override). Everything else falls back to the default rule, which permits bare throws.

## Target state

- One override for `standalone-scripts/macro-controller/src/**/*.ts` that forbids `ThrowStatement > NewExpression[callee.name="Error"]`.
- One narrower override (`files: [...exemptions]`) that RE-permits it, listing exactly:
  - `**/errors/diagnostic-error.ts` (the taxonomy itself constructs `Error` subclasses).
  - `**/errors/format.ts` (formatting helpers that intentionally re-throw during self-tests).
  - `**/__tests__/**/*.ts` where the throw is annotated with `// eslint-disable-next-line ... -- intentional: simulates upstream failure`.
- The rule's `message` field should point at `.lovable/spec/commands/04-professional-diagnostic-error-messages.md`.

## Verification

- `bun run lint` (or the project's equivalent) reports zero violations on a clean tree.
- Manually re-introduce a `throw new Error('x')` into a migrated PROD file, run lint, confirm it fails with the diagnostic message pointing to the contract file, then revert.

## Do NOT

- Do not widen the exemption glob beyond the two named files + annotated test lines.
- Do not add a project-wide `eslint-disable` in any migrated file. If a throw is truly unavoidable, add it to the exemption glob explicitly with a written justification.

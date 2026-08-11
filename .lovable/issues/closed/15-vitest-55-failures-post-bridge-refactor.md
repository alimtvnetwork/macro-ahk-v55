# 15 - vitest: 55 failures across 6 files after sql-bridge + defaults-protection refactors

User request (verbatim):

> Refactor prompt-dropdown-io state building so the entries field is always present and validated, and add a small type-level test for it. Add a type-safe adapter for sql-bridge callback responses in database-json-migrate to prevent TS2345 mismatches from reappearing. You have to fix all these unit tests. First, make a plan where to fix it, how to fix it, make detailed plan and fix it, okay? So that the CI/CD does not remain broken, okay?

## Failing suites

1. `__tests__/regression-baseline.test.ts` @behavior-lock: `substituteToken('run {{n}}', 'steps', 42)` must return `'run {{n}}'`. Broken by the belt-and-suspenders residual-`{{n}}` guard in `utils/token-substitute.ts`.
2. `db/__tests__/migrate-legacy-read-memory.test.ts` (2 timeouts): test mocks `../../ui/prompt-loader`, but `db/migrate-legacy-read-memory.ts` now reaches the backend via `db/sql-bridge.ts` -> `db/extension-bridge.ts`. Real `sendToExtension` never resolves in vitest, so both cases time out at 5s.
3. `ui/__tests__/prompt-io-db-bridge.test.ts` (2 failures) + `prompt-io-db-bridge-replace-fields.test.ts` (1 failure): fixtures seed `plan-default` with `IsDefault: 1`, which the v4.400.0 defaults-protection short-circuits with `defaultsProtected += 1` before ever calling `upsertPrompt`. Tests still assert `upserted === 1` / an error surfaces.
4. `ui/__tests__/prompt-io-db-bridge-negatives.test.ts`: `expect(result).toEqual({ upserted: 0, errors: [] })` no longer matches; the returned shape now includes `defaultsProtected: 0`.
5. Unhandled `ReferenceError: window is not defined` from `ui/repeat-loop-ui.ts` teardown in `panel-builder.test.ts`. The tracked-interval fires after the vitest happy-dom env is torn down.

## Plan

A. `utils/token-substitute.ts`: delete the residual `{{n}}` force-substitute block. The behavior-lock test is the source of truth: an unrelated caller key must not touch `{{n}}`.

B. `db/__tests__/migrate-legacy-read-memory.test.ts`: mock `../extension-bridge` (the module `sql-bridge` actually imports) instead of `../../ui/prompt-loader`. Drop the now-unused `buildPromptLoaderMock` import.

C. `ui/__tests__/prompt-io-db-bridge*.test.ts`: change fixture rows expected to be updated from `IsDefault: 1` -> `IsDefault: 0` so `commitOneEntry` proceeds to `upsertPrompt`. Adjust the `collectDbEntriesForExport` assertion (`plan.isDefault`) accordingly. Extend the empty-list expectation to include `defaultsProtected: 0`.

D. `ui/repeat-loop-ui.ts`: guard `window.addEventListener` + `window.removeEventListener` with `typeof window !== 'undefined'` so an interval firing after teardown cannot throw.

E. Refactor `ui/prompt-dropdown-io.ts`: introduce an exported `UserAddedEntriesState` interface plus a `validateUserAddedEntriesState` normalizer so `entries` is always a defined array. Add a small type-level vitest (`prompt-dropdown-io-state.test.ts`) with an `@ts-expect-error` width check.

F. Add a `schemaResp(onOk, onErr)` adapter in `ui/database-json-migrate.ts` that types the `.then` argument as `SqlBridgeResp` once. Route the three addColumn / dropColumn / renameColumn call sites through it so a future drift back to `ExtensionCallbackResponse` cannot compile.

## DoD

- `bunx vitest run` (or CI `npm run test:quiet`) exits 0 for these 6 files.
- `npx tsc --noEmit -p tsconfig.macro.build.json` still exits 0.
- `npx eslint standalone-scripts --max-warnings=0` stays green.
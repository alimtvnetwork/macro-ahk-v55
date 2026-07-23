## Goal

Green all three CI gates: `eslint --max-warnings=0` on standalone-scripts, `check-madge-cycles --strict`, `audit-p0-rules --strict` (P0-09 cycles regressed to 2, baseline 0).

## Fixes

### 1. ESLint errors (36)

- `**src/ui/async-guard.ts**` (23 `el` denylist hits): rename param `el` → `element` throughout `markBusy`, `guardAsyncClick`, `isBusy`. Pure rename, no behavior change.
- `**src/db/sql-bridge.ts**` (12 hits):
  - `recordRejection`: `arr` → `history`.
  - `isContractError(msg)`: `msg` → `message` (also rename the `resetSqlBridgeCache` shadow var in loops — none here, just the param).
  - `runWithBridgeRetry`: rename param `fn` → `operation`; local `msg` → `message`.
- `**src/db/__tests__/prompt-load-plan-post-seed-list.e2e.test.ts:103**`: `(getSqlBridgeState as unknown);` unused-expression. Delete the no-op line (the comment says "no-op ref" — it's dead). The `resetSqlBridgeCache('SELECT')` call on the next line already covers the intent.

### 2. ESLint warnings (6, all pre-existing but blocking `--max-warnings=0`)

- `**chip-gear-picker.ts` `pickPromptFromRole**` (71 lines / cog-complexity 22): extract three helpers within the same file — `attemptInitialLoad(opts)` (initial list + contract retry, returns `{ res, initialReason }`), `attemptAutoSeed(opts, res)` (managed-role seed branch, returns `{ res, stage, seedReason, seedAttempted }`), `handleLoadFailure(...)` (second-chance rebuild + diagnostic toast). Main body becomes a linear ~15-line orchestrator.
- `**panel-layout.ts:427` `toggleMinimize**` (cog-complexity 21): extract `runMinimizeTransition(ctx, isExpanded)` (the try-block body) and `rollbackMinimize(ctx, snapshot, isExpanded, err)` (the catch body). Outer function stays as snapshot + try/catch shell.
- `**database-json-migrate.ts:189**`: remove the now-unused `eslint-disable-next-line max-lines-per-function` directive.
- `**prompt-dropdown-io.ts:256` (identical to line 131)**: `buildImportExportButton` duplicates `buildExportButton`'s popover-toggle handler. Extract shared `attachPopoverToggle(target, popoverSelector, buildPopover)` helper and call it from both.
- `**seed-diagnostics-panel.ts:179**` (`'(not yet accepted)'` x4): hoist to module-level `const NOT_ACCEPTED = '(not yet accepted)';`.

### 3. Madge cycles / P0-09 (2 → 0)

Both cycles route through `db/sql-bridge.ts → ui/prompt-loader.ts`. Break the edge by introducing `src/db/extension-bridge.ts`:

```ts
// Thin re-export so db/* never imports ui/*. Tests mock this path directly.
export { sendToExtension } from '../ui/extension-relay';
```

- Update `db/sql-bridge.ts` import to `./extension-bridge`.
- Update `src/db/__tests__/sql-bridge.test.ts` mock target from `../../ui/prompt-loader` to `../extension-bridge`.
- Re-check with `madge --circular --extensions ts src` — expect 0 cycles.

Other test files that mock `prompt-loader` do not use `sql-bridge` transitively for the message they intercept (they stub high-level `loadPromptsFromJson`, `sendToExtension` for direct prompt-loader calls, etc.), so they keep working. If any test relied on mocking `prompt-loader` to intercept bridge traffic specifically, its mock is switched to `db/extension-bridge` in the same edit.

## Verification

```
npx eslint standalone-scripts --max-warnings=0 --format=stylish
node scripts/check-madge-cycles.mjs --strict
node scripts/audit-p0-rules.mjs --strict
npx vitest run standalone-scripts/macro-controller/src/db/__tests__/sql-bridge.test.ts \
  standalone-scripts/macro-controller/src/db/__tests__/prompt-load-plan-post-seed-list.e2e.test.ts \
  standalone-scripts/macro-controller/src/ui/__tests__/async-guard.test.ts
npx tsgo -p tsconfig.macro-controller.json
```

All three CI gates should exit 0; targeted vitest suites stay green; typecheck clean.  
  
Make a release at the end

## Out of scope

Pre-existing 7 unrelated vitest failures (transitive `sql-bridge` mock gaps in other suites), workspace-move v2 PENDING-VERIFY, plans 13/22/23/24/25/29/31. Untouched this turn.
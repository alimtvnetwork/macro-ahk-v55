# Marco — Standalone Macro Controller

**Author**: Marco Automation Team
**Version**: 7.41
**Status**: TypeScript migration in progress (Step 1 complete)

## What This Script Does

The MacroLoop Controller automates workspace and credit management on Lovable.dev.
It injects a floating UI panel into the browser that provides:

- **Loop automation**: Cycles through workspaces with configurable intervals
- **Credit monitoring**: Real-time credit balance tracking with visual bar
- **Prompt management**: Save, load, and inject prompts into the chat
- **Workspace navigation**: Automated project switching (up/down direction)
- **Diagnostic tools**: Logging, CSV export, clipboard copy

## Files

| File | Purpose |
|------|---------|
| `01-macro-looping.js` | Original JS source (reference, 9113 lines) |
| `src/macro-looping.ts` | TypeScript migration (Step 1: @ts-nocheck copy) |
| `src/index.ts` | Build entry point |
| `src/types.ts` | Extracted TypeScript interfaces |
| `02-macro-controller-config.json` | Default JSON config (XPaths, timing, element IDs) |
| `03-macro-prompts.json` | Prompt chains for macro automation |
| `04-macro-theme.json` | Theme configuration (dark/light presets) |
| `dist/macro-looping.js` | Compiled IIFE output (injected into browser) |

## Build

```bash
# From repository root
npm run build:macro
```

This compiles `src/` → `dist/macro-looping.js` (single IIFE bundle with inline source maps).

## How It's Used

- The **Chrome Extension** seeds the compiled `dist/macro-looping.js` into `chrome.storage.local`
- The injected script reads config from `window.__MARCO_CONFIG__` and theme from `window.__MARCO_THEME__`
- Communication with the extension uses the Content Script Bridge

## API — Namespace (v1.71.0+)

All public APIs live on the structured SDK namespace. Access via:

```
RiseupAsiaMacroExt.Projects.MacroController
```

### Console API (`api.loop`)

```js
const mc = RiseupAsiaMacroExt.Projects.MacroController.api;

mc.loop.start('up')        // Start macro loop (up direction)
mc.loop.start('down')      // Start macro loop (down direction)
mc.loop.stop()             // Stop loop
mc.loop.check()            // One-shot credit check
mc.loop.diagnostics()      // Diagnostic dump
mc.loop.setInterval(30000) // Set loop interval (ms)
mc.loop.isRunning()        // Check if loop is active
```

### Credits (`api.credits`)

```js
mc.credits.fetch()         // Fetch credit balance
mc.credits.getState()      // Get current credit state object
```

### Auth (`api.auth`)

```js
mc.auth.getToken()         // Get current bearer token
mc.auth.refreshToken(cb)   // Force token refresh with callback
mc.auth.verifySession()    // Verify session validity
```

### Workspace (`api.workspace`)

```js
mc.workspace.detect()            // Detect current workspace
mc.workspace.moveAdjacent('up')  // Navigate to adjacent workspace
mc.workspace.getCurrentName()    // Get current workspace name
mc.workspace.bulkRename(...)     // Bulk rename workspaces
```

### UI (`api.ui`)

```js
mc.ui.create()             // Create the floating panel
mc.ui.delete()             // Remove the floating panel
mc.ui.update()             // Refresh panel state
```

### Config (`api.config`)

```js
mc.config.exportBundle()   // Export config bundle (internal)
```

### Auto Attach (`api.autoAttach`)

```js
mc.autoAttach.run()        // Run auto-attach groups
```

### Metadata (`meta`)

```js
RiseupAsiaMacroExt.Projects.MacroController.meta.version       // e.g. "7.41"
RiseupAsiaMacroExt.Projects.MacroController.meta.displayName   // "Macro Controller"
```

### Singleton Class

```js
window.MacroController     // MacroController singleton (kept on window as a proper class name)
```

> **Note**: Legacy `window.__loop*` globals were removed in v1.71.0 (Issue 79, Phase 9D).
> See `spec/22-app-issues/79-migrate-window-globals-to-namespace.md` for migration details.

## TypeScript Migration

See [Migration Spec](../../spec/21-app/02-features/macro-controller/js-to-ts-migration/readme.md) for the full migration plan.

| Step | Description | Status |
|------|-------------|--------|
| 01 | Copy JS into single TS file | ✅ Complete |
| 02 | Split functions into individual files | 🟡 In Progress (3 modules extracted, IIFE-coupled functions deferred) |
| 03 | Extract UI logic into ui/ folder | ✅ Partially Complete (12 ui/ modules) |

## Related Specs

| Spec | Topic |
|------|-------|
| [40 — Macro Looping Reference](../../spec/21-app/02-features/chrome-extension/40-macro-looping-script-complete-reference.md) | Script internals |
| [42 — Data Bridge](../../spec/21-app/02-features/chrome-extension/42-user-script-logging-and-data-bridge.md) | `window.marco` SDK |
| [48 — TS Migration](../../spec/22-app-issues/48-typescript-migration-standalone-scripts.md) | Migration spec |
| [79 — Namespace Migration](../../spec/22-app-issues/79-migrate-window-globals-to-namespace.md) | `window.__*` → namespace |
| [80 — Auth Bridge Fix](../../spec/22-app-issues/80-auth-token-bridge-null-on-preview.md) | Token resolution hardening |

## Bumping the prompts-bundle schema

Prompts Import/Export (plan 12) uses a single envelope version pinned in one place:

- **Source of truth:** `schemas/prompts-export-bundle.schema.json` → `properties.schemaVersion.const`.
- **Runtime consumer:** `standalone-scripts/macro-controller/src/ui/prompt-bundle-types.ts` exports `PROMPTS_BUNDLE_SCHEMA_VERSION` and `validatePromptsBundle()` compares against it (never against a literal).
- **Build-time gate:** `scripts/validate-bundle-schema.mjs` reads `properties.schemaVersion.const` directly from the schema and rejects any fixture whose `schemaVersion` disagrees.

To bump the envelope (breaking change only):

1. Edit `schemas/prompts-export-bundle.schema.json`: change `properties.schemaVersion.const` to the new integer.
2. Update `PROMPTS_BUNDLE_SCHEMA_VERSION` in `src/ui/prompt-bundle-types.ts` to match.
3. Add or update fixtures under `test/fixtures/prompt-bundles/`. Every `valid-*` and `runtime-invalid-*` fixture MUST carry the new version.
4. Add a migration path in `src/ui/prompt-io.ts` for reading old-version bundles (or explicitly reject them with an error surfaced through the import modal).
5. Run `node scripts/validate-bundle-schema.mjs` and `bunx vitest run` in `standalone-scripts/macro-controller/`. Both must pass before commit.

Bumping the extension version does NOT require bumping the bundle schema. The two are independent.

## Per-project chat submission history (Plan 13)

Chat submissions are persisted with a **split storage** model to keep the SQLite DB lean while still allowing full-fidelity export.

- **Metadata rows (SQLite).** `db/project-chat-submit-db.ts` writes one row per submission with `Id`, `ProjectId`, `ProjectName`, `Source`, `FileId`, `CharCount`, `CreatedAt`, `MetaJson`. The 300-row per-project cap and rename backfills live here.
- **Body blobs (OPFS).** `storage/chat-submit-opfs-store.ts` writes the raw submission text to Origin Private File System at:

  ```text
  chat-submits/<projectId>/<fileId>.txt
  ```

  where `<fileId>` is a `crypto.randomUUID()` (or `Date.now()-random` fallback) stored on the SQLite row's `FileId` column. Bodies are UTF-8 `.txt` files.

- **Read.** `readEntry(projectId, fileId)` returns the body string or `null` when the blob is missing or OPFS is unavailable. `chat-submit-history.getProjectHistory` swallows nothing: any read failure routes through `logError('ChatSubmitHistory', ...)` and the row is still returned with `body: null`.
- **Delete.** `deleteHistoryEntry(projectId, id, fileId)` deletes the OPFS blob FIRST, then the SQLite row. Blob-first ordering guarantees no orphaned bytes on disk (rows can be re-linked by `FileId`; orphan blobs cannot).
- **Export.** `exportProjectHistoryAsJson(projectId)` returns a `HistoryExport` envelope with `schemaVersion: 1`, `projectId`, `exportedAt`, `entryCount`, and hydrated `entries[]` (body inlined). The Project History Panel serialises this via `JSON.stringify(..., 2)` and hands it to the injected `triggerDownload`.

### UI entry points

- **Chat History modal** (menu): `ui/chat-history-modal.ts` — overlay view wired into the extension menu via `showChatHistoryModal()`.
- **Project History Panel** (embeddable): `ui/project-history-panel.ts` exposes `openProjectHistoryPanel(mount, projectId, options?)` for inline mounts (settings tab, options page). Both views share the same headless service — never touch SQLite or OPFS directly from UI code.

### Verification

- Unit tests: `src/ui/__tests__/project-history-panel.test.ts` (dep-injected).
- Integration test: `src/ui/__tests__/project-history-panel.integration.test.ts` mocks only the two storage modules and exercises the real `chat-submit-history` service through the panel (load, export, delete + refresh).


## Diagnostic error codes (Plan 26)

Every error thrown from `src/` is a `DiagnosticError` (see
`src/errors/diagnostic-error.ts`) carrying a code, a `context` object, and an
optional `cause`. Bare `throw new Error(...)` is banned by ESLint inside
`src/` (see `eslint.config.js`, rule `no-restricted-syntax`), with a small
allowlist for legacy files scheduled for Plan 27.

Sources of truth:

- `src/errors/error-codes.ts`: frozen registry, one entry per code, with
  `humanTemplate`, `requiredContextKeys`, `severity`, and `nextFixHint`.
- `src/errors/diagnostic-error.ts`: throws `DiagnosticMetaError` if a required
  context key is missing at throw time, so codes cannot silently degrade to
  "undefined" toasts.
- `src/errors/format.ts`: `formatDiagnosticToast(code, ctx)` returns
  `{ title, body, footerCode }` used by every toast surface.

CI checks (all wired in `.github/workflows/ci.yml`):

- `scripts/check-error-codes-unique.mjs`: registry keys unique, codes match
  `<AREA>_<VERB>_E<NNN>`, every `{placeholder}` in a template is declared in
  `requiredContextKeys`.
- `src/errors/__tests__/error-codes-registry.test.ts`: 486 runtime assertions
  including frozen-object invariants and round-trip interpolation.
- `src/errors/__tests__/per-area-migration-coverage.test.ts`: proves the 13
  migrated modules only reference registered codes from their allowed areas,
  and every registered code has a live emitter (or is listed in
  `INTENTIONALLY_UNEMITTED` with a reason).

The full code table (52 codes, 10 areas) is published in the root
[`readme.md`](../../readme.md#diagnostic-error-codes-plan-26). When adding a
new code:

1. Append the entry to `ERROR_CODES` (never renumber, never mutate).
2. Add or update the emitter; the CI check will fail if the code is not
   referenced anywhere or is emitted from a file outside its area.
3. Bump the MINOR version and add a changelog entry summarising the new code.

### Logger method contract (`logDiagnostic` / `logDiagnosticFromCode`)

Both helpers route through `window.RiseupAsiaMacroExt.Logger`. The guard in
`src/error-utils.ts` (`isSdkLogger`) accepts a Logger value if, and only if,
it is a non-null object exposing **both** required methods as callable
functions. Missing helpers fall back per call site; a missing required method
falls back to `console.error` + `console.log` (never silently swallowed).

Required (guarded, both must be `typeof === 'function'`):

| Method    | Signature                                                                    | Called by                                    |
| --------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| `error`   | `(scope: string, message: string, error?: unknown) => void`                  | `logError`, `logDiagnostic` (human line)     |
| `console` | `(scope: string, tag: string, payload: RiseupAsiaLogArg) => void`            | `logConsole`, `logDiagnostic` (`'diagnostic-report'` record) |

Optional (probed per call site, may be omitted):

| Method       | Signature                                                       | Called by        |
| ------------ | --------------------------------------------------------------- | ---------------- |
| `warn`       | `(scope: string, message: string) => void`                      | `logWarn`        |
| `debug`      | `(scope: string, message: string) => void`                      | `logDebug`       |
| `stackTrace` | `(scope: string, message: string, error?: unknown) => void`     | `logStackTrace`  |
| `info`       | `(scope: string, message: string) => void`                      | reserved         |

Rejected shapes (all fall back to `console.error` + `console.log`): `null`,
`undefined`, non-objects, arrays, plain `{}`, any logger missing `error` or
`console`, any logger where either required method is not a function. Extra
unknown methods (forward-compat additions like `metric`, `trace`) are
accepted and ignored. Pinned by
`src/errors/__tests__/log-diagnostic-logger-shapes.test.ts` (19 cases).


## Prompt Ordering

Built-in prompts render in a fixed canonical sequence defined by
`DEFAULT_PROMPT_ORDER` in `src/ui/prompt-drag-order.ts`. Users can
drag rows to override that ordering; overrides are persisted to
`localStorage` under the key `marco.promptOrder.v2`. When no override
exists, the canonical default is used.

### Canonical order (locked)

The first block holds the general-purpose prompts. The **terminal 7**
tail is contractually locked and must appear in this exact sequence,
with `release` always last:

1. `unified-ai-prompt-v4`
2. `issues-tracking`
3. `minor-bump`
4. `major-bump`
5. `patch-bump`
6. `code-coverage-basic`
7. `code-coverage-details`
8. `next-steps`
9. `plan-steps`
10. `unit-test-issues-v2-enhanced`
11. `logo-create`
12. `lowercase-readme-and-sequence`
13. `pending-tasks`
14. `jokes-ideas-generate`
15. `improve-spec-from-audit`
16. `improve-recent-work-from-audit`
17. `recent-work-audit`
18. `folder-structure`
19. `ambiguity-handling`
20. `question-explain`
21. `visual-design-proposal`
22. `coding-guidelines`

Terminal 7 (locked tail, in order):

23. `proofread`
24. `conversation-log`
25. `app-spec-audit`
26. `read-memory-enhanced`
27. `write-memory`
28. `insults-explain`
29. `release`

Any prompt not present in `DEFAULT_PROMPT_ORDER` is appended after the
listed slugs in its natural `Order` column position from SQLite.

### Storage keys

| Key                       | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `marco.promptOrder.v2`    | User's persisted slug order (JSON array of strings).          |
| `marco.promptOrder.rev`   | Integer revision of the last applied migration.               |
| `marco.promptOrder.v1`    | Legacy key. Read once, migrated, then removed.                |

The `v2` suffix on the active key exists so that a hard schema break
(new terminal contract, renamed canonical slugs) can be introduced by
bumping the key. Non-breaking updates use `MIGRATION_REV_KEY` instead
so users keep their drag customizations.

### `runPromptOrderMigrations()`

Runs once at module import time (see the top-level call in
`prompt-drag-order.ts`). Its job is to bring any older persisted order
forward to the current `DEFAULT_PROMPT_ORDER` contract **without
discarding user customizations**.

Behavior:

1. Reads `MIGRATION_REV_KEY`. If it is `>= CURRENT_MIGRATION_REV`
   (currently `3`), returns immediately (no-op).
2. Loads the current `v2` order. If empty, reads legacy keys
   (`marco.promptOrder.v1`) as the source.
3. Calls `migrateSavedOrder(source)`, which:
   - Drops unknown or obsolete slugs no longer in `DEFAULT_PROMPT_ORDER`.
   - Preserves the relative order of surviving non-terminal user slugs.
   - Adds any canonical non-terminal slugs the user was missing at
     their natural position.
   - Force-appends the terminal 7 in the locked default order,
     regardless of what the user had.
4. Writes the migrated array back to `marco.promptOrder.v2`.
5. Deletes all legacy keys.
6. Writes `CURRENT_MIGRATION_REV` into `MIGRATION_REV_KEY` so future
   imports skip the migration.

Safe to call repeatedly. Silently no-ops when `localStorage` is
unavailable (tests, service workers, corrupted storage).

Bump `CURRENT_MIGRATION_REV` whenever the terminal sequence or the
canonical slug list changes materially. That triggers a one-shot
in-place rewrite for every existing user on next load.

### `resetPromptOrderToDefault()`

Called from the prompt dropdown header's "↺ Reset order" action.
Writes a fresh copy of `DEFAULT_PROMPT_ORDER` to `marco.promptOrder.v2`
and returns it, so the caller can feed it directly into
`sortEntriesByOrder` for an immediate UI refresh. This is the user-
facing escape hatch when a drag session leaves the list in an unwanted
state, and it is also what the "Reset prompt order" diagnostic button
invokes.

Unlike `runPromptOrderMigrations`, this discards all user
customizations by design.

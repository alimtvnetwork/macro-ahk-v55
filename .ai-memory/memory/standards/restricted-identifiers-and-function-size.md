---
name: Restricted identifiers and function size
description: Ban repeated short identifier regressions and oversized functions in TypeScript UI code
type: standards
---

# Restricted identifiers and function size

ESLint `id-denylist` failures are treated as repeat regressions. Never introduce these identifiers in production code or tests: `arr`, `cb`, `fn`, `el`, `msg`, `ctx`, `obj`, `val`.

Use intent-revealing names instead: `items`, `callback`, `handler`, `element`, `message`, `context`, `record`, `value`, or a domain-specific name such as `actionElement`, `menuItem`, `popoverPanel`, `resizeObserver`.

**Function-size hard cap (v3, 2026-07-20): 15 lines.** Every function, method, arrow, and callback body MUST be <= 15 non-blank/non-comment lines, excluding the signature line and closing brace. Applies repo-wide including tests, scripts, and standalone-scripts. Source of truth: `.lovable/spec/commands/06-function-size-cap-15-lines.md`. The previous 40/60 ESLint limits are deprecated; enforcement flips to `{ max: 15, skipBlankLines: true, skipComments: true, IIFEs: true }` as each folder is refactored, then repo-wide (Plan 30 Step 10). Do not add logic to any function at or above 12 lines; split first, then add.

**PRE-WRITE CHECK (mandatory, 2026-07-20):** Before writing ANY new function body or React component, count the intended lines. If the body will exceed the ESLint cap for that path (25 for hooks/utilities, 50 for components, 15 for standalone-scripts UI), split BEFORE writing. Do NOT write it "as one block and refactor later" - that pattern has recurred 4x and every occurrence lands as a lint violation that has to be un-done. Split proactively:
  - React components > 50 lines: extract JSX blocks into `<HeaderSection>`, `<BodySection>`, `<FooterSection>` sub-components in the same file.
  - Hooks > 25 lines: extract `useXState`, `useXHandlers`, `useXEffects` composable hooks below the main hook.
  - Utilities > 25 lines: extract `parseX`, `validateX`, `formatX` pure helpers above the main function.
  - Test `describe`/`it` arrows > 50 lines: extract `arrangeXFixture`, `actY`, `assertZ` helpers at file top.


**Refactor patterns (Plan 30 SS-02, canonical):**
1. Shell + Wire - `mountX = () => wireX(buildXShell())` for every DOM installer.
2. Async pipeline - `prepare -> resolveTarget -> perform -> record -> finalize`, each <= 15 lines, orchestrator sequences and owns the diagnostic envelope.
3. Guard clauses first - early returns before extraction, to shed cognitive complexity.
4. Config-object params - helpers take `{ context, logger, correlationId }` instead of 4+ positional args.
5. Table dispatch - `Record<Kind, Handler>` map replaces switch statements; one handler per kind, each <= 15 lines.
6. Event-handler extraction - inline arrows promoted to named module-scope handlers with typed `event` params.
7. Error surface - every helper throws or returns a `DiagnosticError` (see `standalone-scripts/macro-controller/src/error-codes.ts`); no swallowed catches; `Reason` + `ReasonDetail` preserved.
8. Test arrange/act/assert - long `it()` / `describe.each` arrows split into `arrangeXFixture`, `actY`, `assertZ` helpers so no test body exceeds 15 lines.

**Preemptive split rule (v2, 2026-07-20):** any UI/DOM installer that builds a shell, wires a11y, wires outside-click, and returns a recompute callback MUST factor at least: (a) `buildXShell()` returning the popover/wrap, (b) `wireXPopover()` returning the a11y handle, (c) the public installer that just composes them + `observeOverflow`. `installChipOverflow` and `installActionOverflow` in `next-inline-ui.ts` are the canonical pattern. Never inline the `buildOverflowShell({...})` config block, the `enhancePopoverA11y` + `setOpen` + `wirePopoverButton` + `registerPointerPopoverCloser` chain, and the `recompute` closure in the same function body.

Before finishing any UI or test change, scan the touched files for denied identifiers and run `npx eslint standalone-scripts --max-warnings=0` locally. Also run `node scripts/check-function-length.mjs` (added by Plan 30 Step 12) once available.

**Strict-flag ratchet (2026-07-20):** `dataset.<name>`, and any read/write on a DOMStringMap or other index-signature type, MUST use bracket notation (`element.dataset['chip']`, not `element.dataset.chip`). `noPropertyAccessFromIndexSignature` is gated at baseline 411 in `spec/33-missing-coding-guideline/99-baselines.json` - dotted `dataset.foo` writes silently push the count over baseline and fail `scripts/check-strict-flag-fallout.mjs --strict`. Same rule for `process.env['X']`, arbitrary record maps typed `{ [k: string]: T }`, and any tsconfig-flagged surface. Never lower this baseline in the same PR that adds new access sites; only lower it when the count is already below the current floor after refactor.
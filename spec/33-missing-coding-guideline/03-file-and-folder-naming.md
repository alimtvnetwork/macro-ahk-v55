# 03 — File & Folder Naming Audit

Scope: `standalone-scripts/**` production `.ts` and directory names.
Spec source: `spec/02-coding-guidelines/01-cross-language/` (lowercase hyphen-case), and repo memory rule "lowercase hyphen-case filenames" reinforced during Plan-15.

## Root question (one sentence)
Does every production `.ts` file and every directory under `standalone-scripts/` follow lowercase hyphen-case, matching the convention already enforced on `.md` filenames?

## Method (deterministic, re-runnable)

```bash
cd standalone-scripts
# PascalCase files
find . -type f -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' \
  | grep -E '/[A-Z][a-zA-Z]*\.ts$'
# camelCase (mid-name uppercase) files
find . -type f -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' \
  | grep -E '/[a-z]+[A-Z][a-zA-Z]*\.ts$'
# underscore files (excluding __tests__ convention)
find . -type f -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' \
  | grep '_' | grep -v '__tests__'
# PascalCase / underscore directories
find . -type d -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.git/*' \
  | grep -E '/[A-Z_][^/]*$'
```

## Findings

### P1 — PascalCase production filenames (6 files, canonical class-per-file pattern)
| Path | Symbol exported |
| --- | --- |
| `macro-controller/src/core/AuthManager.ts` | class `AuthManager` |
| `macro-controller/src/core/CreditManager.ts` | class `CreditManager` |
| `macro-controller/src/core/LoopEngine.ts` | class `LoopEngine` |
| `macro-controller/src/core/MacroController.ts` | class `MacroController` |
| `macro-controller/src/core/UIManager.ts` | class `UIManager` |
| `macro-controller/src/core/WorkspaceManager.ts` | class `WorkspaceManager` |

Deviation: filename matches the exported class (Java/C# convention) instead of the repo's lowercase hyphen-case rule. Since these are load-bearing core modules with many importers, rename is a P1 (touches ~100+ import sites), not P0.

Recommended rename map (deferred to a dedicated task):
- `AuthManager.ts` -> `auth-manager.ts`
- `CreditManager.ts` -> `credit-manager.ts`
- `LoopEngine.ts` -> `loop-engine.ts`
- `MacroController.ts` -> `macro-controller.ts`
- `UIManager.ts` -> `ui-manager.ts`
- `WorkspaceManager.ts` -> `workspace-manager.ts`

### P3 — Accepted deviations (no action)
- `__tests__/` directories: Jest/Vitest convention, universally recognised, keep as-is.
- `.test.ts` and `.spec.ts` suffixes: standard test-runner convention.
- `globals.d.ts`, `manifest.json`: filenames dictated by TypeScript / Chrome MV3.

### Clean signals
- 0 camelCase production filenames (`fooBar.ts`) detected.
- 0 underscore production filenames outside `__tests__/`.
- 0 PascalCase directories.

## Leverage ranking
1. `macro-controller/src/core/*Manager.ts` rename batch — 6 files, one PR, breaks nothing outside its import graph. Ship behind a codemod (`rg -l 'from .*/core/AuthManager' | xargs sed -i ...`).
2. Add a `scripts/check-file-naming.mjs` guard so a future PascalCase filename fails CI. Pairs with the existing `.md` filename check.

## Not-in-scope for this report
Import path casing (`from './FooBar'` vs `./foo-bar`) — covered once the rename lands.

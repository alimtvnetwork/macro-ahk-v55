# 04 — Security Surface Audit

Scope: `standalone-scripts/**` production `.ts`.
Spec source: `spec/02-coding-guidelines/` XSS + secret-handling rules, memory `mem://constraints/readme-txt-prohibitions` for banned surfaces, `mem://constraints/no-supabase`.

## Root question (one sentence)
Where do we let untrusted string data reach a dangerous DOM sink (`innerHTML`, `outerHTML`, `document.write`), evaluate strings as code (`eval`, `new Function`), or embed hard-coded secrets?

## Method (deterministic, re-runnable)

```bash
cd standalone-scripts
# Secret literals
rg -n --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' \
  -e 'sk_(live|test)_' -e 'ghp_[A-Za-z0-9]{20}' -e 'AIza[0-9A-Za-z_-]{30}' \
  -e 'password\s*=\s*"' -e 'apiKey\s*[:=]\s*"[A-Za-z0-9_-]{16,}"' .
# Code-eval sinks
rg -n --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' \
  -e '\beval\(' -e 'new Function\(' .
# document.write
rg -n --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' \
  'document\.write\(' .
# innerHTML writes (production only)
rg -c --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' \
  -g '!**/__tests__/**' '\.innerHTML\s*=' .
# Strip trivial resets: `x.innerHTML = ""`
rg -n --no-heading -g '*.ts' -g '!**/node_modules/**' -g '!**/dist/**' \
  -g '!**/__tests__/**' '\.innerHTML\s*=' . \
  | rg -v '=\s*(""|`\s*`|'\'''\'')'
```

## Findings

### Clean signals (P3 — no action)
- 0 hard-coded secret literals (`sk_*`, `ghp_*`, `AIza*`, `apiKey="…"`, `password="…"`) in production code.
- 0 `document.write(` calls.
- 0 `eval(` calls.
- No Supabase imports (memory `no-supabase` still holds).

### P1 — `new Function()` on user-provided code (1 site, intentional)
`macro-controller/src/ui/js-executor.ts:111`
```ts
const result = new Function(code)();
```
Executes the extension user's own textbox contents inside the extension origin. This is the JS-executor feature by design, not an injection sink for foreign data. Acceptable as-is provided:
- Input comes exclusively from the JS-executor textbox (verified: `code` is read from `(textbox as HTMLTextAreaElement).value.trim()` on the same function, no other callers).
- Failure path already routes through `logError` + `addLoopJsHistoryEntry(code, false, message)` (verified lines 118-121).

Recommendation: add a top-of-file comment `// SECURITY: intentional eval sink, user-authored JS only; do not accept remote input here.` and add a lint rule allow-list entry so a future `new Function(` elsewhere fails CI.

### P1 — `.innerHTML =` prevalence (187 assignments across production, 30 are trivial `= ""` resets)
Effective payload sites: ~157. Concentration:

| File | Count | Risk shape |
| --- | --- | --- |
| `macro-controller/src/ui/prompt-import-modal.ts` | 14 | Renders parsed-JSON prompt names + bodies. **P0 review candidate** (data may come from user-supplied files). |
| `macro-controller/src/ui/settings-tab-panels.ts` | 7 | Static template strings. P2. |
| `macro-controller/src/ui/macro-ui.ts` | 7 | Static template strings. P2. |
| `macro-controller/src/ws-members-bulk-panel.ts` | 6 | Member name/email interpolation. **P1** — needs `escapeHtml` audit. |
| `macro-controller/src/ui/projects-modal.ts` | 6 | Project name interpolation. **P1**. |
| `macro-controller/src/ui/bulk-rename.ts` | 6 | Project name interpolation. **P1**. |
| `macro-controller/src/ui/ui-status-renderer.ts` | 5 | Error-message interpolation. **P1**. |
| `macro-controller/src/ui/section-open-tabs.ts` | 5 | Tab URL/title interpolation. **P1**. |
| `macro-controller/src/ui/prompt-dropdown.ts` | 5 | Prompt name interpolation. **P1**. |
| `macro-controller/src/ui/tools-sections-builder.ts` | 4 | Static template strings. P2. |
| `macro-controller/src/ws-list-renderer.ts` | 3 | Workspace-name interpolation via `buildWsRowInnerHtml`. **P1**. |
| `macro-controller/src/ui/section-ws-history.ts` | 3 | Also flagged in report `02-cross-language-style.md` for inline `onclick=`. **P0**. |
| ...29 more files, 1-3 each | | Mixed static + interpolated. |

Total unique files touching `.innerHTML =`: 40. Total assignments: 187. Trivial resets: 30 (safe). Effective sinks: 157.

### P0 — inline `onclick=` handler strings (1 confirmed)
`macro-controller/src/ui/section-ws-history.ts:88` was already flagged in report `02-cross-language-style.md`. Cross-linked here because `onclick=` inside an `innerHTML` string turns any name/URL in that template into a code-execution path if escaping breaks. Fix is the same: move to `addEventListener`.

### Missing central helper
No project-wide `escapeHtml(value: string): string` is exported from a shared util. Grep confirmed no callers of any such name. Consequence: every interpolation site reinvents (or skips) escaping.

## Leverage ranking
1. **Create `standalone-scripts/marco-sdk/src/dom/escape-html.ts`** exporting one function; make it the mandatory dependency of any string that ends up in `innerHTML`. Single PR, ~30 LOC.
2. **Audit the 8 P1 interpolation files above** (prompt-import-modal, ws-members-bulk-panel, projects-modal, bulk-rename, ui-status-renderer, section-open-tabs, prompt-dropdown, ws-list-renderer). Wrap every non-literal expression in `escapeHtml(...)`. Estimate: 1 day.
3. **Kill the `onclick=` string in `section-ws-history.ts:88`** (P0, tracked in report 02).
4. **Add ESLint rule** (`no-restricted-syntax`) that bans `AssignmentExpression[left.property.name="innerHTML"][right.type=/Template/] > TemplateLiteral:has(TemplateElement)` when the template contains an expression not wrapped in `escapeHtml(...)`. Not trivial; ship after step 1-2 land so violations are already gone.
5. **Guard the JS-executor** with the file-header SECURITY comment + allow-list entry.

## Not-in-scope
- CSP/manifest v3 policy review (belongs in a separate report).
- Third-party dependency vulnerability scan (belongs in `npm audit` CI, not this file-level audit).

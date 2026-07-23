# SS-01 report folder scaffold

Slug: report-folder-scaffold
Parent: 16-standalone-scripts-coding-guideline-audit
Status: pending
Created: 2026-07-27

## Goal

Create `spec/33-missing-coding-guideline/` as a first-class sibling to `spec/02-coding-guidelines/` and `spec/03-error-manage/`. It is a report folder, not a spec folder — its contents describe deviations found in `standalone-scripts/**`, not new rules.

## Files to create

- `spec/33-missing-coding-guideline/readme.md` — purpose, methodology, severity ladder, how to regenerate.
- `spec/33-missing-coding-guideline/00-inventory.md` — file inventory (produced in step 2).
- Placeholder headers only in this subtask; content lands in later steps.

## Severity ladder

- **P0** — security, silent error swallow, unlogged crashes, token leakage, retry violations.
- **P1** — logger contract, teardown leaks, `unknown` misuse, file-path CODE-RED breaches.
- **P2** — style, naming, complexity, function length, inline design tokens.

## Methodology

1. Static scan (`rg`, `eslint --no-eslintrc` with per-rule configs, `tsgo`).
2. Cross-reference with `mem://` rules pinned in the memory index.
3. Every finding records: file, line, ruleId, quote, severity, one-line fix hint.

## Out of scope

Applying fixes. This folder is diagnostic only.

# Prompt Library relocate to Plan/Next chips, AI guideline export, Repeat More popover, light-mode repair

Slug: prompt-library-relocate-and-light-mode
Steps: 20
Status: pending
Created: 2026-07-18

## Context

The current prompt library UX buries prompt selection/editing inside the Library modal. The user wants per-role (Plan / Next) chip-level controls that reuse the existing Add/Edit prompt editor and surface the required `{{token}}` contract, plus a downloadable AI guideline explaining the token rules. In parallel, the Repeat row overflows past 50 presets and the light theme is visually broken.

Captured artifacts this turn:
- Issue: `.lovable/issues/open/04-prompt-library-ux-misplaced.md`
- Issue: `.lovable/issues/open/06-repeat-row-overflow-needs-more-dropdown.md`
- Issue: `.lovable/issues/open/07-light-mode-ui-broken.md`
- Command: `.lovable/spec/commands/03-capture-request-as-issue-before-planning.md`

Prior pending plans pulled into scope for verification (must remain non-regressed):
- `.lovable/plans/pending/11-prompts-import-export-section.md`
- `.lovable/plans/pending/22-prompt-library-test-coverage-50.md`

Files most likely touched: `standalone-scripts/macro-controller/src/ui/plan-task-ui.ts`, `strip-frame.ts`, `prompt-manager.ts`, `prompt-io.ts`, `prompt-library-modal.*`, `index.css`, `schemas/prompts-export-bundle.schema.json`.

## Steps

1. Read issues 04/06/07 and confirm scope against the existing prompt-editor component; document the reuse contract (props, save handler, drift-guard hook) in `spec/33-missing-coding-guideline/prompt-editor-reuse.md`.
2. Add a per-role selector control (`⚙ Plan prompt ▾`) to the Plan row of the strip frame with menu items: `Choose default`, `Edit current`, `Add new plan prompt`, `Manage library…`.
3. Add the mirror control (`⚙ Next prompt ▾`) to the Next row of the strip frame with the same four menu items scoped to role=next.
4. Extract the existing Add/Edit prompt modal into a reusable `PromptEditor` component with props `{ role, initial, requiredTokens, onSave, onCancel }`; keep the current dropdown flow calling into it unchanged.
5. Render a persistent "Required tokens" chip strip inside `PromptEditor` sourced from the drift-guard token list; disable Save with a clear inline error if any required token is missing on blur.
6. Add a "Download AI guideline" button to `PromptEditor` that generates a markdown file (`prompt-token-contract-<role>-<slug>.md`) listing every required `{{token}}`, its meaning, and rules ("do not rename", "do not translate", "case-sensitive").
7. In the Prompt Library modal, add a per-row Edit button that opens the same `PromptEditor`, and add a tooltip on the Generic role chip explaining "applies to any dropdown prompt not scoped to plan or next".
8. Add a "Download sample JSON" button next to Import in the Library modal that exports a minimal valid bundle conforming to `schemas/prompts-export-bundle.schema.json`; link the schema from the tooltip.
9. Wire Import to run the JSON through the schema validator first and surface each schema violation with the JSON pointer path in the error banner (no silent skips).
10. Replace every hardcoded color literal (`bg-black`, `text-white`, `bg-[#…]`, inline `#hex` in CSS) in `standalone-scripts/macro-controller/src/ui/**` with semantic tokens from `index.css`; add tokens for `--strip-frame-bg`, `--chip-bg`, `--chip-border`, `--editor-callout-bg` if missing.
11. Add light-theme values for every new token so the strip frame, dropdown, library, editor, and popovers render readable in light mode; verify against the user-supplied light-mode screenshot when it arrives.
12. Convert the Repeat row to the same "inline ≤ 50, overflow under `More ▾`" pattern already used by Plan; share the popover component (`plan-more-popover.ts`) via a role prop.
13. Add a "Reset to default" action inside `PromptEditor` that restores the seeded content for the current role/slug and re-runs the drift guard; guarded by a confirm dialog.
14. Update `seed-plan-next.ts` so the seeded default carries the required-tokens list as data (not a runtime regex) and `PromptEditor` reads from that manifest — single source of truth.
15. Add integration tests: (a) Plan chip → editor open → save with token removed → rejected; (b) Next chip → add new → appears in dropdown; (c) Import invalid JSON → schema errors shown with pointer; (d) AI guideline markdown contains every required token.
16. Add a Playwright E2E `tests/e2e/prompt-chip-editor.spec.ts` that clicks the Plan gear, edits the body, saves, closes the strip, reopens, and verifies persistence via the DB bridge.
17. Add a Playwright E2E for light-theme readability: navigate with `?theme=light`, screenshot strip + dropdown + library + editor, run pixelmatch against dark baseline to confirm contrast token switch (no visual regressions in dark).
18. Add a Playwright E2E for the Repeat `More ▾` popover: assert overflow presets are absent from the row and present in the popover, and that selecting one persists via `plan-task-ui`.
19. Update `.lovable/issues/open/04`, `06`, `07` to `closed/` once each corresponding integration + E2E test is green; move this plan file to `completed/` in the same commit.
20. Bump minor version, add changelog entries for the four themes (chip editor, AI guideline export, Repeat More popover, light-mode repair), update `RELEASE_NOTES.md`, and pin the new version in the root `readme.md`.

## Verification

- Manual walk-through of every DoD bullet in issues 04 / 06 / 07.
- `bun test` green for new integration tests in step 15.
- `bunx playwright test tests/e2e/prompt-chip-editor.spec.ts tests/e2e/prompt-light-theme.spec.ts tests/e2e/repeat-more-popover.spec.ts` all green.
- `rg -n "bg-black|text-white|bg-\[#" standalone-scripts/macro-controller/src` returns zero hits.
- `node scripts/check-changelog-entry.mjs` exits 0 for the new version.
- Screenshot review against user-supplied light-mode capture once provided.

## Appended from prior pending tasks

- Plan 11 (prompts-import-export-section): step 8/9 above satisfy the "sample JSON + schema link" gap raised there; that plan can close once this ships.
- Plan 22 (prompt-library-test-coverage-50): step 15/16/17/18 add the missing chip-editor and light-mode coverage; remaining 46 test cases stay tracked under plan 22.
- Plan 10 (unified-billing-all-workspaces) and Plan 13 (per-project-chat-submit-tracker): unrelated, left pending.

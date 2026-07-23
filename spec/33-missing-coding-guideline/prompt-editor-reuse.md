# Prompt Editor reuse contract (plan-23 step 1)

Parent plan: `.lovable/plans/pending/23-prompt-library-relocate-and-light-mode.md`
Owning issue: `.lovable/issues/open/04-prompt-library-ux-misplaced.md`
Created: 2026-07-18

## Purpose

The existing "Add / Edit prompt" editor already used by the prompts dropdown
(`standalone-scripts/macro-controller/src/ui/save-prompt.ts`) must be the
SINGLE entry point for editing any prompt, whether it is reached from:

- the prompts dropdown "Add" / row-edit affordance,
- the Prompt Library modal per-row Edit button,
- the new Plan chip `⚙ Plan prompt ▾` menu (plan-23 step 2),
- the new Next chip `⚙ Next prompt ▾` menu (plan-23 step 3).

Two editors would drift. There is exactly one.

## Files in scope

| Concern | File | Lines / symbols |
|---|---|---|
| Existing editor UI | `standalone-scripts/macro-controller/src/ui/save-prompt.ts` | full file (333 lines); export the modal open function |
| Plan chip integration | `standalone-scripts/macro-controller/src/ui/plan-task-ui.ts` | new `⚙` control near `renderPlanTaskSubmenu` (line 126) |
| Next chip integration | `standalone-scripts/macro-controller/src/ui/next-inline-ui.ts` | new `⚙` control in the Next row builder |
| Library modal per-row edit | `standalone-scripts/macro-controller/src/ui/prompt-library-modal.ts` | inject Edit button into each rendered row |
| DB read/write | `standalone-scripts/macro-controller/src/db/prompt-db.ts` | `getDefaultPromptForRole`, `savePrompt`, `listPromptsByRole` |
| Drift guard | `standalone-scripts/macro-controller/src/db/token-drift-guard.ts` | `extractRequiredTokens(body)`, `assertTokensPreserved(prev, next)` |
| AI guideline export | `standalone-scripts/macro-controller/src/ui/prompt-llm-guide-download.ts` | already exists (175 lines); wire download button from editor |
| Schema for import/export | `schemas/prompts-export-bundle.schema.json` | linked from Library "Download sample JSON" |

## Public contract of the reused editor

Exported from `save-prompt.ts` (rename existing internal open function if
needed — no new file):

```ts
export interface PromptEditorInput {
  readonly mode: 'add' | 'edit';
  readonly role: 'plan' | 'next' | 'generic';
  readonly initial?: {
    readonly Slug: string;
    readonly Title: string;
    readonly Body: string;
    readonly ReplaceKey?: string;
    readonly ReplaceValues?: readonly number[];
  };
  /** Tokens that MUST survive editing. Sourced from the DB row or, for a
   *  brand-new prompt, the seeded default for the role. */
  readonly requiredTokens: readonly string[];
  /** Called after drift guard passes. Editor stays open until this resolves. */
  readonly onSave: (draft: PromptEditorDraft) => Promise<void>;
  readonly onCancel?: () => void;
}

export interface PromptEditorDraft {
  readonly Slug: string;
  readonly Title: string;
  readonly Body: string;
  readonly ReplaceKey: string;
  readonly ReplaceValues: readonly number[];
}

export function openPromptEditor(input: PromptEditorInput): void;
```

## Behavioral requirements

1. Header shows role badge (`PLAN`, `NEXT`, `GENERIC`) with the tooltip
   defined in issue 04 for GENERIC.
2. A pinned "Required tokens" strip renders each token from
   `input.requiredTokens` as a monospace chip. Chips are visual only, not
   editable.
3. On every keystroke (debounced 150 ms) the editor runs
   `extractRequiredTokens(body)` and highlights missing chips in red.
4. Save is disabled whenever any required token is missing OR
   `assertTokensPreserved(input.initial?.Body ?? '', draft.Body)` returns
   an error. The error message renders below the token strip, not in a
   toast, so it stays visible.
5. A "Download AI guideline" button under the token strip triggers the
   existing `prompt-llm-guide-download.ts` flow scoped to
   `input.requiredTokens` and role.
6. "Reset to default" restores `seed-plan-next.ts` content for the current
   role/slug behind a confirm dialog; the drift guard re-runs after reset.
7. Cancel closes the editor without persisting; if `body` changed, prompt
   with a confirm.
8. On save the editor calls `input.onSave(draft)`. Persistence, cache
   invalidation, and dropdown refresh are the caller's responsibility.
   The editor itself is UI-only.

## Non-goals for this contract

- No new modal library.
- No React port — vanilla DOM as the rest of `macro-controller/src/ui/`.
- No change to `PromptContext` typing beyond adding `role` where needed.
- No change to `chrome.storage.local` schema (mem://constraints/no-storage-pascalcase-migration).

## Verification

- Editor opens from Plan chip, Next chip, Library row, and dropdown "Add"
  and looks identical in each.
- Removing a `{{token}}` disables Save and shows the inline error.
- "Download AI guideline" produces a `.md` that contains every chip token.
- Unit test: `openPromptEditor` render + drift-guard interaction covered
  in `__tests__/save-prompt.editor-contract.test.ts` (added in plan-23 step 15).

## Open questions

None — call sites just pass `role`, `initial`, `requiredTokens`, and
`onSave`. If a call site needs more, extend the interface additively.

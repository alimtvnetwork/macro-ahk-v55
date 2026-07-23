# Prompt Library UX misplaced — Plan/Next editing must live on the chips, not only in Library modal

Status: open
Created: 2026-07-18

## Symptom (verbatim intent from user, 2026-07-18)

> "You have put the prompt section in the library mode where the prompts should be modification and selection for the plan and the next. It should be similar to the position that I have selected. So for the next, there should be a button. I should click on it, and I should be able to select the default next prompt or edit the prompt, or add a new next prompt."
>
> "The edit screen should be same as like add a prompt or edit a prompt screen, what we have seen or created before. That should be reused, along with mentioning what is the text that would replace in programmatic way. That should be critically mentioned."
>
> "There should be a guideline for the AI, that could be downloaded and shared with AI so that if the prompt is modified, it would keep that template section for the replace."
>
> "If I go into the library, there is this plan, next and generic prompt. I don't know where the generic one is coming from, and I don't know how to edit it. So there is a JSON option that is there to import, but how this JSON will be created? There is no guideline."
>
> "Where is the edit screen for this prompt? I don't see it."

## Expected

1. On the inline Plan/Next/Repeat strip frame, each of Plan and Next rows exposes a per-row control (button/menu) to:
   - select which prompt is the current default for that role,
   - edit the currently selected prompt,
   - add a new prompt scoped to that role.
2. The edit screen reuses the existing "Add / Edit prompt" modal (the one used by the prompts dropdown), NOT a separate one buried inside the Library modal.
3. The edit screen renders a prominent, non-dismissible callout listing every `{{token}}` placeholder that MUST be preserved (drift guard already exists — surface it in UI).
4. A "Download AI guideline" button on the edit screen exports a markdown file explaining the token contract so the user can paste it into an AI chat before asking the AI to rewrite the prompt.
5. Library modal keeps role filter (plan / next / generic) but every row has an inline Edit button that opens the same reused editor.
6. "Generic" role documented in the UI (tooltip or subheading) — what it is, when it applies, how to create one.
7. Import expects a JSON in the shape emitted by Export. Provide a "Download sample JSON" button next to Import, and link to `schemas/prompts-export-bundle.schema.json`.

## Actual

- Editing only reachable via Library modal.
- No per-chip Plan / Next affordance for select / edit / add.
- No visible token-preservation callout.
- No downloadable AI guideline.
- Generic role is unexplained and appears uneditable in the modal.
- Import surface exists with no sample or schema link — user has no way to construct a valid JSON.

## Related files

- `standalone-scripts/macro-controller/src/ui/prompt-library-modal.ts` (or `.tsx`)
- `standalone-scripts/macro-controller/src/ui/prompt-manager.ts`
- `standalone-scripts/macro-controller/src/ui/prompt-io.ts`
- `standalone-scripts/macro-controller/src/ui/plan-task-ui.ts`
- `standalone-scripts/macro-controller/src/ui/strip-frame.ts` (Plan / Next / Repeat rows)
- `schemas/prompts-export-bundle.schema.json`

## Definition of done

- Manual: Plan chip → click gear → pick default / edit / add new works. Same for Next.
- Manual: Edit screen shows a "Required tokens" chip list; removing one blocks Save with the drift-guard error.
- Manual: "Download AI guideline" produces a `.md` file mentioning every required token.
- Manual: "Download sample JSON" from Import produces a file that Import round-trips without error.
- Tests: integration test for chip → editor open, save-with-token-removed rejection, and JSON round-trip.
- Light-mode screenshot check (see issue 07) shows the new editor readable in light theme.

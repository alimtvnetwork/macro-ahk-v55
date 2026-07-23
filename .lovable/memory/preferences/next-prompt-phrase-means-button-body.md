---
name: "'next prompt' / 'plan prompt' = the button body, not the UI"
description: Phrase-mapping rule for prompt-update requests. When the user says "update the next prompt" or "update the plan prompt", they mean the BODY that gets inserted when the Next / Plan chip button is clicked, never the inline chip UI, popover, dropdown, or any surrounding React component.
type: preference
---

When the user says any of:

- "update the next prompt"
- "next prompt update"
- "update the plan prompt"
- "plan task prompt update"
- variants like "fix the next prompt", "change the plan prompt"

they are talking about the **prompt body text** that gets appended to the
Lovable chat box when the Next / Plan chip is clicked, and the seed row
that ships in `PromptLibrary`. They are NEVER asking to edit:

- `next-inline-ui.ts`, `prompt-dropdown.ts`, `chip-gear-menu.ts`, or any
  other UI/popover code
- version labels, badges, or chip visuals

**How to apply:**

1. Update the canonical markdown at
   `standalone-scripts/prompts/13-next-tasks/prompt.md` (Next) or
   `standalone-scripts/prompts/14-plan-steps/prompt.md` (Plan).
2. Mirror the same body byte-for-byte into
   `standalone-scripts/macro-controller/src/seed/plan-next-prompts.ts`
   (`NEXT_DEFAULT_BODY` / `PLAN_DEFAULT_BODY`).
3. Bump `Version` and `UpdatedAt` in the matching `info.json`.
4. If replacing the body, prepend the previous body to
   `NEXT_DEFAULT_LEGACY_BODIES` / `PLAN_DEFAULT_LEGACY_BODIES` so the
   seeder auto-upgrades un-customised user rows.
5. NEVER add or surface the Plan / Next prompts inside the generic
   prompt-dropdown list. They live only behind the dedicated Plan / Next
   chip buttons. `HIDDEN_SLUG_FRAGMENTS` in
   `standalone-scripts/macro-controller/src/ui/prompt-dropdown.ts` MUST
   keep `plan-steps`, `next-tasks`, and their `{{n}}`-expanded slug
   variants filtered out. Do not "helpfully" expose them; the user has
   repeatedly said they do not belong in the list.

**Why:** This confusion has caused multiple angry corrections. The user
has stated explicitly: whenever they say "next prompt update" or "plan
prompt update", it means the content appended to the chat box when the
button is pressed. Editing the button UI, or listing the prompt in the
generic dropdown, is a hard mistake, not a judgement call.

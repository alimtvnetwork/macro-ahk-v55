# Spec — Next Button Reference (v16) Adoption

**Source:** `assets/01-next-button/next-button.js` (Vibedeals "Next →" queue add-on, V16.0).

This spec captures the patterns from the reference script that we adopt for the Marco Controller prompt dropdown.

---

## 1. Prompt schema

The reference uses a flat array of prompt objects with **two shapes**:

```js
// Static prompt
{ category, slug, title, body }

// Dynamic prompt with variants
{
  category, slug, title, body,
  variants: {
    key:          "N",                // placeholder inside title / body / slugTemplate
    values:       ["1","2","3","4","5","8"],
    slugTemplate: "next-${N}-steps"
  }
}
```

Substitution: every `${key}` occurrence in `title`, `body`, and `slugTemplate` is replaced with the chosen value at render-/insert-time.

### Our equivalent

We expose the same metadata as **flat fields** on `PromptEntry` because `info.json` is the canonical source:

| Reference | Marco PromptEntry |
|-----------|-------------------|
| `variants.key`          | `replaceKey`     |
| `variants.values`       | `replaceValues`  |
| `variants.slugTemplate` | `slugTemplate`   |
| `variants` truthy       | `isDynamic: true`|

`normalizePromptEntries()` (in `standalone-scripts/macro-controller/src/ui/prompt-utils.ts`) reads those fields and expands each dynamic prompt into one flat `PromptEntry` per value. Expanded entries carry:

- `name`  — title with `${key}` substituted
- `text`  — body with `${key}` substituted
- `slug`  — `slugTemplate` with `${key}` substituted
- `id`    — `<parent-id>-<value>`
- `parentTitle`   — original dynamic-prompt title (e.g. `Plan ${N}`)
- `parentSlug`    — original dynamic-prompt slug (e.g. `plan-steps`)
- `variantValue`  — the chosen value (e.g. `"5"`)

The last three are the bridge that lets the dropdown collapse variants back into a single chip row in a future iteration.

## 2. Insertion contract (single-shot, no auto-submit)

Reference: `activateRow()` calls `state.insertIntoComposer(prompt.body, prompt)` then `closePopover()` and toasts `"Prompt inserted: …"`. It never clicks the submit button and never chains.

Marco contract — already in force as of **v3.74.0** (`runTaskNextLoop()`): paste once into the editor, toast, return. Repeated submissions belong exclusively to the Repeat `▶ Start` control.

## 3. Compact "chip" row (future UI iteration)

When a category contains entries whose `parentSlug` is identical, the reference renders one row with the parent title and a horizontal strip of small numeric chips (one per `variantValue`). Clicking a chip activates that variant.

This is intentionally **not** implemented yet. The flat expansion is already shipped and visible; chip grouping is an opt-in UX upgrade that reuses the `parentTitle` / `parentSlug` / `variantValue` fields above.

## 4. Categories surfaced

Reference categories used in `PROMPTS`: `Coding`, `Conventions`, `Explain`, `Memory`, `next`, `Plan`, `Proofread`.

Marco mirrors `next` (slug `next-tasks`) and `Plan` (slug `plan-steps`) — both dynamic. Other categories map to existing bundled prompts (`16-read-memory`, `17-write-memory`, `18-coding-guidelines`, `20-proof-read`, `22-release`).

## 5. Out of scope

- The reference's queue/drain runtime (`vbx_next_session`, `vbx_next_running`, project-pinned tabs) is **not** adopted. Marco already has its own `task-queue` and Repeat `▶ Start` loop.
- The reference's typeahead, keyboard arrow navigation, and `aria-activedescendant` are **not** ported in this round. Track as a follow-up if requested.

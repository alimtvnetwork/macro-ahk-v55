# 52 – Extract isBackspaceOnEmptyWithChips() in ws-members-chip-input

## Target
`standalone-scripts/macro-controller/src/ws-members-chip-input.ts`

## Rule
**Rule 3** – No more than 2 `&&` in a single condition; avoid mixing positive and negative operands.

## Violation

| Location | Code |
|----------|------|
| L96 | `} else if (e.key === 'Backspace' && !input.value && validEmails.size > 0)` |

Three `&&` operands with mixed polarity (equality, negation, comparison) in a single `else if` condition.

## Fix

Decompose into named booleans immediately before the `else if`:

```ts
const isBackspaceKey = e.key === 'Backspace';
const isInputEmpty = !input.value;
const hasChips = validEmails.size > 0;
const isBackspaceOnEmptyWithChips = isBackspaceKey && isInputEmpty && hasChips;
if (isBackspaceOnEmptyWithChips) {
```

> **Note:** The `else if` becomes a plain `if` because the guard variables are evaluated lazily within the original `else` branch's block. Ensure the surrounding `if/else if` chain is restructured appropriately if needed.

## Instructions

1. Locate L96 in `ws-members-chip-input.ts`.
2. Extract the four named booleans shown above, placed just before the `else if`.
3. Replace the `else if (e.key === 'Backspace' && ...)` with the simplified guard.
4. Run lint and confirm zero new errors.
5. Commit:
   ```
   fix(guidelines): extract isBackspaceOnEmptyWithChips in ws-members-chip-input
   ```

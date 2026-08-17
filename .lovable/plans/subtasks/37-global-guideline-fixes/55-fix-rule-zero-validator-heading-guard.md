# 55 – Extract isNextHeadingInSteps() in rule-zero-validator

## Target
`standalone-scripts/macro-controller/src/seed/rule-zero-validator.ts`
*(Search for `rule-zero-validator.ts` if the exact path differs.)*

## Rule
**Rule 3** – No more than 2 `&&` in a single condition; avoid mixing positive and negative operands.

## Violation

| Location | Code |
|----------|------|
| (search) | `if (inStepsSection && RE_NEXT_HEADING.test(line) && !RE_STEPS_HEADING.test(line))` |

Three `&&` operands with mixed polarity (two positive checks + one negated regex test) in a single `if` condition.

## Fix

Decompose into named booleans immediately before the `if`:

```ts
const isInStepsAndMatchesNext = inStepsSection && RE_NEXT_HEADING.test(line);
const isNotStepsHeading = !RE_STEPS_HEADING.test(line);
const isNextHeadingInSteps = isInStepsAndMatchesNext && isNotStepsHeading;
if (isNextHeadingInSteps) {
```

Each variable is self-documenting and no single expression mixes positive and negative operands.

## Instructions

1. Search the codebase for `rule-zero-validator.ts` to confirm the exact path.
2. Locate the violation line (`inStepsSection && RE_NEXT_HEADING.test(line) && !RE_STEPS_HEADING.test(line)`).
3. Replace with the three named booleans and simplified `if` shown above.
4. Run lint and confirm zero new errors.
5. Commit:
   ```
   fix(guidelines): extract isNextHeadingInSteps guard in rule-zero-validator
   ```

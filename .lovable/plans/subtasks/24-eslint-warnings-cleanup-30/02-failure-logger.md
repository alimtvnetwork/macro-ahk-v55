---
Slug: failure-logger
Parent: 24-eslint-warnings-cleanup-30
Status: pending
Created: 2026-07-19
---

# `src/background/recorder/failure-logger.ts`

Three functions over the 40-line ceiling plus cognitive-complexity 65 on `formatFailureReport`.

## `buildFailureReport` (42 lines)

Extract:
- `collectContextInputs(ctx)` returns `{selectorAttempts, variableContext, formSnapshot}`.
- `deriveReason(ctx)` returns `{reason, reasonDetail}` (delegates to `classifyReason`).
- `assembleReport(inputs, reason)` returns the final `FailureReport` object.

## `classifyReason` (55 lines)

Convert cascading `if/else` into a table:
```ts
const CLASSIFIERS: Array<[predicate: (c: Ctx) => boolean, code: ReasonCode]> = [
  [isSelectorMiss, 'SelectorNotFound'],
  [isVariableMiss, 'VariableUnresolved'],
  [isJsThrew, 'JsThrew'],
  ...
];
return CLASSIFIERS.find(([match]) => match(ctx))?.[1] ?? 'Unknown';
```

## `formatFailureReport` (69 lines, cognitive 65)

Split by section:
- `formatHeader(report)`
- `formatSelectorAttempts(attempts)`  (respects verbose gate)
- `formatVariables(vars)`
- `formatFormSnapshot(snapshot)` (sensitive-field masking here)
- `formatFooter(report)`

Compose: `return [header, selectors, vars, form, footer].filter(Boolean).join('\n')`.

Verbose truncation logic stays inside the section formatters, not the top-level function, dropping cognitive complexity to <15.

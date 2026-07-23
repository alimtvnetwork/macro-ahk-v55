---
Slug: plan-task-ui-paste-outcome-missing-await
Status: closed
Created: 2026-07-17
Closed: 2026-07-17
Severity: silent-failure (medium)
Discovered-by: plan-22 step 44 negative test (`plan-task-ui-db-empty.test.ts`)
---

# Plan chip: hard-failure toast never fired because `pasteIntoEditor` was not awaited

## Symptom

When `pasteIntoEditor` returned `'failed'`, the caller-side toast on
`plan-task-ui.ts:121` (`'❌ Plan prompt: injection failed'`) never appeared.
Users clicking a Plan chip in an environment where the editor was
unreachable saw nothing.

## Root cause (one sentence)

`plan-task-ui.ts:117` assigned the result of the async `pasteIntoEditor(...)`
call to `const outcome` without `await`, so `outcome` was a `Promise` and
`String(outcome) === 'failed'` always evaluated to `false`
(`"[object Promise]" !== "failed"`).

## Repro (before fix)

```
plan-task-ui.ts:117
  const outcome = pasteIntoEditor(text, getPromptsConfig(), adapterGetByXPath, 'plan-chip');
plan-task-ui.ts:121
  if (String(outcome) === 'failed') showPasteToast('❌ Plan prompt: injection failed', true);
```

`vitest` negative test (`plan-task-ui-db-empty.test.ts`, case
"surfaces a hard-failure toast only when pasteIntoEditor reports failed")
reproduced this reliably: `pasteMock.mockResolvedValueOnce('failed')`, then
`toastMock.mock.calls.length === 0`.

## Fix

Added `await` on line 117. Minimum correct change tied to the root cause,
no try/catch, no fallback:

```diff
-  const outcome = pasteIntoEditor(text, getPromptsConfig(), adapterGetByXPath, 'plan-chip');
+  const outcome = await pasteIntoEditor(text, getPromptsConfig(), adapterGetByXPath, 'plan-chip');
```

## Verification

- Before: test failed with `Number of calls: 0` on `toastMock`.
- After: test passes; toast fires exactly once with the expected string.
- Test file: `standalone-scripts/macro-controller/src/ui/__tests__/plan-task-ui-db-empty.test.ts`.
- Full run: 3 passed, 0 failed.

## Related

- Plan: `.lovable/plans/pending/22-prompt-library-test-coverage-50.md` step 44.
- Same shape may exist elsewhere; grep candidates: `String(await? ...pasteIntoEditor)` and any
  `pasteIntoEditor(` without a leading `await`. Left as a follow-up sweep, not part of this fix.

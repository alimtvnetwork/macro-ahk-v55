---
Slug: prompt-library-modal-round-trip-parallel-flake
Status: open
Created: 2026-07-23
---

# `prompt-library-modal-round-trip.test.ts`: 2 tests fail under parallel vitest, pass in isolation

## Symptom

`bunx vitest run standalone-scripts/macro-controller` reports:

```
 FAIL standalone-scripts/macro-controller/src/ui/__tests__/prompt-library-modal-round-trip.test.ts
   > serialises fixture prompts on Export and re-imports every entry ...
   AssertionError: expected null not to be null
   > produces a PromptsBundleV1 envelope ...
   AssertionError: expected null not to be null
```

In isolation the same 2 tests pass in ~300 ms.

## Root cause (hypothesis)

The test stubs `URL.createObjectURL` on the global `URL` inside `beforeEach` and assigns the received blob to a module-scoped `capturedBlob`. Under parallel workers other suites that also touch `URL.createObjectURL` can overwrite the global before this file's assertion resolves, leaving `capturedBlob` null.

## Fix

- Replace direct property assignment with `vi.stubGlobal('URL', ...)` in `beforeEach` and `vi.unstubAllGlobals()` in `afterEach`, OR
- Poll `URL.createObjectURL.mock.calls[0][0]` instead of a closed-over variable, OR
- Move the file into a `serial` describe block.

## Status

open
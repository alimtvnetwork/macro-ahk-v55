# Root Cause Analysis: Service Worker E2E Timeouts (Cold Start)

## Issue
The Playwright E2E tests for the Chrome Extension were timing out during the \Cold Start\ suite, specifically when the tests waited for the background service worker to respond to the \__PING__\ and health checks.

## Root Cause
A previous automated refactoring session attempted to implement a strict wrapper around \etch\ calls using a custom \ServiceResult\ wrapper to enforce structured error logging. However, this refactor:
1. Blindly replaced \wait fetch(...)\ with \ServiceResult.wrapFetch(await fetch(...))\ in numerous background service worker files (e.g., \manifest-seeder.ts\, \script-resolver.ts\, \wasm-integrity.ts\) **without importing** the \ServiceResult\ module. This caused unhandled \ReferenceError: ServiceResult is not defined\ exceptions which crashed the service worker boot sequence.
2. Injected \RiseupAsiaMacroExt.Logger.error\ calls into all catch blocks across the \src/background\ folder. However, \RiseupAsiaMacroExt\ is a content-script / UI namespace and is completely undefined in the isolated Service Worker global scope. When an error occurred, the logging fallback itself crashed with \ReferenceError: RiseupAsiaMacroExt is not defined\, completely halting the SW boot loop.
3. Because the Service Worker boot sequence uses sequential \wait\ calls, any unhandled synchronous exception terminates the boot sequence early. The \message-buffer.ts\ queue is therefore never drained, meaning messages sent from the Playwright test suite (like \__PING__\) hung forever, causing E2E timeouts.

## Resolution
1. Removed all broken \RiseupAsiaMacroExt.Logger.error\ references from the \src/background\ directory.
2. Reverted the broken \ServiceResult.wrapFetch\ modifications on \etch\ calls in \src/background\, returning them to the standard DOM \etch\ and \Response.ok\ validation patterns.
3. Ensured that the \ServiceResult\ wrapper is strictly used for DB calls in the SQLite wrapper (\src/utils/result-wrapper.ts\) where the \globalThis.RiseupAsiaMacroExt\ fallback handles the undefined namespace gracefully without throwing an exception.

## What to Avoid
When implementing global error handling or wrapper utility patterns:
* **Avoid injecting UI/Content-Script namespaces** (like \RiseupAsiaMacroExt\) into background service workers unless explicitly guarded with \	ypeof\ checks.
* **Avoid blind automated regex replacements** that wrap \etch\ calls or modify catch blocks without ensuring the required dependencies are imported.
* **Avoid modifying the return type of \etch\** from \Response\ to a custom wrapper object without also rewriting all downstream accesses (e.g., changing \.json()\ to \.data!.json()\ and \.ok\ to \.isSuccess\), as this causes fatal runtime TypeErrors.

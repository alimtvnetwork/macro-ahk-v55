---
Slug: file-split-strategy
Status: pending
Created: 2026-07-17
Parent: 17-standalone-scripts-guideline-remediation
---

# SS-06 — File split strategy (P1-05)

Root cause: `ui/prompt-dropdown.ts` (1441 LOC), `ui/ws-list-renderer.ts` (1156), `ui/projects-modal.ts` (1114) each mix event wiring, rendering, data massage, and persistence in one file — impossible to reason about, and ESLint complexity rules are silenced (P0-08) so nothing forces the split.

## Split axes (per file)

Each file becomes a folder with 4 modules:

```
ui/prompt-dropdown/
  index.ts             (public API — mount/unmount only)
  wire.ts              (event bindings, listener scope)
  render.ts            (safe-template DOM builders)
  data.ts              (DB reads, filter/sort, in-memory model)
  __tests__/
    render.test.ts
    data.test.ts
    wire.test.ts
```

Same split for `ws-list-renderer/` and `projects-modal/`.

## Rules

- `index.ts` re-exports only the public API — no `export *`.
- `wire.ts` receives a listener scope from `index.ts`; never creates its own.
- `render.ts` is pure: input model -> `TrustedHtml`. No DB, no globals.
- `data.ts` never touches the DOM.

## Verification

- Each new file ≤ 400 LOC.
- Behavior parity locked by the characterisation tests from SS-01 + new per-module tests.
- `check-file-loc-ceiling.mjs` passes (soft 800, hard 1200).
- Public export shape of the folder equals the original file's exports (`ts-prune` diff = 0 net exports).

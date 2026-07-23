# 01 — Quickstart for a Blind AI

If you only read one file, read this one. Ten bullets, nothing else.

1. **Read order**: `spec/00-what-to-read-first.md` → `spec/00-glossary.md` → `spec/02-non-negotiables.md` → `mem://index.md`.
2. **Stack**: Chrome MV3 extension (background SW + MAIN-world injection) + Vite + TypeScript. No backend.
3. **Storage**: 4 tiers — SQLite (logs), IndexedDB (cache), localStorage (auth bridge), `chrome.storage.local` (StoredProject). Never rewrite keys (see `mem://constraints/no-storage-pascalcase-migration`).
4. **Auth**: ONE function — `getBearerToken()`. No legacy paths. No Supabase.
5. **Logging**: ALL errors via `<NAMESPACE>.Logger.error(...)`. Never `console.error`, never swallow.
6. **Failure logs MUST include**: `Reason`, `ReasonDetail`, full `SelectorAttempts[]`, full `VariableContext[]`. Null + reason if unknown.
7. **Theme**: dark-only. No light mode, no toggles, no `framer-motion`/`gsap`.
8. **No retry / backoff**: sequential fail-fast unless a memory entry explicitly authorizes retry.
9. **Tests ship with features**: unit, component, or E2E — pick the right level, but never zero.
10. **Read-only**: never touch `skipped/**` or `.release/**`. CI guard will fail your PR.

For deeper background: `spec/03-decision-tree.md` (user request → which file → which rule) and `spec/04-failure-modes.md` (past LLM mistakes).

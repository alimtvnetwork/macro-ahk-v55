# 03 — Decision Tree

When the user asks for X, read Y, apply rule Z.

```text
USER REQUEST
│
├── "add auth / login / token"
│     → READ  mem://auth/unified-auth-contract + mem://auth/token-retrieval-strategy
│     → APPLY getBearerToken() ONLY. No Supabase. No legacy paths.
│
├── "store data / persist / cache"
│     → READ  mem://architecture/data-storage-layers
│     → APPLY pick correct tier (SQLite / IndexedDB / localStorage / chrome.storage.local).
│              Never rewrite StoredProject keys.
│
├── "log error / failure / diagnostic"
│     → READ  mem://standards/error-logging-via-namespace-logger.md
│             + mem://standards/verbose-logging-and-failure-diagnostics
│     → APPLY <NAMESPACE>.Logger.error + full failure-log shape
│              (Reason, ReasonDetail, SelectorAttempts[], VariableContext[]).
│
├── "add animation / transition"
│     → READ  mem://style/animation-strategy + mem://ui/view-transition-patterns
│     → APPLY Tailwind + CSS keyframes. No framer-motion. No gsap.
│
├── "add timer / observer / listener"
│     → READ  mem://standards/timer-and-observer-teardown
│     → APPLY paired teardown + pagehide; pause on document.hidden.
│
├── "add CI workflow / change ci.yml"
│     → READ  mem://constraints/ci-push-trigger-unfiltered
│     → APPLY bare `on: push:` — no branches/paths filters.
│
├── "modify spec/* or planning"
│     → READ  mem://workflow/planning-roadmap + spec/00-what-to-read-first.md
│     → APPLY root plan.md is SOT; spec dirs need README with H1+Overview+Files.
│
├── "modify skipped/ or .release/"
│     → STOP. Read mem://constraints/skipped-folders. Do not proceed.
│
└── "anything UI / visual"
      → READ  mem://preferences/dark-only-theme + mem://architecture/ui-framework-selection
      → APPLY dark-only HSL tokens; no light mode toggle.
```

If your request is not covered, fall back to `spec/01-quickstart-for-blind-ai.md` + `mem://index.md` Core rules.

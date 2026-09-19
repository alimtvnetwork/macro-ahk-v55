# Blind AI Implementation Audit & Gap Analysis

**Premise:** Simulate a low-grade LLM (think GPT-3.5-class / 7B local model) building this project from scratch using only the prompts, specs, and memory rules in the repo. For each of 100 steps, identify what such a model would **plausibly implement correctly**, what it would **partially fumble**, and what it would **miss entirely** — then list the concrete gap evidence (file references, spec drift, missing rules).

## Method

Each step focuses on one slice (a spec doc, a memory rule, a subsystem, or a workflow). For each step we record:

- **Slice** — what part of the system is under audit.
- **Source(s)** — spec / memory / code paths consulted.
- **Blind-AI Likely Output** — what a low-grade LLM would produce from prompts alone.
- **Actual Implementation** — what the repo really contains.
- **Gap** — drift between spec, memory, and code.
- **Severity** — Low / Med / High / Critical.
- **Recommendation** — what to change in spec/memory/code to close the gap.

## Batching Protocol

- User says **"next 10"** → AI completes steps N+1 … N+10 in `steps/` as individual `.md` files (e.g. `step-001.md` … `step-010.md`).
- After each batch, AI appends a one-line summary to `progress.md`.
- 100 steps total → 10 batches.

## Step Plan (1–100)

Grouped into 10 batches of 10. Each batch targets a coherent layer so findings compound.

### Batch 1 (Steps 1–10) — Foundational specs & onboarding
1. `spec/00-overview.md` — does it give enough context for a blind AI to bootstrap?
2. `spec/01-spec-authoring-guide` — completeness of authoring rules.
3. `spec/01-spec-authoring-guide/09-exceptions.md` vs `mem://constraints/readme-txt-prohibitions`.
4. `readme.md` "For AI Agents" section vs `.lovable/what-to-read.md`.
5. `.lovable/memory/what-to-read.md` discoverability.
6. `.lovable/overview.md` vs `spec/00-overview.md` drift.
7. `spec/17-consolidated-guidelines` — single source of truth check.
8. `spec/02-coding-guidelines` vs `.lovable/coding-guidelines.md`.
9. `spec/02-coding-guideline-audit.md` — is it current?
10. Folder-numbering convention (00–20 foundations, 21+ app) — is the rule written anywhere a blind AI would find?

### Batch 2 (Steps 11–20) — Error & logging contracts
11. `spec/03-error-manage` completeness.
12. CODE RED file-path error logging (mem) vs actual error sites in `src/`.
13. Namespace `Logger.error()` rule vs bare `console.error` occurrences.
14. Failure-log mandatory shape (Reason, ReasonDetail, SelectorAttempts, VariableContext).
15. Verbose logging gate (`Project.VerboseLogging`).
16. JS-step diagnostics (`buildJsStepFailureReport`).
17. Form snapshot capture rule.
18. Error swallow audit generator output (`public/error-swallow-audit.json`).
19. No-retry policy enforcement across codebase.
20. Webhook fail-fast (single-attempt) vs any retry helper imports.

### Batch 3 (Steps 21–30) — Data & storage
21. `spec/04-database-conventions` vs actual SQLite schema.
22. `spec/05-split-db-architecture` — split implementation status.
23. `spec/06-seedable-config-architecture` vs `instruction.ts`.
24. 4-tier storage memory rule vs actual key usage.
25. No-Storage-PascalCase-Migration constraint — any violations?
26. IndexedDB JsonCopy/HtmlCopy dual cache.
27. OPFS 7-day prune.
28. `chrome.storage.local` key audit.
29. Namespace database creation (max 25, System.* reserved).
30. Data type definitions (SqlValue, JsonValue, CaughtError) usage.

### Batch 4 (Steps 31–40) — Auth & credit
31. Unified `getBearerToken()` contract — any legacy callers left?
32. Token readiness gate (10s budget) implementation.
33. Token retrieval waterfall (zero-network).
34. Credit monitoring retry-once-on-refresh.
35. `pro_0` credit balance rule (total_granted etc.).
36. Credit Totals exclude FREE tier (v3.31.0).
37. Post-move credit sync (v3.40.0) — `await fetchAndPersist` then `fetchAsync`.
38. Auth bridge service TTL handling.
39. Workspace badge classifier (Cancel/Expire/Expired/Refill).
40. Workspace tooltip + Members popup behavior.

### Batch 5 (Steps 41–50) — Macro recorder & replay
41. `spec/31-macro-recorder` coverage.
42. Recorder keyboard shortcuts (Ctrl+Alt+P / ; / .).
43. Form snapshot on Submit/Type/Select.
44. Step library export bundle.
45. Step-wait test coverage.
46. Condition evaluator / condition step.
47. Data source parsers.
48. Dropzone overlay UX.
49. Hover highlighter behavior.
50. Replay failure → failure-log shape compliance.

### Batch 6 (Steps 51–60) — Extension lifecycle & injection
51. 6-phase extension lifecycle vs code.
52. 7-stage script injection lifecycle (background MAIN world).
53. Auto-injector new-tab guard (`isNewTabOrBlankUrl`).
54. Project-matcher new-tab guard.
55. Injection cache build-aware invalidation.
56. Self-healing script storage (`builtin-script-guard.ts`).
57. Injection visibility (`console.groupCollapsed`).
58. Dynamic script loading (`RiseupAsiaMacroExt.require`).
59. Message relay 3-tier system.
60. Platform adapter pattern.

### Batch 7 (Steps 61–70) — Build, CI/CD, versioning
61. `spec/12-cicd-pipeline-workflows` vs `.github/workflows/`.
62. CI push trigger unfiltered constraint (bare `on: push:`).
63. Canary workflow `ping.yml`.
64. CI trigger policy test.
65. Release watcher self-heal tag.
66. Automated version validation (manifest, constants, scripts sync).
67. Build artifact preservation (`emptyOutDir: false`).
68. Vite build environment (static top-level Node imports).
69. Build lock sentinel (`.lovable/build.lock`).
70. Sourcemap strategy (dev inline / prod none).

### Batch 8 (Steps 71–80) — UI, design system, theme
71. `spec/07-design-system` vs `index.css` / `tailwind.config.ts`.
72. Dark-only theme enforcement.
73. CSS injection sentinel (`#marco-css-sentinel`).
74. Diagram visual standards.
75. View transition patterns.
76. Animation strategy (Tailwind + CSS keyframes only).
77. Selector standards (data- attributes).
78. UI framework selection — React rejected, modular UIManager.
79. `spec/08-docs-viewer-ui` vs implementation.
80. `spec/09-code-block-system` vs implementation.

### Batch 9 (Steps 81–90) — Workflow rules & meta
81. No-Questions Mode protocol — ambiguity log folder usage.
82. Question-asking style rule.
83. `next` command convention.
84. Task execution pattern (RCA → list → next).
85. Readiness reports requirement.
86. Test-with-features rule.
87. Suggestions convention single-file tracking.
88. File naming numeric convention.
89. Documentation standards (readme, CHANGELOG, CONTRIBUTING).
90. Root readme authoring order.

### Batch 10 (Steps 91–100) — Cross-cutting & verdict
91. `id-denylist` ESLint rule current scope vs memory plan.
92. Type-safety standards (no `unknown` except CaughtError).
93. Formatting & logic (CQ14 braces, CQ15 newlines).
94. Constant naming convention (ID_/SEL_/ATTR_/CSS_).
95. Config defaults extraction pattern.
96. Injection context awareness (MAIN-world only SDK).
97. Deployment diagnostics (`browser-deploy.ps1`).
98. Linting policy zero-warning enforcement.
99. Author identity & branding consistency.
100. **Final verdict** — score Blind-AI implementation coverage % and list top 10 blockers.

## Output Files

```
spec/audit/blind-ai-implementation-audit/
├── README.md            (this file)
├── progress.md          (running batch summaries)
└── steps/
    ├── step-001.md … step-100.md
```

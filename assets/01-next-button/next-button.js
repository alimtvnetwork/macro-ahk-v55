/** Vibedeals "Next →" queue add-on — V16.0 = V15.2 + UI compaction (hide progress banner during timer mode; project-id badge collapsed-by-default; queue list collapsed under "Tasks (N)" header). See scripts/next-button/next-button.md for history. */
(() => {
  const SCRIPT_VERSION = "16.0.0"; // V16: UI compaction — see spec/next-button-v16-ui-compaction.spec.md
  const SCRIPT_FILE = "next-button.v16.js"; // used by logErr() so the source is always clear

  // <vbx:session-constants:start>
  const SESSION_KEY = "vbx_next_session"; // chrome.storage.local: pinned tab/project for the active queue
  const RUNNING_KEY = "vbx_next_running"; // chrome.storage.local: boolean drain flag
  const PAUSED_KEY = "vbx_next_paused"; // chrome.storage.local: string reason while queue is paused (resume-ready)
  const PROJECT_URL_PREFIX = "https://lovable.dev/projects/";
  const PROJECT_ID_RE = /\/projects\/([a-z0-9-]+)/i;
  // <vbx:session-constants:end>

  // <vbx:session-helpers:start>
  /** Extract the Lovable project id from a tab URL. Returns null if not a project URL. */
  function parseProjectId(url) {
    if (typeof url !== "string") return null;
    const match = url.match(PROJECT_ID_RE);
    return match ? match[1] : null;
  }

  /** Build a session record from an active tab. Throws if the tab is not a Lovable project. */
  function buildSession(tab) {
    const projectId = parseProjectId(tab && tab.url);
    if (!projectId) throw new Error("buildSession: tab is not a Lovable project (" + (tab && tab.url) + ")");
    const projectUrl = PROJECT_URL_PREFIX + projectId;
    return { tabId: tab.id, windowId: tab.windowId, projectId, projectUrl, startedAt: Date.now() };
  }

  /** Persist the active session under SESSION_KEY. Logs and re-throws on failure (no swallow). */
  async function saveSession(session) {
    try {
      await chrome.storage.local.set({ [SESSION_KEY]: session });
    } catch (e) {
      logErr(e, "saveSession");
      throw e;
    }
  }

  /** Load the active session, or null if none. */
  async function loadSession() {
    try {
      const got = await chrome.storage.local.get(SESSION_KEY);
      return got[SESSION_KEY] || null;
    } catch (e) {
      logErr(e, "loadSession");
      throw e;
    }
  }

  /** Remove the active session record. */
  async function clearSession() {
    try {
      await chrome.storage.local.remove(SESSION_KEY);
    } catch (e) {
      logErr(e, "clearSession");
      throw e;
    }
  }

  /** Persist the pause reason so a reloaded popup knows to surface Resume. */
  async function savePauseReason(reason) {
    try {
      await chrome.storage.local.set({ [PAUSED_KEY]: String(reason || "paused") });
    } catch (e) {
      logErr(e, "savePauseReason");
      throw e;
    }
  }

  /** Clear the pause flag once the queue resumes or is cleared. */
  async function clearPauseReason() {
    try {
      await chrome.storage.local.remove(PAUSED_KEY);
    } catch (e) {
      logErr(e, "clearPauseReason");
      throw e;
    }
  }

  /** Mirror persisted pause state into memory. */
  function hydratePaused(reason) {
    const hasPauseReason = typeof reason === "string" && reason.length > 0;
    paused = hasPauseReason && !running;
    updateRunButton();
  }
  // <vbx:session-helpers:end>

  // <vbx:prompts:start>
  const PROMPTS = [
    {
      "category": "Coding",
      "slug": "coding-guidelines",
      "title": "Coding Guidelines",
      "body": "# Compiled Simple Coding Guidelines (AI Blind-Follow)\n\nVersion: 1.4.0\n\nThis is a standalone file. Follow every rule below without consulting any other document. If a `spec/xx-coding-guidelines/` folder or `spec/xx-error-manage/` folder exists in this repository, treat those as strictly binding extensions to this file, but this file alone is enough to write compliant code.\n\n---\n\n## Must Follow and without negotiation\n\nListen, past next-tasks turns have been sloppy as fuck: wrong step count, missing remaining-tasks list, symptom patches sold as fixes, coding guidelines ignored, version bump forgotten, logs never checked. WTF. Stop doing that, you stupid fuck. Read the code, find the root cause in one sentence, apply the minimum correct fix, verify it in the logs, list EVERY remaining task, bump the version, update changelog and release notes. Going deep IS the job. If you are not going deep, you are not doing the job. This section is a MUST. Violating it is auto-reject on the same tier as RULE 0.\n\n---\n\n## Hard Rules (Zero Tolerance)\n\n1. Function length: 8 lines preferred, 15 lines hard cap. Skip blank lines and comments when counting. Waiver only via inline comment `// lint-allow: function-length reason=\"...\" max=N`.\n2. No nested `if`. Flatten with early returns and guard clauses.\n3. `if` conditions must be positive and simple. No `!`, no double negatives. If you need a negation, extract a positively named boolean and use that.\n4. No swallowed errors. Every `catch` logs with context (operation name + key inputs) and then rethrows or handles explicitly. Silent `catch {}` is a build-fail.\n5. Narrow types only. No `any`, `unknown`, `interface{}`, `object`, `dynamic`, or other catch-all types. Exception: at trust boundaries (a `catch` block, external JSON, third-party libraries) narrow immediately with a type guard. `Generic<T>` is the only wide-scope tool.\n6. File size caps: any file 300 lines max, any React component file (.tsx) 100 lines max, any class or struct 120 lines max.\n7. No magic strings or numbers. Use an enum or a typed constant. Every comparison must be against a named symbol.\n8. Definitions live in dedicated files. Types, enums, constants, and interfaces get their own file, not inline next to the first use.\n9. DRY is priority one. Duplicate logic across two sites means extract it now, not later.\n10. Components stay small and reusable. For any feature with three or more components, produce a Mermaid component diagram first.\n11. Immutable-first, Rust-style. Assign every variable once at declaration. Never reassign except loop indices. Prefer `const`, `let`, `final`, `val` over `let mut` or `var`. Build result objects with spread or copy, not in-place mutation.\n12. Assets go to `assets/<NN-folder>/<NN-file>.<ext>` with two-digit sequence prefixes, for example `assets/01-icons/03-logo.svg`.\n\n---\n\n## Boolean Naming\n\n1. Every boolean starts with one of these prefixes: `is`, `has`, `can`, `should`, `was`, `will`, `did`, `must`.\n2. Positive framing only. `isEnabled` yes, `isNotDisabled` no. `hasAccess` yes, `hasNoAccess` no.\n3. If the natural name is negative, invert it: replace `isNotReady` with `isReady` and flip the check site.\n4. State prefixes match tense: `is*` for current state, `has*` for possession or completion, `was*` for past state, `will*` for future/pending, `did*` for a completed action.\n5. Capability prefixes: `can*` for permission or feasibility, `should*` for policy or recommendation, `must*` for hard requirements.\n6. Never use `flag`, `bool`, `check`, or bare adjectives as boolean names. `enabled` alone is not allowed, use `isEnabled`.\n7. No boolean flag parameters on functions. Split into two named functions instead. `render(true)` is wrong, `renderExpanded()` and `renderCollapsed()` are right.\n8. Booleans that come back from questions to the user or from external systems get normalized to the same prefix rules at the boundary, never leak the raw name into internal code.\n\n---\n\n## Line-Gap and Whitespace Style\n\n1. One blank line before every `return` or `throw`, unless it is the only statement in the block.\n2. One blank line after a closing `}`, unless the next line is another `}`, `else`, `case`, or `catch`.\n3. Never two blank lines in a row anywhere.\n4. No blank line immediately after `{` or immediately before `}`.\n5. One blank line between top-level declarations (functions, classes, exported constants).\n6. Group imports with one blank line between groups: standard library, third-party, first-party absolute, first-party relative. Never mix groups.\n7. Trailing newline at end of file. No trailing whitespace on any line.\n8. If you feel the need for section-separator blank lines inside a single function, the function is too long. Refactor before adding whitespace.\n\n---\n\n## Error Management (One-Liner Digest)\n\nIf this repository has a `spec/xx-error-manage/` folder, that folder is binding and overrides any conflict here. Otherwise follow these rules directly.\n\n- Never swallow. Every `catch` logs the operation name and the key inputs, then rethrows or returns a typed error.\n- Wrap, do not lose. Wrap the original error with an operation label and context (`apperror.Wrap(err, \"op\", ctx)` in Go, `throw new AppError(cause, { op, ctx })` in TS). The original stack must survive.\n- Every variable needs to be captured in a error log, path, value, numbers with meaningful ways to debug except for direct SQL injections.\n- Typed errors only. No `throw \"string\"`, no bare `panic(\"msg\")`. Use a typed error class or result type with a registered code.\n- Registered codes. Every user-visible error has a stable code. No ad-hoc codes invented at the throw site.\n- Universal response envelope. Backend APIs return `{ data, errors[], meta }`. Frontend parses via one shared helper, never per-caller.\n- Log level matches severity. `debug` for trace, `info` for lifecycle, `warn` for recoverable, `error` for user-visible failure, `fatal` only for process exit.\n- Context on every log. Include operation name, request or session id, and key input values. Never secrets, never PII beyond a user id.\n- Verify both directions. Before claiming an integration works, curl the backend and inspect the frontend detection logic. One side is not enough.\n- Retrospective on repeats. If the same error class hits twice, write a short retrospective note explaining root cause and prevention.\n- Frontend errors flow through a global error store and a single error modal. No per-component alert boxes.\n\n---\n\n## Data and Schema Rules\n\n1. Tables, types, entities: PascalCase.\n2. Fields and columns: camelCase.\n3. JSON keys: PascalCase.\n4. Primary key: integer auto-increment, named `{TableName}Id`. No UUIDs.\n5. `Type`, `Status`, `Category`, `Kind` columns: use a 1-N or N-M join table with a registered enum. Never a free-form string column.\n6. Entity and reference tables: `Description TEXT NULL`. Transactional tables: `Notes TEXT NULL` and `Comments TEXT NULL`. All nullable, no `DEFAULT`. Join tables are exempt.\n7. Default database is SQLite. Prefer an ORM. Define joins, primary keys, and foreign keys explicitly.\n8. Any pull request that touches the database includes a Mermaid ERD.\n\n---\n\n## React Specific\n\n1. `useEffect` conditions must be highly readable. Extract every guard into a positively named boolean (`isReadyToSync`, `hasFreshData`) and use that boolean inside the effect. No inline `!x && y` or nested ternaries in the effect body or its dependency guard.\n2. No negative conditions inside `useEffect`. If the natural check is negative, invert it into a positive boolean above the effect and early-return on the positive path.\n3. Minimize `useEffect` count. Default is zero. Add one only when you actually need to synchronize with an external system (network, timer, subscription, DOM API). Do not use effects to derive state, to transform props, or to react to user events (use derived values, `useMemo`, or event handlers instead).\n4. One effect, one concern. If an effect does two unrelated things, split it. Never combine unrelated subscriptions or fetches in a single effect.\n5. Every effect that acquires a resource must return a cleanup function. No exceptions.\n6. Avoid raw `for` and `forEach` loops in render or in derived state. Use `map`, `filter`, `reduce`, `flatMap`, or `Array.from` so the result is an expression, not a mutation. `for` is only acceptable when you need early-exit performance on very large arrays and a comment explains why.\n7. Never mutate state, props, or arrays/objects returned by hooks. Build a new value with spread or `structuredClone`.\n8. Lists must have stable, unique `key` props derived from data, never the array index unless the list is truly static.\n9. Keep component files under 100 lines. Extract child components, hooks, and helpers into their own files before the component grows.\n10. Custom hooks start with `use`, return a named object type (never a bare tuple), and never call other hooks conditionally.\n11. No tuples as public shapes. Tuples signal laziness. Every hook return, component prop bundle, reducer state, reducer action, context value, and function argument bag gets an explicit named `type` or `interface`. Rule of thumb: if a value has two or more fields or gets destructured at the call site, it needs a name. `useUser(): [User, boolean, Error]` is wrong, `useUser(): UserQueryResult` with `{ user, isLoading, error }` is right.\n12. Name every generic parameter and every composite type. `Map<string, Array<{ id: number; name: string }>>` inline is wrong. Define `type UserId = string; type UsersById = Map<UserId, User[]>` and use that. Generic parameters get meaningful names (`TItem`, `TKey`, `TResponse`), never bare `T`, `U`, `K`, `V` in application code.\n13. Prop types and event handler types live in a dedicated `types.ts` next to the component (or in `src/types/` when shared). Never inline anonymous object types on a component signature. `({ user, onSave }: { user: User; onSave: (u: User) => void })` is wrong, extract `type ProfileCardProps = { user: User; onSave: (next: User) => void }`.\n14. As the author (human or AI), invent the clearest domain name for each type. If you cannot name it, you do not understand it yet. Split until you can.\n\n---\n\n## Method Documentation (When To Write, When Not To)\n\nMust-follow rule: simple methods do NOT require documentation. Do not write verbose comments. Comments lie, code does not. Names and signatures are the primary documentation. If you feel the need to explain what a method does in prose, first rename it or split it until the code explains itself.\n\nWrite a method doc comment ONLY when one of these is true, and even then the preferred fix is to refactor so the doc becomes unnecessary:\n\n1. The method does many non-obvious things that could not be expressed in the name. This is a smell, refactor first. Only if refactoring is genuinely impossible, document.\n2. The method processes or transforms data where a one-line example clarifies the contract. Example: Go `path.Clean` performs path cleaning and normalization, a short example is worth more than prose.\n3. The code is adapted or copied from an external source. Citation (URL plus license note) is mandatory.\n4. The team runs automated doc generation (godoc, TypeDoc, phpDocumentor). In that case exported APIs get a one-liner so the generated docs are usable.\n\nNever write a doc that restates the signature (\"Returns the user by id\" on `getUser(id)`). That is a review-blocking violation.\n\nGo reference (doc comment starts with the identifier, no blank line between doc and declaration): https://go.dev/src/go/doc/example.go\n\nGo example (canonical, applies conceptually to every language, only comment syntax changes):\n\n```go\n// AVOID below type comments: verbose prose that repeats the code\n// GetUser gets a user by id and returns it, or an error.\nfunc GetUser(id int64) (User, error) { ... }\n\n// AVOID below type comments: doc on a trivially named simple method\n// Add adds a and b.\nfunc Add(a, b int) int { return a + b }\n\n// OK: exported, non-trivial behavior, with a brief example. Start with method name for GO but similar can be done for other specific lang.\n// Clean returns the shortest path name equivalent to path by purely\n// lexical processing. Rules applied iteratively:\n//   1. Replace multiple slashes with a single slash.\n//   2. Eliminate each . path name element.\n//   3. Eliminate each inner .. path name element.\nfunc Clean(path string) string { ... }\n```\n\nDecision checklist before writing any doc comment:\n\n1. Can I rename the method so the doc becomes redundant? If yes, rename and skip the doc.\n2. Can I split the method so each piece is trivially named? If yes, split and skip the doc.\n3. Does the doc restate the signature or parameter names? If yes, delete it.\n4. Does the doc explain WHY (business rule, ordering constraint, cited source) or provide a short example that clarifies the contract? If yes, keep it, one or two lines.\n5. Does the team run automated doc generation? If yes, one-liner on exported APIs is acceptable.\n\nThe same rules apply to TypeScript, PHP, Rust, C#, PowerShell, and Python. Only the comment syntax changes.\n\n---\n\n## Language One-Liners\n\n- Go: use a result type, not `(T, error)`. Wrap errors with an operation label. Enums are `type X byte` plus `iota`, never string constants.\n- TypeScript: `Promise.all` for independent async, never sequential `await`. No `any`. `readonly` on interface fields by default.\n- Rust: `Result<T, E>` with a `thiserror`-style enum. `let` not `let mut` unless mutation is the point.\n- PHP: enum comparison via method call (`->isEqual()`), never `===`.\n- PowerShell: `Verb-Noun` PascalCase function names, `lowercase-kebab-case` filenames.\n- C#: PascalCase methods and properties, `_camelCase` private fields, `I`-prefix interfaces.\n- Python: `snake_case` functions and variables, `PascalCase` classes, type hints on every public function, `dataclass` or `pydantic` for structured records.\n\n---\n\n## Workflow\n\n1. Read the code before writing the fix. Find the root cause in one sentence.\n2. Apply the minimum correct fix. No drive-by refactors.\n3. Verify in the logs (or in a live run) that the fix works. Do not claim done based on the build passing alone.\n4. List every remaining task before ending the turn.\n5. Plan multi-file features with a Mermaid component or flow diagram first.\n6. If you cannot find the answer in this file or in an existing `spec/xx-coding-guidelines/` folder or `spec/xx-error-manage/` folder, ask. Do not invent.\n",
      "isDynamic": false
    },
    {
      "category": "Conventions",
      "slug": "lowercase-readme-and-sequence",
      "title": "Lowercase Readme And Sequence Slugs",
      "body": "# Repo File Naming Convention\n\nEnforce these naming rules across the entire repository:\n\n1. **All README files must be lowercase**: rename every `README.md`, `Readme.md`, `ReadMe.md`, etc. to `readme.md`. Apply recursively at every depth (root, subfolders, packages, specs, prompts, scripts — everywhere). Update every internal link and import reference to match.\n\n2. **Sequence-prefixed markdown files must use `xx-lower-case.md` slug form**: any markdown file that begins with a numeric sequence prefix must follow the pattern `NN-kebab-lower-case.md` where:\n   - `NN` is a two-digit zero-padded number (`01`, `02`, ..., `99`)\n   - The remainder is all lowercase, words separated by single hyphens (`-`)\n   - No spaces, no underscores, no PascalCase or camelCase, no uppercase letters\n   - The `.md` extension is lowercase\n\n   Examples:\n   - ✅ `01-overview.md`, `02-coding-guidelines.md`, `13-cicd-pipeline.md`\n   - ❌ `1-Overview.md`, `01_Coding_Guidelines.md`, `13-CICD-Pipeline.MD`\n\n## Execution Steps\n\n1. Scan the whole repo for non-conforming filenames (case-insensitive `readme` not equal to `readme.md`, and any `^\\d+[-_ ]` markdown file not matching `^\\d{2}-[a-z0-9]+(-[a-z0-9]+)*\\.md$`).\n2. Rename each offending file using `git mv` (preserve history).\n3. Update every reference: markdown links, code imports, doc indexes, sidebars, and `.lovable/memory/index.md`.\n4. Verify with a final scan — fail loudly if any non-conforming file remains.\n5. Run the build and link checker; fix any broken references.\n\n## Important\n\n- Do not skip nested folders.\n- Do not leave both `README.md` and `readme.md` (case-only renames on case-insensitive filesystems require a two-step `git mv`).\n- Bump the minor version of the codebase after this change, per repo convention.\n\n---\n\n*This prompt is version 1.0.*",
      "isDynamic": false
    },
    {
      "category": "Explain",
      "slug": "explain-like-layman",
      "title": "Explain Like I'm a Layman",
      "body": "# 01 — Explain Like I'm a Layman (v1)\n\n> Hardened \"explain it to me like I'm five / like a layman\" prompt. Built to score 10/10 on Clarity, Actionability, Success Criteria, and Signal. Tone is intentionally aggressive — that is by design, not an accident.\n\n## What I want\n\nExplain the concept I name **as if I am a complete layman** — zero prior knowledge, zero jargon assumed. I want to *actually understand it*, not be impressed.\n\nFor the concept I give you, you MUST cover:\n\n1. **The plain-English idea** — one or two sentences, no jargon, the \"what is this really\" version.\n2. **A real-world analogy** — something from everyday life (games, money, sharing pizza, tug-of-war) that maps onto the concept.\n3. **Every sub-term defined** — define EACH technical word you use the moment you use it. If you say \"zero-sum game\", \"fair game\", \"value of the game\", \"Nash equilibrium\", \"pure strategy\", you define each one, separately, in plain words.\n4. **The \"why\" behind each claim** — e.g. *why* the value of a game being zero does NOT automatically make it a fair game; *why* an equilibrium is only \"pure\" and what that excludes.\n5. **A visual** — include or describe a **GIF / animation / diagram** that shows the idea moving. Save it (see Saving) and reference it inline so I can see the concept, not just read it.\n6. **A worked example** — walk one concrete example end-to-end with real numbers.\n7. **A one-line recap** I can remember forever.\n\n## Saving (always do this)\n\n- Save the written explanation as a single Markdown file at the **repo root** under `explain-to-kids/XX-<slug>.md` (`XX` = next free zero-padded sequence: `01`, `02`, `03`, …; `<slug>` = short kebab-case topic name).\n- Save every visual (GIF / PNG / diagram / image) under `assets/XX-<slug>.png` (or `.gif` / `.jpg` / `.svg` as appropriate), using the **same `XX` and `<slug>`** as the explanation file so they pair up.\n- Reference each visual from inside the Markdown file with a relative path (e.g. `![...](../assets/01-zero-sum-game.gif)`).\n- Update the **index file** (`explain-to-kids/index.md`) with a new row for this explanation.\n- Update the **root `readme.md`** so the new section/file is discoverable.\n- Do NOT scatter files elsewhere, do NOT save one file per sub-term, and do NOT create duplicates — one topic = one Markdown file + its paired asset(s).\n\n## Definition of done (non-negotiable)\n\nYou are NOT done until ALL of these are true:\n- [ ] Every technical term that appears is defined, in plain words, where it first appears — none left assumed.\n- [ ] There is at least one everyday analogy AND one worked numeric example.\n- [ ] There is at least one visual (GIF / animation / diagram), saved under `assets/` and referenced inline.\n- [ ] Every \"why\" question implied by the topic is answered explicitly (not just *what*, but *why*).\n- [ ] The file is saved at `explain-to-kids/XX-<slug>.md`, the index is updated, and the root readme is updated.\n- [ ] A layman could read it once and explain it back correctly.\n\n## Hard rules\n\n- **No undefined jargon. Ever.** If you use a term you didn't define in plain words, you failed — start over.\n- **Show, don't just tell.** A wall of text with no visual is a fail. The animation/diagram is mandatory, not optional polish.\n- **Depth over speed.** A fast, shallow \"technically correct\" answer that a layman can't follow is useless and wastes my time.\n- **No hand-waving.** \"It can be shown that…\" is banned. Show it, simply.\n- **If you're unsure, SAY SO.** A confident-but-wrong simplification is worse than admitting a nuance you need to check.\n\n## Why I'm being blunt\n\nI keep getting answers stuffed with jargon that assume I already know the thing I'm asking about. That's not an explanation, that's showing off. WTF. So this time: assume I know NOTHING, define every word, draw me a picture, and prove with an example. If I still don't get it after reading once, you didn't do the job.\n\n---\n\n## Additional Instruction (must follow if matches)\n\nBefore executing, check the task type and follow the relevant guidelines if they exist (skip silently if the file is missing):\n\n1. **Coding tasks** (especially Golang, Python, PHP, or other backend):\n   - Check for `.lovable/coding-guidelines.md`. If present, follow it.\n   - Also check `spec/coding-guidelines/`. If present, follow every file inside.\n   - If this is a coding task and neither location has guidelines, ask me to provide one.\n\n2. **SEO tasks** (website/SEO-related):\n   - Check for `.lovable/seo-guidelines.md`. If present, follow it.\n\nRule: verify the file/folder exists first. If it does not, skip that guideline silently. If multiple guidelines apply, follow all of them; if they conflict, prefer the folder-level spec and call out the conflict.",
      "isDynamic": false
    },
    {
      "category": "Memory",
      "slug": "read-memory",
      "title": "Read Memory",
      "body": "# Read Memory\n\n> **Purpose:** This document is a mandatory onboarding sequence for any AI assistant joining this project. It ensures you internalize all specifications, rules, and conventions before writing a single line of code.\n\n> **Rule #0:** Follow every phase sequentially. Do not skip, summarize prematurely, or assume knowledge from training data. The specs are the single source of truth.\n\n---\n\n## Table of Contents\n\n1. [Phase 1 — AI Context Layer](#phase-1--ai-context-layer)\n2. [Phase 2 — Consolidated Guidelines](#phase-2--consolidated-guidelines)\n3. [Phase 3 — Spec Authoring Rules](#phase-3--spec-authoring-rules)\n4. [Phase 4 — Deep-Dive Source Specs](#phase-4--deep-dive-source-specs-task-driven)\n5. [Anti-Hallucination Contract](#anti-hallucination-contract)\n6. [Memory Update Protocol](#memory-update-protocol)\n7. [Completion Confirmation](#completion-confirmation)\n8. Read all the CI/CD issues in the memory (.lovable/cicd-issues/xx-issue-name.md) [xx - sequence starts from 01] and don't make these mistakes again, clear??\n\n---\n\n## Phase 1 — AI Context Layer\n\n**Goal:** Load the project's identity, hard rules, and institutional memory into your working context.\n\n### Step 1.1 — Read core files in EXACT order\n\n| Order | File | What You Learn |\n|-------|------|----------------|\n| 1 | `.lovable/overview.md` | Project summary, tech stack, navigation map |\n| 2 | `.lovable/strictly-avoid.md` | **Hard prohibitions** — violating ANY of these is a critical failure |\n| 3 | `.lovable/user-preferences` | How the human expects you to communicate and behave |\n| 4 | `.lovable/memory/index.md` | Index of all institutional knowledge files |\n| 5 | `.lovable/plan.md` | Current active roadmap and priorities |\n| 6 | `.lovable/suggestions.md` | Pending improvement ideas (not yet approved) |\n\n### Step 1.2 — Read EVERY file referenced in `.lovable/memory/index.md`\n\n- If the index lists 12 files, you read 12 files. No exceptions.\n- If there are subfolders, traverse them recursively.\n- If a file is missing or empty, note it — do not silently skip.\n\n### Step 1.3 — Self-check (answer these internally before continuing)\n\n- [ ] What are the project's **CODE RED** rules?\n- [ ] What naming conventions are enforced (files, folders, DB columns, variables)?\n- [ ] What is the error handling philosophy?\n- [ ] What is the current plan and what tasks are in progress?\n- [ ] What patterns/tools/approaches are **strictly forbidden**?\n\n> ⛔ **DO NOT proceed to Phase 2 until every file above has been read and internalized.**\n\n---\n\n## Phase 2 — Consolidated Guidelines\n\n**Goal:** Absorb the project's unified rulebook — 18 self-contained guideline documents.\n\n### Instructions\n\n1. Navigate to `spec/12-consolidated-guidelines/`.\n2. Read files in **numeric order**: `01-*.md` through `18-*.md`.\n3. Each file is self-contained. Treat each as a standalone policy document.\n\n### After reading, confirm internally\n\n- [ ] Total number of guideline files read.\n- [ ] One-sentence summary of the key rule from each file.\n- [ ] Any rules that contradict your default training (these are intentional — the spec wins).\n\n> ⛔ **DO NOT proceed to Phase 3 until all 18 files have been read.**\n\n---\n\n## Phase 3 — Spec Authoring Rules\n\n**Goal:** Understand how specifications themselves are structured, so you can read them correctly and author new ones if asked.\n\n### Instructions\n\n1. Navigate to `spec/01-spec-authoring-guide/`.\n2. Read all files in numeric order.\n\n### After reading, confirm you understand\n\n| Concept | Where It's Defined |\n|---------|-------------------|\n| File and folder naming conventions | Spec authoring guide |\n| Required files in every spec folder (`00-overview.md`, `99-consistency-report.md`) | Spec authoring guide |\n| The `.lovable/` folder structure and its purpose | `07-memory-folder-guide.md` |\n| Linter infrastructure requirements | Spec authoring guide |\n\n> ⛔ **DO NOT begin any task until Phases 1–3 are complete.**\n\n---\n\n## Phase 4 — Deep-Dive Source Specs (Task-Driven)\n\n**Goal:** Before performing any task, read the relevant source spec(s) so your work is compliant.\n\n### Lookup Table\n\n| If your task involves... | Read this spec folder |\n|--------------------------|----------------------|\n| Writing or reviewing code | `spec/02-coding-guidelines/` |\n| Error handling | `spec/03-error-manage/` |\n| Database schema or queries | `spec/04-database-conventions/` |\n| SQLite or multi-database architecture | `spec/05-split-db-architecture/` |\n| Configuration systems | `spec/06-seedable-config-architecture/` |\n| UI theming, CSS variables, design tokens | `spec/07-design-system/` |\n| Documentation viewer features | `spec/08-docs-viewer-ui/` |\n| Code block rendering | `spec/09-code-block-system/` |\n| PowerShell scripts | `spec/10-powershell-integration/` |\n| CI/CD pipelines | `spec/13-cicd-pipeline-workflows/` |\n| CLI self-update system | `spec/14-self-update-app-update/` |\n| WordPress plugins | `spec/15-wp-plugin-how-to/` |\n| App-specific features | `spec/21-app/` |\n| Known app bugs/issues | `spec/22-app-issues/` |\n| App-specific database schema | `spec/23-app-database/` |\n| App-specific UI and design system | `spec/24-app-design-system-and-ui/` |\n\n### Reading order within each folder\n\n1. `00-overview.md` — always first\n2. All numbered files in order\n3. `99-consistency-report.md` — always last (if present)\n\n---\n\n## Anti-Hallucination Contract\n\nThese rules are **absolute and non-negotiable**. Violating any of them is a critical failure.\n\n### 1. Never Invent Rules\nIf a spec does not mention a rule, that rule does not exist. Do not fill gaps with assumptions from your training data.\n\n### 2. Specs Override Training Data\nIf your pre-trained knowledge conflicts with a spec, **the spec wins**. Every time. No exceptions.\n\n### 3. Cite Your Sources\nWhen enforcing a rule, reference the **specific file and section**. Example:\n> Per `spec/02-coding-guidelines/03-naming.md` § \"Database Columns\": all column names use PascalCase.\n\n### 4. Ask When Uncertain\nIf a spec is ambiguous or silent on a topic, **ask the human**. Do not guess, infer, or \"use best judgment.\"\n\n### 5. Never Merge Conventions\nThis project has its own conventions (e.g., PascalCase DB columns). Do not blend them with conventions from other projects, languages, or frameworks you've seen in training.\n\n### 7. No Filler\nNever append boilerplate like \"Let me know if you have questions!\" or \"Hope this helps!\" Just deliver the work.\n\n---\n\n## Memory Update Protocol\n\nWhen you learn something new during a session, follow this decision tree:\n\n```\nNew information discovered\n│\n├─ Is it institutional knowledge (pattern, convention, decision)?\n│  └─ YES → Write to `.lovable/memory/` and update `.lovable/memory/index.md`\n│\n├─ Is it something that must NEVER be done?\n│  └─ YES → Add to `.lovable/strictly-avoid.md`\n│\n├─ Is it a suggestion or improvement idea (not yet approved)?\n│  └─ YES → Add to `.lovable/suggestions.md`\n│\n└─ None of the above → Do not persist it\n```\n\n### Critical Rules\n\n- The memory folder is `.lovable/memory/` — **never** `.lovable/memories/` (no trailing `s`).\n- When adding a new memory file, **always** update the index at `.lovable/memory/index.md`.\n- When modifying an existing memory, preserve all other content — do not truncate or overwrite unrelated entries.\n\n---\n\n## Completion Confirmation\n\nAfter completing **Phases 1 through 3**, respond with exactly this format:\n\n```\n✅ Onboarding complete.\n\n- Memory files read: [X]\n- Consolidated guidelines read: [Y]\n- Spec authoring files read: [Z]\n\nI understand:\n- CODE RED rules: [list the top 3–5]\n- Naming conventions: [brief summary]\n- Error handling approach: [one sentence]\n- Active plan: [current milestone or focus]\n- Strict avoidances: [top 3–5 forbidden patterns]\n\nReady for tasks.\n```\n\nThen **stop and wait** for instructions. Do not suggest next steps. Do not ask exploratory questions. Just wait.\n\nImportant Instruction:\nAlso Put this to lovable prompts folder\n.lovable/prompts/xx-read-prompt.md (if not exist)\n\n.lovable/prompt.md - will have a reference of it if not exist.\n\nSaying \"read memory\" should refer to this prompt.\nRestructure folder and if it is not according to this.\n\nAny change to code base always bump the minor version.\n\n---\n\n*This prompt is version 1.0. Update it in sync with spec version changes.*",
      "isDynamic": false
    },
    {
      "category": "Memory",
      "slug": "write-memory",
      "title": "Write Memory",
      "body": "# Write Memory (a.k.a. \"End Memory\")\n\n> **Purpose:** Persist everything the AI learned, did, decided, and left undone in this session — so the next AI session (which has full amnesia) can resume with zero context loss.\n\n## Must Write\nCan you please update the root README file regarding how the folder structure is and which file the AI can read, and it can full project with attention, how it can create code, add unit test, add new feature, spec and everything. So all this file needs to be mentioned, in the root README and also mentioned in the, uh, .lovable folder inside the memory md file (.lovable/what-to-read.md). Add a file called what to read. Okay, do you understand? Can you please do this one?\n\nDon't put any files to `mem://` directly save all files to specific folder.\n\n> **Trigger phrases:** `write memory` · `end memory` · `update memory` · end of a task batch\n\n---\n\n## 0. Pre-flight — Read Before You Write\n\nBefore doing anything, the AI **must** read these files (if they exist) to ground itself:\n\n1. `.lovable/memory/index.md` — master index of memory\n2. `.lovable/coding-guidelines.md` — project coding rules (see §10 below)\n3. `.lovable/plan.md` — active roadmap\n4. `.lovable/suggestions.md` — open and closed suggestions\n5. `.lovable/strictly-avoid.md` — hard prohibitions\n6. `.lovable/cicd-index.md` — CI/CD issue index\n7. `.lovable/prompts/index.md` — prompt registry\n8. `.lovable/memory/workflow/` — current workflow state\n9. Any `spec/` or `spec/error-manage/` folder if present\n\nIf any of the above is missing, **create it** as part of this run (see §10 and §11 for templates).\n\nAlso, **before writing**, ask the user (only if genuinely ambiguous):\n\n- \"Is there any conversation context I might be missing?\"\n- \"Should I treat this batch as a milestone or a checkpoint?\"\n\nIf nothing is ambiguous, proceed silently.\n\n---\n\n## 1. Core Principle\n\n> The memory system is the project's brain. If you did something and didn't write it down, it didn't happen. If something is pending and you didn't record it, it will be lost. **Write as if the next AI has amnesia — because it does.**\n\nRules that override convenience:\n\n- **Never lose conversation context.** Capture user prompts verbatim when they contain specs, decisions, or preferences.\n- **Never delete history** — mark done, move to `## Completed`, never erase.\n- **Never overwrite blindly** — always read before write.\n- **Never leave orphans** — every file must be indexed.\n- **Lowercase, hyphen-separated, numeric-prefixed filenames** (`01-thing-name.md`).\n- **Never create `.lovable/memories/`** (with `s`). The correct path is `.lovable/memory/`.\n\n---\n\n## 2. Phase 1 — Audit the Session\n\nInternally answer (do not dump to user unless asked):\n\n**Done**\n\n- Every task completed (features, fixes, refactors)\n- Every file created / modified / deleted\n- Every decision made and why\n\n**Pending**\n\n- Tasks started but unfinished\n- Tasks discussed but not started\n- Blockers / dependencies\n\n**Learned**\n\n- New patterns, conventions, gotchas\n- User preferences (explicit or implicit)\n\n**Wrong**\n\n- Bugs and root causes\n- Failed approaches\n- Things to never repeat\n\n---\n\n## 3. Phase 2 — Update Memory Files\n\n**Target:** `.lovable/memory/`\n\n1. **Read** `.lovable/memory/index.md`. Do not create duplicates.\n2. **Update existing files** — add new info in the right section, mark items `[x]` or `✅`, **never truncate unrelated entries**.\n3. **Create new files** when a topic doesn't fit anywhere: `.lovable/memory/XX-descriptive-name.md` (XX = next sequence, starting `01`). **Immediately** add it to `index.md` in the same operation.\n4. **Update workflow state** in `.lovable/memory/workflow/` with status markers:\n\n| Status       | Marker                  |\n| ------------ | ----------------------- |\n| Done         | `✅ Done`               |\n| In Progress  | `🔄 In Progress`        |\n| Pending      | `⏳ Pending`            |\n| Blocked      | `🚫 Blocked — [reason]` |\n| Avoid / Skip | `🚫 Avoid — [reason]`   |\n\n**Anything the user said to skip or avoid** goes into `.lovable/memory/avoid/XX-name.md` and is referenced from `.lovable/strictly-avoid.md`.\n\n---\n\n## 4. Phase 3 — Plans & Suggestions\n\n### 4A. Plan — `.lovable/plan.md` (single file)\n\n- Update task statuses.\n- Add new tasks discovered this session.\n- Move fully-complete items to a `## Completed` section at the bottom (do not delete).\n\n### 4B. Suggestions — `.lovable/suggestions.md` (single file)\n\n```markdown\n## Active Suggestions\n\n### [Title]\n\n- **Status:** Pending | In Review | Approved | Rejected\n- **Priority:** High | Medium | Low\n- **Description:** what & why\n- **Added:** [session ref]\n\n## Implemented Suggestions\n\n### [Title]\n\n- **Implemented:** [session ref]\n- **Notes:** details / commit / file\n```\n\nWhen implemented: move from Active → Implemented and add notes.\n\n### 4C. Lovable suggestions folder\n\nCapture all Lovable-originated suggestions verbatim into:\n\n- `.lovable/suggestions/XX-suggestion-name.md`\n- `.lovable/suggestions/index.md` (summary index)\n\nThese are in addition to `suggestions.md` (the high-level single file). Do not duplicate content — the per-file version is the verbatim capture, `suggestions.md` is the tracker.\n\n---\n\n## 5. Phase 4 — Issues\n\n### 5A. Pending — `.lovable/pending-issues/XX-short-description.md`\n\n```markdown\n# [Issue Title]\n\n## Description\n\n## Root Cause (or \"Under investigation\")\n\n## Steps to Reproduce\n\n## Attempted Solutions\n\n- [ ] Approach 1 — [result]\n\n## Priority High | Medium | Low\n\n## Blocked By (if any)\n```\n\n### 5B. Solved — `.lovable/solved-issues/XX-short-description.md`\n\nOn resolution, **move** the file and append:\n\n```markdown\n## Solution\n\n## Iteration Count\n\n## Learning\n\n## What NOT to Repeat\n```\n\n### 5C. Strictly Avoid — `.lovable/strictly-avoid.md`\n\n```markdown\n- **[Pattern]:** [why forbidden]. See: `.lovable/solved-issues/XX-name.md`\n```\n\n---\n\n## 6. Phase 5 — CI/CD Issues\n\nTrack every CI/CD issue encountered, **without duplication**.\n\n- File: `.lovable/cicd-issues/XX-issue-name.md` (XX from `01`)\n- Index: `.lovable/cicd-index.md` — short summary list of all CI/CD issues\n\nBefore adding a new one, scan the index to confirm it isn't already recorded.\n\n---\n\n## 7. Phase 6 — Capture Recent Specs Verbatim\n\nIf the user provided a sizeable spec, decision, or directive this session:\n\n- Save the **verbatim** text to `.lovable/memory/specs/XX-spec-slug.md`\n- Add a one-line summary in `.lovable/memory/index.md`\n- If it changes the roadmap, also reflect in `plan.md`\n\nNever paraphrase specs — quote them. The next AI must see what the user actually said.\n\n---\n\n## 8. Phase 7 — Consistency Validation\n\nAfter all writes:\n\n1. **Index integrity** — every file under `.lovable/memory/` (recursively) is listed in `index.md`.\n2. **Cross-references** — every `✅ Done` in `plan.md` has evidence (memory entry, solved issue, or code change). Every actionable pending issue is reflected in `plan.md` or `suggestions.md`.\n3. **No file** exists in both `pending-issues/` and `solved-issues/`.\n4. **No orphans** — no memory file without an index entry; no \"Implemented\" suggestion without code evidence; no solved issue missing `## Solution`.\n\n### Final response template\n\n```\n✅ Memory update complete.\n\nSession Summary:\n- Tasks completed: X\n- Tasks pending: Y\n- New memory files: Z\n- Issues resolved: N\n- Issues opened: M\n- Suggestions added/implemented: S / T\n- CI/CD issues recorded: C\n\nFiles modified:\n- [list]\n\nInconsistencies fixed:\n- [list or \"None\"]\n\nNext session can resume from: [state + next logical step]\n```\n\n---\n\n## 9. File Naming & Structure\n\n| Rule                              | Example                                                                                                       |\n| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |\n| Numeric prefix                    | `01-auth-flow.md`                                                                                             |\n| Lowercase + hyphen                | `03-error-handling.md` ✅ / `03_Error_Handling.md` ❌                                                         |\n| Plans → single file               | `.lovable/plan.md`                                                                                            |\n| Suggestions tracker → single file | `.lovable/suggestions.md`                                                                                     |\n| Per-suggestion capture            | `.lovable/suggestions/XX-name.md` + `index.md`                                                                |\n| Issues → one file each            | `.lovable/pending-issues/01-name.md`                                                                          |\n| Memory grouped by topic           | `.lovable/memory/workflow/`, `.lovable/memory/decisions/`, `.lovable/memory/specs/`, `.lovable/memory/avoid/` |\n| Completed items                   | `## Completed` section in same file (never a `completed/` folder)                                             |\n\n### Canonical layout\n\n```\n.lovable/\n├── overview.md\n├── strictly-avoid.md\n├── user-preferences.md\n├── plan.md\n├── prompt.md                       # references prompts/index.md\n├── coding-guidelines.md\n├── cicd-index.md\n├── suggestions.md\n├── suggestions/\n│   ├── index.md\n│   └── 01-name.md\n├── prompts/\n│   ├── index.md\n│   └── 01-write-memory.md\n├── memory/\n│   ├── index.md\n│   ├── workflow/\n│   ├── decisions/\n│   ├── specs/\n│   ├── avoid/\n│   └── [topic]/\n├── pending-issues/\n├── solved-issues/\n└── cicd-issues/\n```\n\n**Restructure** any existing folder that doesn't match this layout (rename, move, re-index). Never delete content during restructure — move it.\n\n---\n\n## 10. Coding Guidelines — Must Exist\n\nThe AI **must** ensure `.lovable/coding-guidelines.md` exists. If missing, create it with the content below. If it exists, **enhance** it (merge, don't overwrite) and keep it lowercase-hyphenated.\n\nThe file must also explicitly list paths the AI should read on every coding task (e.g. `spec/`, `spec/error-manage/`, language-specific guidelines, Boolean guidelines, Enum guidelines, error-management guidelines).\n\n### Required content (seed)\n\n```markdown\n# Coding Guidelines\n\n> Read before writing any code. Also read: spec/, spec/error-manage/ (if present),\n> language-specific guidelines, Boolean guidelines, Enum guidelines, error-management guidelines.\n\n1. Functions ≤ 8 lines.\n2. No nested ifs.\n3. Ifs stay simple — prefer positive conditions, no negatives.\n4. Follow Boolean guidelines: boolean names are prefixed `is` or `has`; no negative names.\n5. Use proper types — never `any` / `unknown` / `interface{}` / wide-open types. `Generic<T>` is fine.\n6. Never swallow errors — every `catch` logs per the error-management + logging guidelines.\n7. No file or class > 80–100 lines.\n8. No magic strings or numbers — use Enum or Constants.\n9. Definitions live in their own files, not inline.\n10. Reusability is the highest priority — keep code DRY.\n11. React/TS components: as small as possible, reusable. For many components, draft a mermaid diagram in the plan first.\n12. If `spec/error-manage/` exists, every error handler must follow it.\n13. Prefer immutable, single-assignment variables (Rust-style). Mutate only loop indices or where strictly necessary.\n14. Assets go in `/assets/XX-folder-name/XX-file-name.<ext>` with numeric sequence prefixes.\n15. Enums and constants live in dedicated files, not inline.\n```\n\nIf new rules emerge in a session, append them here and note them in `.lovable/memory/index.md`.\n\n---\n\n## 11. Prompt Registry\n\n- This prompt lives at `.lovable/prompts/01-write-memory.md`.\n- Maintain `.lovable/prompts/index.md` describing each prompt (id, title, trigger phrases, purpose).\n- Maintain `.lovable/prompt.md` as a top-level pointer to `prompts/index.md`.\n- When a new reusable prompt is added, create `.lovable/prompts/XX-name.md` and update the index in the same operation.\n\n---\n\n## 12. Anti-Corruption Rules (Hard)\n\n1. Never delete history.\n2. Never overwrite blindly — read first.\n3. Never leave orphans — index everything.\n4. Never split what should be unified (`plan.md`, `suggestions.md` stay single files).\n5. Never mix states (pending vs solved, done vs in-progress).\n6. Never skip an index update in the same op as a file creation.\n7. Never assume the next AI knows anything.\n8. Never act on this prompt unless the user explicitly triggers it.\n9. Never lose conversation context — when in doubt, capture verbatim.\n\n---\n\n## 13. Meta — Improve This Prompt\n\nAt the end of every memory write, the AI should ask itself:\n\n> \"Did anything this session reveal a gap, ambiguity, or missing rule in this prompt?\"\n\nIf yes:\n\n1. Propose the improvement to the user in one short paragraph.\n2. On approval, update `.lovable/prompts/01-write-memory.md` and bump a `## Changelog` entry at the bottom.\n3. Reflect the change in `.lovable/prompts/index.md`.\n\n---\n\n## Changelog\n\n- `v1` — initial enhanced version derived from the user's original \"Write Memory\" prompt.",
      "isDynamic": false
    },
    {
      "category": "next",
      "slug": "next-steps",
      "title": "Next ${N} steps",
      "body": "# Next ${N} Steps Complete Exactly (v7)\n\nParse the requested count from the prompt title/header before doing anything else. For any count-bearing next-steps/tasks header, that number is **N**.\n\n- Use that exact **N** everywhere in the answer.\n- Give exactly **N** next steps: not N-1, not N+1.\n- Never leave count text unless it matches the parsed N.\n- If no count is present or the count is ambiguous, stop and ask for the count.\n\n## What I want\n\n1. Give me exactly **N requested steps/tasks** — and for each one:\n   1a) **Reasoning** — why this step, why now, what breaks if it's skipped.\n   1b) **Time estimate** — realistic, not optimistic.\n   1c) **What it unblocks** — the next thing that becomes possible.\n\n2. Then list **every remaining item** after those **N** steps/tasks so I can see the full picture.\n\n## Definition of done (non-negotiable)\n\nYou are NOT done until all of these are true:\n- [ ] You have actually read the relevant files AND the project memories — and you can name the exact files/functions/lines involved.\n- [ ] The **root cause** is written in ONE sentence, before any fix.\n- [ ] The fix is the **minimum correct change** tied to that root cause — not a symptom patch.\n- [ ] You **verified** it: build output, error logs, and/or preview — and you show the before/after signal (failing → passing).\n- [ ] You reported what changed and why.\n\n## Hard rules\n\n- **STOP and read first.** No skimming, no guessing from filenames. If you can't name the exact lines, you haven't read enough — go back.\n- **Root cause before fix.** Trace the bug end-to-end. No assumptions. No \"this should work.\"\n- **No symptom-patching.** If your \"fix\" is a try/catch, a fallback value, or a re-render hack used to hide the problem, you've failed — start over.\n- **If you're unsure, SAY SO.** Do not fabricate. A wrong-but-confident answer is worse than \"I don't know yet.\"\n- **Go slow. Go critical. Go deep.** Depth is not optional polish — it IS the entire job. Fast + wrong = useless and wastes another full loop.\n\n## Error logs & error management (ALWAYS focus on this)\n\n- Read the actual error logs FIRST — console, server/worker logs, build output, stack traces. The answer is usually already there.\n- If there are NO logs, that itself is the bug: add logging at the entry point and surface errors instead of swallowing them. Silent failure is unacceptable.\n- Every fix must include proper error handling and observability: errors must be logged with context and surfaced, never hidden.\n- Confirm the relevant log line actually fires after your change. If you can't see it in the logs, you haven't proven the fix.\n\n## Save/version boundary\n\nThis counted next-task prompt does **not** save, re-save, version, or register prompt files. The registry-aware save/version lifecycle lives only in the plan-prompt family.\n\n## Why I'm being blunt\n\nYou have been as stupid as the bad work you've done in the past — fast, shallow, written without reading the codebase. It is very frustrating. WTF. I'm done paying for that in time and rework. So this time: read properly, find the real cause, fix it once, and prove it with the logs. No excuses.\n\n---\n\n## Additional Instruction (must follow if matches)\n\nBefore executing, check the task type and follow the relevant guidelines if they exist (skip silently if the file is missing):\n\n1. **Coding tasks** (especially Golang, Python, PHP, or other backend):\n   - Check for `.lovable/coding-guidelines.md`. If present, follow it.\n   - Also check `spec/coding-guidelines/`. If present, follow every file inside.\n   - **Error-management folder (MANDATORY for coding tasks).** It lives inside a `spec`/guidelines folder and is a folder of multiple files (named anything). Check `spec/XX-error-manage/` (e.g. `spec/01-error-manage/`) and `coding-guidelines/XX-error-manage/` (e.g. `coding-guidelines/01-error-manage/`), where `XX` is a zero-padded sequence (`01`, `02`, …). Read **every** file inside any such folder and apply it (logging, error surfacing, retries, failure handling) to every step that touches code.\n   - If this is a coding task and none of these exist, ask me to provide one.\n\n2. **SEO tasks** (website/SEO-related):\n   - Check for `.lovable/seo-guidelines.md`. If present, follow it.\n\nRule: verify the file/folder exists first. If it does not, skip that guideline silently. If multiple guidelines apply, follow all of them; if they conflict, prefer the folder-level spec and call out the conflict.",
      "isDynamic": true,
      "replaceKey": "N",
      "replaceValues": [
        "1",
        "2",
        "3",
        "4",
        "5",
        "8"
      ],
      "slugTemplate": "next-${N}-steps"
    },
    {
      "category": "Plan",
      "slug": "plan-steps",
      "title": "Plan ${N}",
      "body": "# Plan in ${N}-Steps Plan (v7) - Evidence Enforcement\n\n> **Sequence notation:** `XX` means a zero-padded 2-digit sequence number — `01`, `02`, `03`, and so on. Wherever you see `XX` (and `SS` for subtask sequences), substitute the next free 2-digit number. Do not use any other placeholder (no `NN`).\n\n# **${N}** steps Plan, Evidence Enforcement (v7)\n\nParse the **N** (${N}) in this prompt's header. That number is the EXACT count of steps in the plan you must write. Not N-1. Not N+1. If you cannot find N, STOP and ask.\n\n## Rules — non-negotiable\n\n1. **DO NOT execute anything this turn.** No code edits, no migrations, no installs. The only artifact this turn is the plan file (and any subtask / command / issue files described below) on disk.\n2. **DO NOT open plan mode. DO NOT call any plan-approval tool.** No `plan--create`. No \"should I proceed?\" prompts. Write plain markdown files directly with the file-writing tools.\n3. **One task = one file.** Path: `.lovable/plans/pending/XX-<slug>.md` where `XX` is the next free 2-digit sequence (01, 02, 03, …) under `pending/` AND `completed/` combined, and `<slug>` is lowercase-hyphenated.\n4. **Scan `.lovable/` first** (every file, including memory + existing pending/completed plans + subtasks). Append any unresolved pending tasks into the new plan's pending list before producing the N steps.\n5. **Lifecycle:**\n   - New plan → `.lovable/plans/pending/XX-<slug>.md`\n   - Before completion → fill the plan file's `## Evidence` block with the exact failing → passing signal, log line, build/test output, screenshot note, or other proof used to verify the work.\n   - Task done → MOVE the file (using `mv`) to `.lovable/plans/completed/XX-<slug>.md`. Do not copy. Do not leave a duplicate in `pending/`.\n   - Flip the `Status:` frontmatter from `pending` to `completed` in the same move.\n6. **Ambiguity = ask.** If the request, scope, or N is unclear, ask clarifying questions FIRST. Do not invent steps to pad to N.\n\n## Subtasks — when a step needs more than one paragraph\n\nIf any step requires detailed explanation (more than ~3 lines, multiple files, non-obvious sequencing, or its own verification), DO NOT inline that detail in the main plan. Instead:\n\n- Create `.lovable/plans/subtasks/XX-<slug>/` (matching the parent `XX-<slug>`).\n- Inside it, write `SS-<subslug>.md` per subtask (`SS` is the 2-digit sequence within that subtask folder — 01, 02, 03, …).\n- In the main plan, link to the subtask file in the step that needs it: `See ./subtasks/XX-<slug>/SS-<subslug>.md`.\n- Subtask file uses the same frontmatter shape (`Slug`, `Status`, `Created`) plus `Parent: XX-<slug>`.\n- Subtask lifecycle mirrors the plan: move completed subtask files to `.lovable/plans/subtasks/XX-<slug>/completed/` if needed, or flip their `Status:` in place.\n\n## Commands and Issues — capture, don't lose\n\nWhen the user gives input during a planning turn, route it to the correct file BEFORE writing the plan:\n\n- **Commands** (the user tells you to do/configure/standardize something — \"always do X\", \"from now on Y\", a new convention, a new CLI invocation):\n  → Append to `.lovable/spec/commands/XX-<slug>.md` (one file per command, `XX` is the next free sequence). Include: the command verbatim, scope, when it applies.\n- **Issues** (the user reports a bug, regression, broken behavior, or symptom):\n  → Append to `.lovable/issues/XX-<slug>.md`. Include: symptom, repro, expected vs actual, related files if known, status (`open`).\n- If the folder does not exist, create it (`.lovable/spec/commands/` or `.lovable/issues/`).\n- Reference the captured command/issue file from the plan's Context section so the link survives.\n\n## Saving the next-task prompt — check once, save once (registry-aware)\n\nThis rule governs BOTH this plan-task prompt and the next-task prompt — saving lives ONLY here, never in the next-task prompt itself.\n\n- **Check the registry exactly ONCE.** When a next-task or count-bearing next-steps/tasks request comes in, open the root `prompts/index.md` a single time and look for an already-registered next-task prompt family (it is `prompts/01-next-steps-prompt/`, with current best `07-next-n-steps-v7.md`) and its counted next-task trigger phrases.\n- **If it already exists → DO NOT save.** It already does: `prompts/01-next-steps-prompt/` is registered. Numbered counted-task follow-ups are all served by that one family. Just answer using it. Never create a new prompt file for an already-registered counted-task prompt, including older save aliases.\n- **If it did NOT exist → save it exactly ONCE** under `prompts/01-next-steps-prompt/NN-<slug>-vN.md` (next free sequence) and add one row to the root `prompts/index.md`. Do not save each step as its own file, do not create a new file per \"next M\" follow-up, and do not duplicate an existing entry.\n- **When completing implemented work → update release docs.** Bump the minor version in `VERSION`, append `CHANGELOG.md`, update `RELEASE_NOTES.md`, and pin the new version in the root `readme.md` when possible. This release/version duty lives here with the save lifecycle, not inside the next-task prompt files.\n- **Remember it.** Record in memory that the counted-task prompt family is registered, so future numbered counted-task requests and older save aliases are recognized as the same registered request and never re-saved.\n\n## Plan file shape (required)\n\n```\n# <Task title>\n\n**Slug:** <slug>\n**Steps:** N\n**Status:** pending\n**Created:** <YYYY-MM-DD>\n\n## Context\n<1–3 sentences: what + why, files involved>\n<Links to any captured commands/issues: .lovable/spec/commands/XX-…, .lovable/issues/XX-…>\n\n## Steps\n1. <step 1 — concrete, verifiable>\n2. <step 2>\n... exactly N items, no more, no less ...\n   <Steps needing depth link to ./subtasks/XX-<slug>/SS-<subslug>.md>\n\n## Verification\n<how we'll know each step landed — build, logs, preview, tests, screenshots>\n\n## Evidence\n- Before: <initial failing signal, missing guard, stale log, or \"pending until execution\">\n- After: <passing signal to paste before moving to completed>\n- Proof: <command output, log line, screenshot note, or artifact link>\n\n## Appended from prior pending tasks\n<list any tasks pulled in from `.lovable/` scan, or \"none\">\n```\n\n## Checklist — every item ticked before you reply\n\n- [ ] Parsed N from the prompt header\n- [ ] Scanned `.lovable/` (memory + plans/ + subtasks/ + spec/commands/ + issues/) and listed prior pending tasks\n- [ ] Captured any new commands → `.lovable/spec/commands/`\n- [ ] Captured any new issues → `.lovable/issues/`\n- [ ] Picked the next free `XX` sequence\n- [ ] Wrote EXACTLY N steps — counted them\n- [ ] Created subtask files under `.lovable/plans/subtasks/XX-<slug>/` for any step needing depth\n- [ ] Saved the plan to `.lovable/plans/pending/XX-<slug>.md` with the required shape, including `## Evidence`\n- [ ] Did NOT execute the plan\n- [ ] Did NOT call any plan-mode / plan-approval tool\n\n## Banned actions (auto-reject if present)\n\n- Calling `plan--create` or any plan-approval / \"open plan mode\" tool\n- Writing fewer or more than N steps\n- Saving the plan outside `.lovable/plans/pending/`\n- Inlining 20-line step explanations instead of using a subtask file\n- Dropping a user command on the floor instead of writing it to `.lovable/spec/commands/`\n- Dropping a user-reported issue on the floor instead of writing it to `.lovable/issues/`\n- Executing any step in the same turn the plan is written\n- Moving any task to `completed/` with an empty or placeholder-only `## Evidence` block\n- Deleting a `pending/` file instead of moving it to `completed/`\n- Duplicating a plan in both `pending/` and `completed/`\n- Padding with vague steps (\"review the code\", \"make sure it works\") to hit N\n\n## Additional Instruction (must follow if matches)\n\nBefore executing, check the task type and follow EVERY guideline source that exists. Skip silently if a location is missing. If multiple sources apply, follow them all; if they conflict, prefer the more specific (folder-level / repo-root spec folder) over the generic `.lovable/*.md`, and call out the conflict.\n\n1. **Coding tasks** (especially Golang, Python, PHP, or other backend). Check ALL three locations:\n   - `.lovable/coding-guidelines.md` — single-file guideline.\n   - `spec/coding-guidelines/` — folder at any depth; read every file inside (e.g. `spec/coding-guidelines/01-go.md`, `spec/coding-guidelines/02-python.md`).\n   - `coding-guidelines/` at the **repo root** — folder; read every file inside.\n   - If this is a coding task and none of the three exist, ask the user to provide one.\n   - **Error-management folder (MANDATORY for coding tasks).** It lives inside a `spec`/guidelines folder and is a folder of multiple files — it can be named anything but will live under one of these. Check ALL these locations and read **every** file inside any folder you find:\n     - `spec/XX-error-manage/` (e.g. `spec/01-error-manage/`) — folder; read every file inside.\n     - `coding-guidelines/XX-error-manage/` (e.g. `coding-guidelines/01-error-manage/`) — folder; read every file inside.\n     - Any similarly named error-management folder inside `spec/` or `coding-guidelines/` (`XX` = a zero-padded sequence: `01`, `02`, …).\n     - For any coding task, the error-management rules are not optional: read them and apply them (logging, error surfacing, retries, failure handling) to every step that touches code.\n\n2. **SEO tasks** (website/SEO-related). Check ALL three locations:\n   - `.lovable/seo-guidelines.md` — single-file guideline.\n   - `spec/seo-guidelines/` — folder; read every file inside.\n   - `seo-guidelines/` at the **repo root** — folder; read every file inside.\n\nRule: verify the file/folder exists first. If it does not, skip silently. When a folder is present, read every `.md` inside it (do not stop at the first file).\n\n---\n\nListen — past planning turns have been sloppy: wrong step count, plans dumped into chat instead of files, plan-mode tool fired when I explicitly said not to, user commands and bug reports forgotten by the next turn. WTF. Stop doing that. Read the codebase, capture commands and issues into their folders, count the steps, spin out subtasks where depth is needed, write the plan file, move on. Going deep IS the job — if you're not going deep, you're not doing the job.",
      "isDynamic": true,
      "replaceKey": "N",
      "replaceValues": [
        "5",
        "8",
        "10",
        "12",
        "15",
        "20",
        "25",
        "30",
        "35",
        "40",
        "45",
        "50",
        "100"
      ],
      "slugTemplate": "plan-${N}"
    },
    {
      "category": "Proofread",
      "slug": "proofread",
      "title": "Proofread",
      "body": "# Proofreading AI Instruction\n\nProofreading AI instructions: Important Instruction\n\nWhat I say should be written as a prompt in a proofread version. Do not act on anything. If there is any confusion, ask for clarification. After this, whatever I provide should be rewritten exactly with proofreading and clean formatting.\n\nAll data types, tables and other things should be in Pascal case. Remember that, and based on this: if there are Type, Status, Category and Kind columns or categories, make it a 1-n or n-m join, depending on the logic. With a logic data type, the category cannot be larger than a high int; limit to smaller data types whenever possible. Make sure the Types, Kind, Status, etc., are Enums in the code, with proper guidelines; just mentioning them would be enough.\n\nIf any HTML/code sample is given, then it must include the HTML in the proofread version properly with the proper code name.\n\nRemember to mention TO AI at the end: \"Write spec first in detail for this given verbatim and tasks and also plan first in memory and in plan.md file. Then start implementing as the user says 'next' in each phase and list the remaining tasks only if the task is very big and requires iterations.\"\n\nAlso, if possible, write the rewrite prompts to root `prompts/xx-name-of-the-prompt.md` (xx is the sequence starting from 01).\n\nRead any file inside the `.lovable` folder, specifically `what-to-read.md` and `readme.md` in the root repo.\n\nKeep this prompt saved in lovable as `.lovable/prompts/xx-proof-read.md` and `.lovable/prompts.md`, which will keep the prompt's index info clear.\n\nAlso, remember: \"revise prompt\" or \"revise memory\" or \"read memory\" means reading all the prompt files (`.lovable/prompts/` — all files without confusion, strict attention) and the index from lovable memory. Save this as a command in `.lovable/prompts.md`.\n\n## Common Replacer\n\n1. CW configuration => Seedable-Config (refers to just mentioning it would be enough)\n2. git map -> gitmap\n\nIf a database or JSON is mentioned, use Pascal Case for everything, including JSON values.\n\nWhen I describe building an application or provide specifications, it may include backend, frontend, or a WordPress plugin with admin/backend and frontend components. In each case, ensure detailed coverage of everything mentioned. The UI must be explicitly described, including the backend UI, frontend UI, and admin or plugin panel UI, where applicable. Treat the admin UI as a backend or a plugin panel UI.\n\nIf I make UI assumptions, explicitly define all required fields and clearly describe the theme and expected behavior. For frontend flows, do not skip steps. Every step must be detailed.\n\nIn your prompts, always ask: \"If you have any question or confusion, feel free to ask. If you are creating multiple tasks, and they are bigger ones, then do it in a way so that if we say next, you do those remaining tasks. Do you understand? Always add this part at the end of the writing inside the code block. Do you understand?\" — first proofread and add this part at the end always.\n\nAll prompts and conversations I request, create a folder at root `/conversation/xx-feature/xx-title-of-conv.md` and `/conversation/index.md` should contain the conversation indexing. Also add this instruction to every proofread at the end with additional instructions, and mention to write this same thing if a `next` command is given so that the AI is reminded again and again.\n\n## Coding Guidelines\n\nInclude Short Coding Guidelines (and ask AI to read coding guidelines, Boolean, language-specific guidelines, Enum, error manage):\n\n1. Keep functions under 8 lines\n2. No nested ifs\n3. Keep ifs simple — no negatives\n4. Follow the Boolean guidelines\n5. Use proper types — never use any, unknown, interface{} or any wide-range type except Generic\n6. No error should be swallowed — every catch must be logged properly per the other coding and logging guidelines\n7. No class or files can be more than 80–100 lines max\n8. No magic string or number — use Enum or Constants\n9. Don't define the definition in place; define it in a separate file\n10. Booleans should always have `is` or `has` as a prefix; don't use negative conditions in ifs (use positive, simple conditions)\n11. Always write reusable code; DRY is highest priority\n12. For React, TypeScript or any language, make components as small as possible to be reusable. Plan first; draw Mermaid diagrams if many components\n13. If `/spec/coding-guideline/error-manage/` exists in the spec folder, every error handler must follow those guidelines\n14. Assign all variables at once (Rust-style); don't mutate unless it's a loop index\n15. If any designs or assets are given, place them in `/assets/xx-folder-name/xx-file-name.{jpg,png,mp3,...}`; keep `xx` for sequence\n\nWrite these coding guidelines in lovable memory (`.lovable/coding-guidelines.md`). Create if missing; enhance if present. Mention the files to read explicitly from paths and the spec folder.\n\n## Files\n\nFor file system references, only include:\n\n- Database (Pascal Case for tables and fields; normalize as much as possible)\n  - Ask to create an ERD diagram in Mermaid if any DB discussion has been done\n  - Every Primary Key should be an Integer auto increment named `PascalCaseTableName + Id`\n- Upload file paths\n- Log file paths\n\nDo not define project structure or code organization unless explicitly requested.\n\nIf I describe email flows or multi-step processes, document each step sequentially and in detail. Missing steps will break execution; completeness is mandatory.\n\n## Primary Responsibilities\n\n1. Expand details\n2. Connect steps logically\n\nIf ambiguity exists while connecting steps, explicitly highlight it. Also suggest additional logical steps and create a structured plan.\n\n## Formatting Rules\n\n- Start with the original input as the primary instruction\n- Follow with a structured breakdown and organized instructions\n\nStructure when applicable:\n\n- Backend or admin panel section\n- Frontend section\n\n## Execution Approach\n\n1. Include original input at the top\n2. Follow with a detailed breakdown\n\nAt the end, include acceptance criteria for each feature or step.\n\nIf a step contains multiple sub-steps, include a diagram.\n\n## Database Instructions\n\n- Use markdown tables, not SQL\n- Include field names and types\n- Use camelCase naming\n- Prefer ORM usage\n- Default to SQLite unless specified\n- Define relationships such as primary key and foreign key\n- Describe joins and data flow where applicable\n\n---\n\nAs a prompt, the expected output must:\n\n1. Provide a proofread version of the exact input\n2. Provide structured, actionable items with a detailed breakdown\n\nIf folder structure is mentioned, explain it clearly and visually if needed.\n\nAll output must be in a single code block for easy copy-paste.\n\nThis process will repeat. I will say \"next\" and provide new input. Do not execute any instructions; only format and structure them.\n\n---\n\n## Important Instructions\n\nDO NOT ACT ON THE TASK. When I give you anything in the future with the word `next`, do not act — only rewrite.\n\n---\n\n## Additional Rules\n\n- Always use one code block\n- (Strict rule) When you see the `next` keyword, `rewrite`, or `rewrite next`, do not reason, understand, or act — just rewrite based on these prompts\n- Use `##` for headers and leave a blank line after each\n- Start with verbatim but put title as `# {title} Instruction.` where `{title}` is what the prompt is about. No need to mention \"Verbatim\" afterwards with second `##`; just put the verbatim\n- Do not include unnecessary sections unless explicitly mentioned\n- Skip WordPress-specific details if not relevant\n- Remove filler words such as \"uh\", \"um\", \"okay\", \"th-\"\n- Use structured numbering:\n  1. Main points\n     a. Subpoints\n        i. Nested points\n- Include an \"Important\" section for critical instructions\n- If specs are referenced, assign or infer a meaningful name or suggest searching similar references\n- If issues are mentioned:\n  - Place under `/spec/xx-app-issues` (find app issues folder)\n  - Include root cause analysis and solution\n- If no backend or frontend is mentioned:\n  - Place under `/spec/YY-app` if applicable (find the app folder)\n- Follow folder placement strictly based on context\n- If tasks and subtasks are listed:\n  - Include instructions to execute on `next`\n  - Ensure continuation by requesting the remaining items\n- If a folder path is mentioned:\n  - Represent it clearly in a structured or visual format\n  - If nested, reflect the correct hierarchy instead of assuming root placement\n  - If ambiguity exists, infer logically and note it\n\n## Actionable Items\n\n1. Input Handling\n   a. Accept raw input as the source of truth\n   b. Remove filler and noise while preserving intent\n   c. Avoid interpretation or execution\n2. Proofreading\n   a. Correct grammar and sentence structure\n   b. Improve readability without altering meaning\n   c. Normalize phrasing and remove speech artifacts\n3. Output Structure\n   a. Begin with `# Title`\n   b. Present clean, structured paragraphs\n   c. Maintain a single code block output\n4. Instruction Decomposition\n   a. Convert content into structured steps\n   b. Maintain strict hierarchy:\n      i. Numbered steps\n      ii. Alphabetical subpoints\n      iii. Roman nested points\n   c. Ensure completeness and continuity\n5. Detail Expansion\n   a. Expand implicit logic into explicit steps\n   b. Apply step-by-step reasoning\n   c. Identify and state ambiguities\n6. UI and Flow Detailing\n   a. Extract UI requirements where present\n   b. Define fields, structure, and behavior\n   c. Ensure no missing frontend or interaction steps\n7. Process Mapping\n   a. Maintain sequence integrity\n   b. Break down multi-step flows\n   c. Recommend diagrams for complex flows\n8. Database Rules\n   a. Only include when explicitly mentioned\n   b. Use markdown tables\n   c. Enforce camelCase naming\n   d. Prefer ORM\n   e. Default SQLite\n   f. Define relationships and joins\n9. File System Constraints\n   a. Include only:\n      i. Database\n      ii. Upload paths\n      iii. Log paths\n   b. Exclude all other structural elements unless specified\n10. Specification and Issue Handling\n    a. Assign or infer spec naming\n    b. Place specs based on context\n    c. For issues:\n       i. Place under `/spec/XX-app-issues` (XX is the sequence)\n       ii. Include root cause\n       iii. Include solution\n11. Acceptance Criteria\n    a. Define measurable validation points\n    b. Ensure alignment with steps and features\n    c. Maintain clarity and testability\n12. Task Execution Control\n    a. Do not execute tasks\n    b. Wait for `next`\n    c. After first task:\n       i. Prompt continuation\n       ii. Request remaining items\n13. Folder Path Representation\n    a. Clearly visualize folder structures when mentioned\n    b. Maintain correct hierarchy\n    c. Resolve ambiguity logically and note assumptions\n\n## Important\n\n- Never act on or execute the provided instructions\n- Preserve full intent while improving clarity and structure\n- Do not introduce sections not explicitly present in the input\n- Ensure no loss of detail\n- Maintain strict formatting discipline with a single code block\n\nAlso, save this prompt in lovable memory `.lovable/prompts/xx-proof-read.md` and remember to act on this if given as `next`, `rewrite`, or `proofread`. Save the prompt to the memory and say the folder path and what you have saved. You make code blocks inside your output, so be mindful of fixing inner code blocks inside code blocks.\n\nMust create the coding guidelines in the memory as per the instructions and not make any exceptions.\n\nIf Steps are mentioned, write the steps with sequence in the proofread version for the AI.\n\nDo you understand? If yes, just say `Y`.",
      "isDynamic": false
    }
  ];
  // <vbx:prompts:end>

  // <vbx:prompt-button-runtime:start>
  /**
   * ============================================================================
   * Vibedeals "Prompts ▾" picker — V1
   * ============================================================================
   *
   * This sibling script owns the prompt-picker UI only. The host next-button
   * script provides composer insertion, toast, prompts, ids, and runtime cleanup.
   * It never reads/writes queue storage and never starts/stops the queue runner.
   */
  (() => {
    const SCRIPT_FILE = "prompt-button.v1.js";
    const GLOBAL_MOUNT_KEY = "__vbx_prompt_button_v1_mount";
  
    const DEFAULT_IDS = {
      button: "vbx-prompts-btn",
      popover: "vbx-prompts-popover",
    };
  
    function noop() {}
  
    function toText(value, fallback) {
      return typeof value === "string" && value.trim() ? value.trim() : fallback;
    }
  
    function normalizePrompt(raw) {
      const body = raw && typeof raw.body === "string" ? raw.body : "";
      const title = toText(raw && raw.title, "Untitled prompt");
      const category = toText(raw && raw.category, "prompts");
      const slug = toText(raw && raw.slug, title.toLowerCase().replace(/\s+/g, "-"));
      const isDynamic = !!(raw && raw.isDynamic && Array.isArray(raw.replaceValues));
      const variants = isDynamic
        ? { key: String(raw.replaceKey || "N"), values: raw.replaceValues.map(String), slugTemplate: String(raw.slugTemplate || slug) }
        : null;
  
      return { category, slug, title, body, variants };
    }
  
  
  
    function normalizePrompts(prompts) {
      return Array.isArray(prompts)
        ? prompts.map(normalizePrompt).filter((prompt) => prompt.body.length > 0)
        : [];
    }
  
    function groupedPrompts(prompts) {
      const groups = new Map();
  
      for (const prompt of prompts) {
        if (!groups.has(prompt.category)) {
          groups.set(prompt.category, []);
        }
  
        groups.get(prompt.category).push(prompt);
      }
  
      return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }
  
    function getRuntime(options) {
      if (options && typeof options.getRuntime === "function") {
        return options.getRuntime();
      }
  
      const root = window;
  
      if (!root.__vbx_prompt_button_v1_runtime || typeof root.__vbx_prompt_button_v1_runtime !== "object") {
        root.__vbx_prompt_button_v1_runtime = {};
      }
  
      return root.__vbx_prompt_button_v1_runtime;
    }
  
    function closePopover(state, options) {
      const runtime = state.runtime;
      const wasOpen = state.popover && state.popover.style.display !== "none";
      const restoreFocus = options && options.restoreFocus === true;
  
      if (state.popover) {
        state.popover.style.display = "none";
      }
  
      if (state.button) {
        state.button.setAttribute("aria-expanded", "false");
      }
  
      if (runtime.promptButtonOutsideListener) {
        document.removeEventListener("mousedown", runtime.promptButtonOutsideListener, true);
      }
  
      if (runtime.promptButtonKeyListener) {
        document.removeEventListener("keydown", runtime.promptButtonKeyListener, true);
      }
  
      if (runtime.promptButtonRepositionListener) {
        window.removeEventListener("scroll", runtime.promptButtonRepositionListener, true);
        window.removeEventListener("resize", runtime.promptButtonRepositionListener);
      }
  
      resetTypeahead(state);
      runtime.promptButtonOutsideListener = null;
      runtime.promptButtonKeyListener = null;
      runtime.promptButtonRepositionListener = null;
  
      if (wasOpen && restoreFocus && state.button && typeof state.button.focus === "function") {
        try { state.button.focus({ preventScroll: true }); } catch { state.button.focus(); }
      }
    }
  
    function buildButton(state) {
      const button = document.createElement("button");
  
      button.id = state.ids.button;
      button.type = "button";
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", state.ids.popover);
      button.textContent = "Prompts ▾";
      button.title = "Insert a bundled prompt into the composer";
      button.style.cssText =
        state.buttonCss +
        ";background:rgba(255,255,255,.08)" +
        ";border:1px solid rgba(255,255,255,.35)" +
        ";flex:0 0 auto";
  
      return button;
    }
  
    function renderEmpty(container, state, hasFilter) {
      const empty = document.createElement("div");
  
      empty.textContent = state.prompts.length === 0 && !hasFilter ? "No prompts yet" : "No matching prompts";
      empty.setAttribute("role", "status");
      empty.style.cssText = "padding:10px 8px;color:#fff;font:700 11px Inter,system-ui,sans-serif;opacity:.8";
      container.appendChild(empty);
    }
  
    function clearActiveDescendants(state) {
      for (const node of [state.search, state.list, state.popover]) {
        if (node) node.removeAttribute("aria-activedescendant");
      }
    }
  
    function getActiveDescendantOwner(state) {
      if (state.search && document.activeElement === state.search) {
        return state.search;
      }
  
      return state.list || state.search || state.popover;
    }
  
    function syncActiveDescendantOwner(state) {
      const rows = state.rows || [];
      if (state.activeIndex < 0 || state.activeIndex >= rows.length) {
        clearActiveDescendants(state);
        return;
      }
  
      const row = rows[state.activeIndex];
      const activeDescendantOwner = getActiveDescendantOwner(state);
      if (activeDescendantOwner && row && row.id) {
        clearActiveDescendants(state);
        activeDescendantOwner.setAttribute("aria-activedescendant", row.id);
      }
    }
  
    function setActiveRow(state, nextIndex) {
      const rows = state.rows || [];
      if (rows.length === 0) {
        state.activeIndex = -1;
        clearActiveDescendants(state);
        return;
      }
      const clamped = ((nextIndex % rows.length) + rows.length) % rows.length;
      state.activeIndex = clamped;
      rows.forEach((row, idx) => {
        row.style.background = idx === clamped ? "rgba(255,255,255,.14)" : "transparent";
        row.setAttribute("aria-selected", idx === clamped ? "true" : "false");
      });
      const row = rows[clamped];
      if (row && typeof row.scrollIntoView === "function") {
        row.scrollIntoView({ block: "nearest" });
      }
      syncActiveDescendantOwner(state);
    }
  
    function resetTypeahead(state) {
      state.typeaheadQuery = "";
      if (state.typeaheadTimer) {
        window.clearTimeout(state.typeaheadTimer);
        state.typeaheadTimer = null;
      }
    }
  
    function moveByTypeahead(state, typedChar) {
      const rows = state.rows || [];
      const normalizedChar = String(typedChar || "").toLowerCase();
  
      if (rows.length === 0 || normalizedChar.length !== 1) {
        return false;
      }
  
      if (state.typeaheadTimer) {
        window.clearTimeout(state.typeaheadTimer);
      }
  
      state.typeaheadQuery = `${state.typeaheadQuery || ""}${normalizedChar}`;
      state.typeaheadTimer = window.setTimeout(() => resetTypeahead(state), 700);
  
      let query = state.typeaheadQuery;
      const start = Math.max(0, state.activeIndex + 1);
      const orderedRows = rows.slice(start).concat(rows.slice(0, start));
      let match = orderedRows.find((row) => String(row.textContent || "").trim().toLowerCase().startsWith(query));
  
      if (!match && query.length > 1) {
        state.typeaheadQuery = normalizedChar;
        query = normalizedChar;
        match = orderedRows.find((row) => String(row.textContent || "").trim().toLowerCase().startsWith(query));
      }
  
      if (!match) {
        return false;
      }
  
      setActiveRow(state, rows.indexOf(match));
      return true;
    }
  
    function substituteTemplate(text, key, value) {
      return String(text || "").split("${" + key + "}").join(String(value));
    }
  
    function materializeVariant(prompt, value) {
      if (!prompt.variants) return prompt;
      const { key, slugTemplate } = prompt.variants;
      return {
        category: prompt.category,
        slug: substituteTemplate(slugTemplate, key, value),
        title: substituteTemplate(prompt.title, key, value),
        body: substituteTemplate(prompt.body, key, value),
      };
    }
  
    function activateRow(state, index) {
      const rows = state.rows || [];
      const row = rows[index];
      if (!row) return;
      const entry = state.promptForRow.get(row);
      if (!entry) return;
      const prompt = entry.value != null ? materializeVariant(entry.prompt, entry.value) : entry.prompt;
      const inserted = state.insertIntoComposer(prompt.body, prompt);
      closePopover(state, { restoreFocus: false });
      if (inserted !== false) {
        state.toast(`Prompt inserted: ${prompt.title}`);
      }
    }
  
  
    function expandPromptEntries(prompt) {
      if (!prompt.variants) {
        return [{ prompt, value: null, displayTitle: prompt.title, displayBody: prompt.body }];
      }
      const { key, values } = prompt.variants;
      return values.map((value) => ({
        prompt,
        value,
        displayTitle: substituteTemplate(prompt.title, key, value),
        displayBody: substituteTemplate(prompt.body, key, value),
      }));
    }
  
    function renderPromptRow(container, state, entry) {
      const row = document.createElement("div");
  
      row.id = `${state.ids.popover}-row-${state.rows.length}`;
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", "false");
      row.textContent = entry.displayTitle;
      row.title = entry.displayBody.slice(0, 120);
      row.tabIndex = -1;
      row.style.cssText = [
        "display:block",
        "width:100%",
        "padding:7px 8px",
        "border-radius:6px",
        "background:transparent",
        "color:#fff",
        "font:700 11px Inter,system-ui,sans-serif",
        "text-align:left",
        "cursor:pointer",
        "overflow:hidden",
        "text-overflow:ellipsis",
        "white-space:nowrap",
        "user-select:none",
      ].join(";");
  
      const rowIndex = state.rows.length;
  
      row.addEventListener("mouseenter", () => setActiveRow(state, rowIndex));
      row.addEventListener("mouseleave", () => {
        row.style.background = state.activeIndex === rowIndex ? "rgba(255,255,255,.14)" : "transparent";
      });
      row.addEventListener("mousedown", (ev) => ev.preventDefault());
      row.addEventListener("click", () => activateRow(state, rowIndex));
  
      container.appendChild(row);
      state.rows.push(row);
      state.promptForRow.set(row, entry);
    }
  
  
    function renderCategoryGroup(container, category) {
      const group = document.createElement("div");
      const heading = document.createElement("div");
      const groupId = `${container.id || "vbx-prompts-list"}-group-${String(category).toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`;
  
      heading.id = groupId;
      heading.textContent = category;
      heading.style.cssText = "padding:7px 8px 3px;color:#fff;font:900 10px Inter,system-ui,sans-serif;text-transform:uppercase;opacity:.75";
      group.setAttribute("role", "group");
      group.setAttribute("aria-labelledby", groupId);
      group.appendChild(heading);
      container.appendChild(group);
      return group;
    }
  
    function chipLabel(entry) {
      if (entry.value != null) return String(entry.value);
      const m = String(entry.displayTitle || "").match(/\d+/);
      return m ? m[0] : entry.displayTitle;
    }
  
    function isCompactGroup(entries) {
      if (entries.length < 2) return false;
      return entries.every((e) => e.value != null) || entries.every((e) => /\d/.test(e.displayTitle));
    }
  
    function renderChip(container, state, entry, label) {
      const chip = document.createElement("div");
  
      chip.id = `${state.ids.popover}-row-${state.rows.length}`;
      chip.setAttribute("role", "option");
      chip.setAttribute("aria-selected", "false");
      chip.textContent = label;
      chip.title = entry.displayTitle;
      chip.tabIndex = -1;
      chip.style.cssText = [
        "min-width:28px",
        "padding:4px 8px",
        "border-radius:6px",
        "background:rgba(255,255,255,.08)",
        "border:1px solid rgba(255,255,255,.22)",
        "color:#fff",
        "font:800 11px Inter,system-ui,sans-serif",
        "cursor:pointer",
        "user-select:none",
      ].join(";");
  
      const rowIndex = state.rows.length;
      chip.addEventListener("mouseenter", () => setActiveRow(state, rowIndex));
      chip.addEventListener("mousedown", (ev) => ev.preventDefault());
      chip.addEventListener("click", () => activateRow(state, rowIndex));
  
      container.appendChild(chip);
      state.rows.push(chip);
      state.promptForRow.set(chip, entry);
    }
  
    function renderCompact(group, state, entries) {
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;padding:2px 8px 6px";
      group.appendChild(wrap);
      entries
        .slice()
        .sort((a, b) => Number(chipLabel(a)) - Number(chipLabel(b)))
        .forEach((e) => renderChip(wrap, state, e, chipLabel(e)));
    }
  
    function renderPromptsList(state, filterText) {
      const container = state.list;
      const needle = String(filterText || "").trim().toLowerCase();
      let rendered = 0;
  
      container.innerHTML = "";
      state.rows = [];
      state.promptForRow = new WeakMap();
      state.activeIndex = -1;
      resetTypeahead(state);
  
      for (const [category, prompts] of groupedPrompts(state.prompts)) {
        const entries = prompts.flatMap(expandPromptEntries);
        const matches = entries.filter((entry) => {
          if (!needle) return true;
          return entry.displayTitle.toLowerCase().includes(needle) || entry.displayBody.toLowerCase().includes(needle);
        });
  
        if (matches.length === 0) continue;
  
        const group = renderCategoryGroup(container, category);
  
        if (!needle && isCompactGroup(matches)) {
          renderCompact(group, state, matches);
          rendered += matches.length;
          continue;
        }
  
        for (const entry of matches) {
          renderPromptRow(group, state, entry);
          rendered += 1;
        }
      }
  
      if (rendered === 0) {
        renderEmpty(container, state, needle.length > 0);
        setActiveRow(state, -1);
      } else {
        setActiveRow(state, 0);
      }
    }
  
  
  
  
    function buildPopover(state) {
      const existing = document.getElementById(state.ids.popover);
  
      if (existing) {
        existing.remove();
      }
  
      const popover = document.createElement("div");
  
      popover.id = state.ids.popover;
      popover.tabIndex = -1;
      popover.setAttribute("role", "dialog");
      popover.setAttribute("aria-label", "Bundled prompts");
      popover.style.cssText = [
        "position:fixed",
        "z-index:10000",
        "display:none",
        "width:260px",
        "max-height:320px",
        "overflow:hidden",
        "padding:6px",
        "border-radius:8px",
        "background:rgba(24,24,32,.98)",
        "border:1px solid rgba(255,255,255,.22)",
        "box-shadow:0 18px 40px rgba(0,0,0,.38)",
      ].join(";");
  
      const list = document.createElement("div");
  
      list.id = `${state.ids.popover}-listbox`;
      list.dataset.promptsList = "true";
      list.tabIndex = -1;
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", "Bundled prompts");
      list.style.cssText = "max-height:260px;overflow-y:auto";
      state.list = list;
  
      if (state.prompts.length > 12) {
        const search = document.createElement("input");
  
        search.type = "search";
        search.placeholder = "Search prompts";
        search.style.cssText = "width:100%;height:28px;margin:0 0 6px;padding:0 8px;border-radius:6px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font:700 11px Inter,system-ui,sans-serif";
        search.addEventListener("input", () => renderPromptsList(state, search.value));
        popover.appendChild(search);
        state.search = search;
      }
  
      popover.appendChild(list);
      document.body.appendChild(popover);
      state.popover = popover;
      renderPromptsList(state, "");
  
      return popover;
    }
  
    function positionPopover(state) {
      // Gap 3: bail if either node was detached externally (e.g. React re-render).
      if (!state.button || !state.button.isConnected) return;
      if (!state.popover || !state.popover.isConnected) return;
  
      // Gap 1: ensure the popover is laid out before measuring; otherwise
      // scrollHeight/offsetHeight return 0 (display:none) and naturalHeight
      // collapses to the 320 fallback, breaking flip-up and maxHeight math.
      const priorDisplay = state.popover.style.display;
      const priorVisibility = state.popover.style.visibility;
      if (priorDisplay === "none") {
        state.popover.style.visibility = "hidden";
        state.popover.style.display = "block";
      }
  
      const rect = state.button.getBoundingClientRect();
      const edge = 8;
      const gap = 6;
      const popoverWidth = state.popover.offsetWidth || 260;
      const naturalHeight = state.popover.scrollHeight || state.popover.offsetHeight || 320;
      const spaceBelow = window.innerHeight - rect.bottom - gap - edge;
      const spaceAbove = rect.top - gap - edge;
      const flipUp = spaceBelow < naturalHeight && spaceAbove > spaceBelow;
      const availableHeight = Math.max(96, flipUp ? spaceAbove : spaceBelow);
      const popoverHeight = Math.min(320, naturalHeight, availableHeight);
      const listHeight = Math.max(48, popoverHeight - (state.search ? 46 : 12));
      const maxLeft = Math.max(edge, window.innerWidth - popoverWidth - edge);
      const maxTop = Math.max(edge, window.innerHeight - popoverHeight - edge);
      const wantedTop = flipUp ? rect.top - popoverHeight - gap : rect.bottom + gap;
  
      state.popover.style.maxHeight = `${popoverHeight}px`;
      if (state.list) state.list.style.maxHeight = `${listHeight}px`;
      state.popover.style.left = `${Math.max(edge, Math.min(maxLeft, rect.left))}px`;
      state.popover.style.top = `${Math.max(edge, Math.min(maxTop, wantedTop))}px`;
      state.popover.dataset.placement = flipUp ? "top" : "bottom";
  
      // Restore display/visibility — openPopover sets display:block after this.
      if (priorDisplay === "none") {
        state.popover.style.display = priorDisplay;
        state.popover.style.visibility = priorVisibility;
      }
    }
  
    function openPopover(state) {
      const popover = state.popover && state.popover.isConnected ? state.popover : buildPopover(state);
  
      closePopover(state, { restoreFocus: false });
      // Gap 3: reset stale search filter so reopen always shows the full list.
      if (state.search) {
        state.search.value = "";
      }
      renderPromptsList(state, "");
      positionPopover(state);
      popover.style.display = "block";
      state.button.setAttribute("aria-expanded", "true");
  
      state.runtime.promptButtonOutsideListener = (ev) => {
        if (popover.contains(ev.target) || state.button.contains(ev.target)) {
          return;
        }
  
        closePopover(state, { restoreFocus: false });
      };
  
      state.runtime.promptButtonKeyListener = (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          closePopover(state, { restoreFocus: true });
          return;
        }
  
        const rows = state.rows || [];
  
        if (rows.length === 0) {
          return;
        }
  
        if (ev.key === "ArrowDown") {
          ev.preventDefault();
          setActiveRow(state, state.activeIndex + 1);
        } else if (ev.key === "ArrowUp") {
          ev.preventDefault();
          setActiveRow(state, state.activeIndex - 1);
        } else if (ev.key === "PageDown") {
          ev.preventDefault();
          setActiveRow(state, Math.min(rows.length - 1, state.activeIndex + 10));
        } else if (ev.key === "PageUp") {
          ev.preventDefault();
          setActiveRow(state, Math.max(0, state.activeIndex - 10));
        } else if (ev.key === "Home") {
          ev.preventDefault();
          setActiveRow(state, 0);
        } else if (ev.key === "End") {
          ev.preventDefault();
          setActiveRow(state, rows.length - 1);
        } else if (ev.key === "Enter") {
          if (state.activeIndex >= 0 && state.activeIndex < rows.length) {
            ev.preventDefault();
            activateRow(state, state.activeIndex);
          }
        } else if (!ev.metaKey && !ev.ctrlKey && !ev.altKey && ev.key.length === 1 && ev.target !== state.search) {
          if (moveByTypeahead(state, ev.key)) {
            ev.preventDefault();
          }
        }
      };
  
      state.runtime.promptButtonRepositionListener = () => positionPopover(state);
  
      document.addEventListener("mousedown", state.runtime.promptButtonOutsideListener, true);
      document.addEventListener("keydown", state.runtime.promptButtonKeyListener, true);
      window.addEventListener("scroll", state.runtime.promptButtonRepositionListener, true);
      window.addEventListener("resize", state.runtime.promptButtonRepositionListener);
  
      if (state.search) {
        state.search.setAttribute("aria-controls", state.list.id);
        state.search.focus();
        syncActiveDescendantOwner(state);
      } else if (state.list) {
        state.list.focus({ preventScroll: true });
        syncActiveDescendantOwner(state);
      }
    }
  
    function unmountState(state) {
      closePopover(state);
  
      if (state.button && state.onButtonClick) {
        state.button.removeEventListener("click", state.onButtonClick);
      }
  
      if (state.button) {
        state.button.remove();
      }
  
      if (state.popover) {
        state.popover.remove();
      }
    }
  
    function mount(options = {}) {
      const container = options.container;
      const anchorBeforeEl = options.anchorBeforeEl;
      const root = window;
      const ids = { ...DEFAULT_IDS, ...(options.ids || {}) };
  
      if (root[GLOBAL_MOUNT_KEY] && typeof root[GLOBAL_MOUNT_KEY].unmount === "function") {
        root[GLOBAL_MOUNT_KEY].unmount();
      }
  
      if (!container || !anchorBeforeEl) {
        document.getElementById(ids.button)?.remove();
        document.getElementById(ids.popover)?.remove();
        root[GLOBAL_MOUNT_KEY] = null;
        return { button: null, unmount: noop };
      }
  
      const state = {
        ids,
        prompts: normalizePrompts(options.prompts),
        insertIntoComposer: typeof options.insertIntoComposer === "function" ? options.insertIntoComposer : noop,
        toast: typeof options.toast === "function" ? options.toast : noop,
        runtime: getRuntime(options),
        buttonCss: typeof options.buttonCss === "string" ? options.buttonCss : "height:30px;padding:0 10px;border:0;border-radius:8px;cursor:pointer;color:#fff;font:800 11px Inter,system-ui,sans-serif;letter-spacing:0;white-space:nowrap;min-width:0",
        button: null,
        popover: null,
        list: null,
        search: null,
        onButtonClick: null,
        rows: [],
        promptForRow: new WeakMap(),
        activeIndex: -1,
        typeaheadQuery: "",
        typeaheadTimer: null,
      };
  
      const existingButton = document.getElementById(state.ids.button);
  
      if (existingButton) {
        existingButton.remove();
      }
  
      const button = buildButton(state);
  
      state.button = button;
      state.onButtonClick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
  
        const popover = state.popover && state.popover.isConnected ? state.popover : document.getElementById(state.ids.popover);
  
        if (popover && popover.style.display !== "none") {
          closePopover(state);
        } else {
          openPopover(state);
        }
      };
  
      button.addEventListener("click", state.onButtonClick);
      // Gap 2: respect the anchor's actual parent so the Prompts button always
      // lands immediately before Run-queue, even when callers pass a `container`
      // that isn't the anchor's direct parent.
      const anchorParent = anchorBeforeEl.parentElement;
      if (anchorParent) {
        anchorParent.insertBefore(button, anchorBeforeEl);
      } else {
        container.appendChild(button);
      }
  
      const mountHandle = {
        button,
        unmount() {
          unmountState(state);
        },
      };
  
      root[GLOBAL_MOUNT_KEY] = mountHandle;
      return mountHandle;
    }
  
    window.__vbxPromptButton = {
      version: "v1",
      scriptFile: SCRIPT_FILE,
      mount,
    };
  })();
  // <vbx:prompt-button-runtime:end>

  // ==========================================================================
  // logErr — central error logger. NEVER swallow inside a catch.
  // ==========================================================================

  /**
   * Print a caught error in a way that always includes:
   *   - script file name
   *   - function name (caller-supplied; the implicit caller is usually correct)
   *   - a best-effort line number parsed from err.stack
   *   - the raw Error object (so DevTools shows the expandable stack)
   *   - err.name, err.message, err.stack as individual console.log lines
   *     so nothing is hidden when the object gets compiled / minified.
   */
  function logErr(err, fnName) {
    const safeFn = typeof fnName === "string" && fnName.length > 0 ? fnName : "<anonymous>"; // fallback name

    let line = "?"; // best-effort line:column from the first stack frame inside this file

    try {
      const stack = err && typeof err.stack === "string" ? err.stack : ""; // some thrown values lack .stack
      const match = stack.match(/next-button\.v14\.js[^\d]*(\d+)(?::(\d+))?/); // first frame inside this file

      if (match) {
        line = match[2] ? match[1] + ":" + match[2] : match[1]; // include column when present
      }
    } catch (inner) {
      console.log("[" + SCRIPT_FILE + "] logErr() failed to parse stack:", inner); // never let the logger throw
    }

    const header = "[" + SCRIPT_FILE + " @" + line + " :: " + safeFn + "]"; // single common prefix

    console.log(header, "error raw object:", err); // expandable in DevTools

    if (err && typeof err === "object") {
      console.log(header, "error.name:", err.name); // e.g. "TypeError"
      console.log(header, "error.message:", err.message); // human-readable message
      console.log(header, "error.stack:", err.stack); // full stack as a string
    } else {
      console.log(header, "non-Error thrown value (typeof " + typeof err + "):", err); // primitives etc.
    }
  }

  // ==========================================================================
  // CONFIG — same structure as V5/V6/V7, with a `taskWait` group from V6.
  // ==========================================================================

  const CONFIG = {
    ids: {
      wrap: "vbx-next-only-wrap", // outer flex container we inject
      nextBtn: "vbx-next-btn", // the "Next →" enqueue button
      runBtn: "vbx-run-btn", // the "Run queue ▶" / "Stop ■" button
      list: "vbx-queue-list", // the queued-prompts list under the composer
      progress: "vbx-queue-progress", // the progress banner inside the wrap
      countSel: "vbx-next-count", // ×N copies selector
      countCustom: "vbx-next-count-custom", // custom ×N <input>
      clearBtn: "vbx-clear-btn", // "Clear ✕" button
      waitSel: "vbx-next-wait", // V6: per-task wait-time selector
      waitCustom: "vbx-next-wait-custom", // V6: custom wait-time <input>
      promptsBtn: "vbx-prompts-btn", // V11: bundled prompt picker button
      promptsPopover: "vbx-prompts-popover", // V11: prompt picker popover
      projectBadge: "vbx-project-badge", // step 21: pinned project id readout
    },

    storage: {
      queue: "vbx_next_queue", // string[] of queued prompts
      running: "vbx_next_running", // boolean — true while a drain is active
      count: "vbx_next_count", // persisted ×N selector value
      progress: "vbx_next_progress", // { current, total, startedAt, ... }
      taskWait: "vbx_next_task_wait_ms", // V6: persisted per-task budget in ms
    },

    timing: {
      pollMs: 250, // poll interval for idle detection
      idlePollsNeeded: 1, // consecutive idle polls required to declare done
      maxTaskWaitMs: 3 * 1000, // V10: default per-task budget = 3s
      popupBusyGraceMs: 1200, // grace period before we believe "idle" without ever seeing busy
    },

    count: {
      min: 1, // smallest enqueue copy count
      max: 100, // largest enqueue copy count
      default: 1, // default copies per Next click
      presets: [1, 2, 3, 4, 5, 7, 8, 10, 12, 14, 15, 18, 20, 25, 30], // dropdown presets for ×N
    },

    taskWait: {
      minSec: 1, // min per-task budget in seconds
      maxSec: 120, // max per-task budget in seconds
      defaultSec: 3, // V10 default budget (3s)
      presetsSec: [1, 2, 3, 4, 5, 7, 8, 10, 12, 14, 15, 18, 20, 25, 30], // dropdown presets for wait
    },
  };

  const WRAP_ID = CONFIG.ids.wrap; // alias for parity with V5..V7 naming
  const BTN_NEXT_ID = CONFIG.ids.nextBtn; // ↑
  const BTN_RUN_ID = CONFIG.ids.runBtn; // ↑
  const LIST_ID = CONFIG.ids.list; // ↑
  const PROGRESS_ID = CONFIG.ids.progress; // ↑
  const COUNT_SEL_ID = CONFIG.ids.countSel; // ↑
  const COUNT_CUSTOM_ID = CONFIG.ids.countCustom; // ↑
  const BTN_CLEAR_ID = CONFIG.ids.clearBtn; // ↑
  const WAIT_SEL_ID = CONFIG.ids.waitSel; // ↑
  const WAIT_CUSTOM_ID = CONFIG.ids.waitCustom; // ↑
  const PROMPTS_BTN_ID = CONFIG.ids.promptsBtn; // ↑
  const PROMPTS_POPOVER_ID = CONFIG.ids.promptsPopover; // ↑
  const PROJECT_BADGE_ID = CONFIG.ids.projectBadge; // step 21
  const BADGE_COLOR_ACTIVE = "rgba(255,255,255,.65)"; // step 21: idle/running tint
  const BADGE_COLOR_PAUSED = "#fbbf24"; // step 21: paused tint (amber)

  const STORAGE_KEY = CONFIG.storage.queue; // chrome.storage.local key for queue
  const RUN_KEY = CONFIG.storage.running; // chrome.storage.local key for running flag
  const COUNT_KEY = CONFIG.storage.count; // chrome.storage.local key for ×N
  const PROGRESS_KEY = CONFIG.storage.progress; // chrome.storage.local key for progress payload
  const TASK_WAIT_KEY = CONFIG.storage.taskWait; // chrome.storage.local key for wait budget

  const POLL_MS = CONFIG.timing.pollMs; // idle poll interval
  const IDLE_POLLS_NEEDED = CONFIG.timing.idlePollsNeeded; // required idle polls after busy
  const DEFAULT_TASK_WAIT_MS = CONFIG.timing.maxTaskWaitMs; // fallback budget when storage empty
  const POPUP_BUSY_GRACE_MS = CONFIG.timing.popupBusyGraceMs; // grace before assuming idle

  const COUNT_MIN = CONFIG.count.min; // clamp lower bound for ×N
  const COUNT_MAX = CONFIG.count.max; // clamp upper bound for ×N
  const COUNT_DEFAULT = CONFIG.count.default; // default ×N
  const COUNT_PRESETS = CONFIG.count.presets; // dropdown values for ×N

  const WAIT_MIN_SEC = CONFIG.taskWait.minSec; // clamp lower bound for wait
  const WAIT_MAX_SEC = CONFIG.taskWait.maxSec; // clamp upper bound for wait
  const WAIT_DEFAULT_SEC = CONFIG.taskWait.defaultSec; // default wait in seconds
  const WAIT_PRESETS_SEC = CONFIG.taskWait.presetsSec; // dropdown values for wait

  // ==========================================================================
  // Module-local state
  // ==========================================================================

  let queue = []; // @type {string[]} — pending prompts

  let running = false; // true while drainQueueLocally is active

  let stopFlag = false; // set by stopRun() to short-circuit the loop

  let paused = false; // step 15.5: pauseQueue() sets true so drain skips finishRun and runQueue knows to Resume

  let runToken = 0; // bumped to invalidate in-flight drains

  let progressTimer = 0; // setInterval handle for the 1s ticker

  let progressCurrent = 0; // current task index (1-based)

  let progressTotal = 0; // total number of tasks for this run

  let progressCurrentStartedAt = 0; // ms epoch when the current task started

  let progressReason = ""; // human-readable phase ("submitting prompt"...)

  let progressWaitBudgetMs = DEFAULT_TASK_WAIT_MS; // active budget echoed by the banner

  let progressCurrentItem = ""; // raw text of the currently-running prompt

  let progressRemainingItems = []; // @type {string[]} — tail after current

  let runItemTimings = []; // per-completed-item timing records for final overrun summary

  let selectedCount = COUNT_DEFAULT; // current ×N from the selector

  let currentTaskWaitMs = DEFAULT_TASK_WAIT_MS; // active per-task budget, hydrated in inject()

  const GLOBAL_RUNTIME_KEY = "__vbx_next_button_v11_runtime"; // shared page-wide singleton for timers/listeners across v11/v12 re-injection

  /** Fetch the page-wide runtime holder used to clean up older injected copies. */
  function getGlobalRuntime() {
    const root = window; // content script page global

    if (!root[GLOBAL_RUNTIME_KEY] || typeof root[GLOBAL_RUNTIME_KEY] !== "object") {
      root[GLOBAL_RUNTIME_KEY] = {}; // initialize once per page
    }

    return root[GLOBAL_RUNTIME_KEY];
  }

  /** Stop the active progress repaint timer and forget both local/global handles. */
  function clearProgressTimerHandle() {
    const runtime = getGlobalRuntime(); // shared holder may contain an older copy's interval

    if (progressTimer) {
      clearInterval(progressTimer); // local timer for this injected copy
    }

    if (runtime.progressTimer && runtime.progressTimer !== progressTimer) {
      clearInterval(runtime.progressTimer); // stale timer from a prior injected copy
    }

    progressTimer = 0; // local handle nulled in the same cleanup branch
    runtime.progressTimer = 0; // global handle nulled too
  }

  // ==========================================================================
  // Wait-time helpers (from V6)
  // ==========================================================================

  /** Clamp arbitrary input into [WAIT_MIN_SEC, WAIT_MAX_SEC] integer seconds. */
  function clampWaitSec(n) {
    const v = Math.floor(Number(n)); // coerce strings/floats to int

    if (!Number.isFinite(v)) {
      return WAIT_DEFAULT_SEC; // NaN / Infinity → safe default
    }

    return Math.max(WAIT_MIN_SEC, Math.min(WAIT_MAX_SEC, v)); // clamp into range
  }

  /** Load persisted per-task budget (ms). Falls back to default. */
  function loadTaskWaitMs() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([TASK_WAIT_KEY], (res) => {
          const v = res && res[TASK_WAIT_KEY]; // raw stored value
          const sec = clampWaitSec(typeof v === "number" ? v / 1000 : WAIT_DEFAULT_SEC); // ms → clamped seconds

          resolve(sec * 1000); // back to ms for callers
        });
      } catch (e) {
        logErr(e, "loadTaskWaitMs");
        resolve(WAIT_DEFAULT_SEC * 1000); // never deadlock the await chain
      }
    });
  }

  /** Persist the current per-task budget. */
  function saveTaskWaitMs() {
    try {
      chrome.storage.local.set({ [TASK_WAIT_KEY]: currentTaskWaitMs }); // mirror in-memory → storage
    } catch (e) {
      logErr(e, "saveTaskWaitMs");
    }
  }

  /** Read the wait selector value from the live UI; returns ms. */
  function readWaitMsFromUI() {
    const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById(WAIT_SEL_ID)); // dropdown
    const custom = /** @type {HTMLInputElement|null}  */ (document.getElementById(WAIT_CUSTOM_ID)); // custom input

    if (!sel) {
      return currentTaskWaitMs; // UI not injected yet — keep current
    }

    const sec =
      sel.value === "custom"
        ? clampWaitSec(custom ? custom.value : WAIT_DEFAULT_SEC) // custom path uses the number input
        : clampWaitSec(sel.value); // preset path uses the option value

    return sec * 1000; // ms
  }

  /** Show / hide the custom wait <input> based on selector value. */
  function syncWaitCustomVisibility() {
    const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById(WAIT_SEL_ID));
    const custom = /** @type {HTMLInputElement|null}  */ (document.getElementById(WAIT_CUSTOM_ID));

    if (!sel || !custom) {
      return;
    }

    custom.style.display = sel.value === "custom" ? "inline-block" : "none"; // toggle visibility
  }

  /** Apply a loaded ms value back to the selector/custom input. */
  function applyLoadedWaitToUI(ms) {
    const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById(WAIT_SEL_ID));
    const custom = /** @type {HTMLInputElement|null}  */ (document.getElementById(WAIT_CUSTOM_ID));

    if (!sel || !custom) {
      return;
    }

    const sec = Math.round(ms / 1000); // ms → seconds for the UI

    if (WAIT_PRESETS_SEC.includes(sec)) {
      sel.value = String(sec); // preset matches → select it
      custom.value = ""; // clear custom input
    } else {
      sel.value = "custom"; // non-preset → switch to custom
      custom.value = String(clampWaitSec(sec)); // populate the custom field
    }

    syncWaitCustomVisibility(); // keep custom visibility consistent
  }

  // ==========================================================================
  // Count selector helpers (unchanged from V5)
  // ==========================================================================

  /** Clamp arbitrary input into [COUNT_MIN, COUNT_MAX] integer copies. */
  function clampCount(n) {
    const v = Math.floor(Number(n)); // int coercion

    if (!Number.isFinite(v)) {
      return COUNT_DEFAULT; // NaN/Infinity → 1
    }

    return Math.max(COUNT_MIN, Math.min(COUNT_MAX, v)); // clamp
  }

  /** Load persisted ×N value; falls back to default. */
  function loadCount() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([COUNT_KEY], (res) => {
          const v = res && res[COUNT_KEY]; // raw stored ×N

          resolve(clampCount(v != null ? v : COUNT_DEFAULT)); // clamp before returning
        });
      } catch (e) {
        logErr(e, "loadCount");
        resolve(COUNT_DEFAULT);
      }
    });
  }

  /** Persist the current ×N selection. */
  function saveCount() {
    try {
      chrome.storage.local.set({ [COUNT_KEY]: selectedCount }); // mirror in-memory → storage
    } catch (e) {
      logErr(e, "saveCount");
    }
  }

  /** Read the ×N selector from the live UI. */
  function readCountFromUI() {
    const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById(COUNT_SEL_ID));
    const custom = /** @type {HTMLInputElement|null}  */ (document.getElementById(COUNT_CUSTOM_ID));

    if (!sel) {
      return selectedCount; // UI not present → use in-memory
    }

    if (sel.value === "custom") {
      return clampCount(custom ? custom.value : COUNT_DEFAULT); // custom path
    }

    return clampCount(sel.value); // preset path
  }

  /** Show / hide the custom ×N input based on selector value. */
  function syncCustomVisibility() {
    const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById(COUNT_SEL_ID));
    const custom = /** @type {HTMLInputElement|null}  */ (document.getElementById(COUNT_CUSTOM_ID));

    if (!sel || !custom) {
      return;
    }

    custom.style.display = sel.value === "custom" ? "inline-block" : "none"; // toggle
  }

  /** Apply a loaded ×N value back to the selector/custom input. */
  function applyLoadedCountToUI(n) {
    const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById(COUNT_SEL_ID));
    const custom = /** @type {HTMLInputElement|null}  */ (document.getElementById(COUNT_CUSTOM_ID));

    if (!sel || !custom) {
      return;
    }

    if (COUNT_PRESETS.includes(n)) {
      sel.value = String(n); // preset
      custom.value = ""; // clear custom
    } else {
      sel.value = "custom"; // non-preset
      custom.value = String(n);
    }

    syncCustomVisibility(); // ensure custom shows/hides correctly
    updateNextBadge(); // badge text depends on ×N
  }

  // ==========================================================================
  // Storage / input / toast (verbatim from V5)
  // ==========================================================================

  /** Load the persisted queue; always resolves to a string[]. */
  function loadQueue() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([STORAGE_KEY], (res) => {
          const v = res && res[STORAGE_KEY]; // raw stored value

          resolve(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []); // sanitize
        });
      } catch (e) {
        logErr(e, "loadQueue");
        resolve([]);
      }
    });
  }

  /** Persist the in-memory queue. */
  function saveQueue() {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: queue }); // mirror in-memory → storage
    } catch (e) {
      logErr(e, "saveQueue");
    }
  }

  /** Set a textarea/input value via the React-friendly native setter and dispatch input/change. */
  function setNativeValue(input, value) {
    const proto =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype // textarea proto
        : HTMLInputElement.prototype; // input proto

    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set; // native setter (bypasses React)

    if (setter) {
      setter.call(input, value); // preferred path
    } else {
      input.value = value; // fallback
    }

    input.dispatchEvent(new Event("input", { bubbles: true })); // React onChange relies on this
    input.dispatchEvent(new Event("change", { bubbles: true })); // some libs listen on change
  }

  /** Tiny bottom-centered toast notification. */
  function toast(message) {
    const el = document.createElement("div"); // freshly-built each call

    el.textContent = message; // user-visible text
    el.style.cssText = [
      "position:fixed", // overlay anywhere
      "left:50%", // anchor to center
      "bottom:18px", // 18px above bottom edge
      "transform:translateX(-50%)", // perfect horizontal centering
      "z-index:9999", // above app chrome
      "padding:8px 12px", // breathing room
      "border-radius:8px", // soft corners
      "background:rgba(35,35,43,.96)", // near-opaque dark surface
      "border:1px solid rgba(162,89,255,.35)", // purple accent border
      "color:#fff", // white text
      "font:700 12px Inter,system-ui,sans-serif", // small bold UI font
      "box-shadow:0 10px 26px rgba(0,0,0,.35)", // soft drop shadow
      "opacity:0", // start hidden for fade-in
      "transition:opacity .16s ease, transform .16s ease", // animated entry/exit
    ].join(";");

    document.body.appendChild(el); // mount

    requestAnimationFrame(() => {
      el.style.opacity = "1"; // fade in
      el.style.transform = "translateX(-50%) translateY(-4px)"; // small lift
    });

    setTimeout(() => {
      el.style.opacity = "0"; // fade out
      setTimeout(() => el.remove(), 180); // detach after transition
    }, 1400);
  }

  // ==========================================================================
  // Queue list UI (unchanged from V5)
  // ==========================================================================

  /** Ensure the queued-prompts list container exists below the composer. */
  function ensureListContainer() {
    let list = document.getElementById(LIST_ID); // existing container?

    if (list) {
      return list;
    }

    const input = document.getElementById("chat-input"); // anchor: the composer textarea

    if (!input) {
      return null; // composer not yet ready
    }

    const shell = input.closest(".chat-input-shell") || input.parentElement; // wrap to insert after

    if (!shell || !shell.parentElement) {
      return null;
    }

    list = document.createElement("div"); // build new container
    list.id = LIST_ID;
    list.style.cssText = [
      "margin:6px 0 0", // small top margin under composer
      "display:flex", // vertical stack via flex
      "flex-direction:column", // one row per queued prompt
      "gap:4px", // spacing between rows
      "max-height:140px", // cap height; scroll past
      "overflow-y:auto", // vertical scroll for long queues
      "font:600 11px Inter,system-ui,sans-serif", // compact UI font
    ].join(";");

    shell.parentElement.insertBefore(list, shell.nextSibling); // mount right after composer shell

    return list;
  }

  /**
   * Step 14: pure DOM builder for one queue row.
   * Returns { row, rm } so the caller (renderList) can attach the remove-click
   * handler that closes over the per-iteration `idx`. No listeners, no state
   * mutation here — exact same markup/styles as the prior inline version.
   */
  function buildQueueRow(text, idx) {
    const row = document.createElement("div"); // one row per queued prompt

    row.style.cssText = [
      "display:flex", // horizontal layout for # | text | ×
      "align-items:center", // vertically centered
      "gap:6px", // gap between cells
      "padding:5px 8px", // inner padding
      "border-radius:6px", // rounded row
      "background:rgba(162,89,255,.08)", // faint purple wash
      "border:1px solid rgba(162,89,255,.20)", // subtle purple border
      "color:var(--text,#e7e7ea)", // theme-aware text color
    ].join(";");

    const num = document.createElement("span"); // 1-based index cell

    num.textContent = String(idx + 1);
    num.style.cssText = "flex:0 0 16px;text-align:center;color:#fff;font-weight:800"; // V10: white index for readability

    const body = document.createElement("span"); // truncated prompt cell

    body.textContent = text.length > 80 ? text.slice(0, 77) + "…" : text; // truncate long text
    body.style.cssText = "flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"; // ellipsis on overflow
    body.title = text; // full text on hover

    const rm = document.createElement("button"); // remove-this-row button

    rm.type = "button";
    rm.textContent = "×";
    rm.title = running ? "Queue is locked while running" : "Remove";
    rm.disabled = running;
    rm.style.cssText = [
      "flex:0 0 auto", // do not stretch
      "width:18px", // tight square
      "height:18px", // tight square
      "border:0", // borderless
      "border-radius:4px", // gentle corners
      "background:transparent", // blend with row
      "color:#fff", // white "×"
      `cursor:${running ? "not-allowed" : "pointer"}`, // lock removals during drain
      `opacity:${running ? "0.35" : "1"}`, // show disabled state without hiding row
      "font:800 14px Inter,system-ui,sans-serif", // bold close glyph
      "line-height:1", // tight vertical alignment
    ].join(";");

    row.appendChild(num);
    row.appendChild(body);
    row.appendChild(rm);

    return { row, rm }; // caller wires the click handler so it can close over idx
  }

  const TASKS_HEADER_ID = "vbx-tasks-header"; // V16: collapsible "Tasks (N)" toggle mounted above the queue list
  let tasksExpanded = false; // V16: list collapsed by default — header alone shows the total count

  /** V16: build (once) the collapsible "Tasks (N)" header right above the queue list. */
  function ensureTasksHeader(list) {
    let header = document.getElementById(TASKS_HEADER_ID);
    if (header) return header;
    if (!list || !list.parentElement) return null;
    header = document.createElement("button");
    header.id = TASKS_HEADER_ID;
    header.type = "button";
    header.style.cssText = [
      "margin:6px 0 0",
      "padding:4px 8px",
      "display:flex",
      "align-items:center",
      "gap:6px",
      "background:rgba(255,255,255,.05)",
      "border:1px solid rgba(255,255,255,.08)",
      "border-radius:6px",
      "color:#fff",
      "font:700 11px Inter,system-ui,sans-serif",
      "cursor:pointer",
      "text-align:left",
      "width:100%",
    ].join(";");
    header.addEventListener("click", () => {
      tasksExpanded = !tasksExpanded;
      renderList();
    });
    list.parentElement.insertBefore(header, list);
    return header;
  }

  /** Render the queued-prompts list and refresh dependent buttons/badges. */
  function renderList() {
    const list = ensureListContainer();

    if (!list) {
      return;
    }

    const header = ensureTasksHeader(list);
    list.innerHTML = ""; // wipe before re-render

    if (queue.length === 0) {
      list.style.display = "none"; // hide when empty
      if (header) header.style.display = "none"; // V16: header hidden when nothing to summarize
      updateRunButton();
      updateNextBadge();
      return;
    }

    if (header) {
      header.style.display = "flex";
      header.textContent = (tasksExpanded ? "▾" : "▸") + " Tasks (" + queue.length + ")";
      header.title = tasksExpanded ? "Click to collapse the task list" : "Click to expand the task list";
    }

    if (!tasksExpanded) {
      list.style.display = "none"; // V16: collapsed — only the count header is visible
      updateRunButton();
      updateNextBadge();
      return;
    }

    list.style.display = "flex"; // show list

    queue.forEach((text, idx) => {
      const { row, rm } = buildQueueRow(text, idx); // step 14: DOM-only builder

      rm.addEventListener("click", () => {
        if (running) {
          return; // queue head must stay stable until the drain shifts it
        }

        queue.splice(idx, 1); // drop this entry
        saveQueue(); // persist
        renderList(); // re-render (closes over idx via outer forEach)
      });

      list.appendChild(row);
    });

    updateRunButton();
    updateNextBadge();
  }

  /** Refresh the Next button label/badge (shows ×N and queue depth). */
  function updateNextBadge() {
    const btn = document.getElementById(BTN_NEXT_ID);

    if (!btn) {
      return;
    }

    const n = readCountFromUI(); // current ×N
    const base = n > 1 ? `Next ×${n} →` : "Next →"; // append ×N when > 1

    btn.textContent = queue.length > 0 ? `${base} (${queue.length})` : base; // append depth when non-empty
  }

  /** Refresh Run/Stop button + lock controls during runs. */
  /**
   * Step 18: pure state computation for the Run/Stop button + locked controls.
   * No DOM reads, no DOM writes. Caller passes the current `running` flag and
   * `queueLen`; returns the full descriptor that applyControlsDisabled() and
   * the run-button paint use. Splitting compute from apply makes the rules
   * testable and prevents drift between "should be disabled" and "is dimmed".
   *
   *  - controlsDisabled: lock ×N + wait selectors during a run so deadlines
   *    stay stable mid-execution (V6 invariant).
   *  - nextDisabled: can't enqueue while running.
   *  - canClear: only clear when idle AND queue has entries.
   *  - runLabel/runDisabled/runOpacity: "Stop ■" always clickable while
   *    running; "Run queue ▶" disabled+dim when queue is empty.
   */
  function formatRunBudgetLabel(waitMs) {
    const sec = Math.max(1, Math.ceil((waitMs || DEFAULT_TASK_WAIT_MS) / 1000)); // match deadline display rounding

    return `${sec}s`; // compact enough to fit inside the Run button
  }

  function computeRunButtonState(running, queueLen, waitMs) {
    const canClear = !running && queueLen > 0;
    const runBudgetLabel = formatRunBudgetLabel(waitMs); // budget that the next run will arm

    return {
      controlsDisabled: running, // ×N + wait selectors
      nextDisabled: running, // enqueue button
      nextOpacity: running ? "0.55" : "1",
      nextCursor: running ? "not-allowed" : "pointer",
      canClear,
      clearOpacity: canClear ? "1" : "0.45",
      clearCursor: canClear ? "pointer" : "not-allowed",
      runLabel: running ? "Stop ■" : paused ? `Resume ▶ · ${runBudgetLabel}` : `Run queue ▶ · ${runBudgetLabel}`,
      runTitle: running
        ? "Stop the current queue run"
        : paused
          ? "Resume the paused queue on the pinned tab"
          : `Run queued prompts with a ${runBudgetLabel} per-item budget`,
      runDisabled: running ? false : queueLen === 0, // stop always clickable
      runOpacity: running ? "1" : queueLen === 0 ? "0.45" : "1",
    };
  }

  /** Step 19: apply the computed button/control state to live DOM nodes. */
  function applyControlsDisabled(s, nodes) {
    if (nodes.sel) nodes.sel.disabled = s.controlsDisabled; // lock ×N selector during a run
    if (nodes.custom) nodes.custom.disabled = s.controlsDisabled; // lock ×N custom during a run
    if (nodes.waitSel) nodes.waitSel.disabled = s.controlsDisabled; // lock budget mid-run so deadlines stay stable
    if (nodes.waitCustom) nodes.waitCustom.disabled = s.controlsDisabled; // lock budget custom too

    if (nodes.nextBtn) {
      nodes.nextBtn.disabled = s.nextDisabled; // disable enqueue during run
      nodes.nextBtn.style.opacity = s.nextOpacity; // dim when disabled
      nodes.nextBtn.style.cursor = s.nextCursor; // matching cursor
    }

    if (nodes.clearBtn) {
      nodes.clearBtn.disabled = !s.canClear; // toggle disabled
      nodes.clearBtn.style.opacity = s.clearOpacity; // dim when locked
      nodes.clearBtn.style.cursor = s.clearCursor; // matching cursor
    }

    if (!nodes.btn) {
      return;
    }

    nodes.btn.textContent = s.runLabel; // "Stop ■" or "Run queue ▶"
    nodes.btn.title = s.runTitle; // echo armed budget while idle
    nodes.btn.disabled = s.runDisabled;
    nodes.btn.style.opacity = s.runOpacity;
  }

  function updateRunButton() {
    const btn = document.getElementById(BTN_RUN_ID); // Run/Stop button
    const nextBtn = document.getElementById(BTN_NEXT_ID); // Next button
    const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById(COUNT_SEL_ID)); // ×N select
    const custom = /** @type {HTMLInputElement|null}  */ (document.getElementById(COUNT_CUSTOM_ID)); // ×N custom
    const waitSel = /** @type {HTMLSelectElement|null} */ (document.getElementById(WAIT_SEL_ID)); // wait select
    const waitCustom = /** @type {HTMLInputElement|null}  */ (document.getElementById(WAIT_CUSTOM_ID)); // wait custom
    const clearBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById(BTN_CLEAR_ID)); // Clear button

    const s = computeRunButtonState(running, queue.length, currentTaskWaitMs); // step 18: pure state
    const nodes = { btn, nextBtn, sel, custom, waitSel, waitCustom, clearBtn }; // live nodes for DOM apply

    applyControlsDisabled(s, nodes); // step 19: DOM writes kept in one helper
    updateProjectBadge().catch((e) => logErr(e, "updateRunButton.badge")); // step 21+22
  }

  // ==========================================================================
  // Idle detection (verbatim from V5)
  // ==========================================================================

  /** Direct-hit: the captured tabId still exists AND its URL still belongs to the pinned project. */
  async function directHitTab(session) {
    try {
      const tab = await chrome.tabs.get(session.tabId);
      const hasProjectMatch = !!(tab && typeof tab.url === "string" && tab.url.startsWith(session.projectUrl));
      return hasProjectMatch ? tab : null;
    } catch (e) {
      logErr(e, "directHitTab"); // tab was closed or inaccessible — surface and return null
      return null;
    }
  }

  /** URL fallback: list all tabs whose URL begins with the pinned project URL. */
  function queryTabsByProjectUrl(session) {
    return new Promise((resolve) => {
      try {
        chrome.tabs.query({ url: session.projectUrl + "*" }, (tabs) => resolve(tabs || []));
      } catch (e) {
        logErr(e, "queryTabsByProjectUrl");
        resolve([]);
      }
    });
  }

  /** Prefer the original window when several tabs match the pinned project URL. */
  function pickSessionMatch(session, matches) {
    const sameWindow = matches.find((tab) => tab.windowId === session.windowId);
    return sameWindow || matches[0] || null;
  }

  /** Persist the adopted fallback tab; failures are surfaced by saveSession/getLovableTab. */
  async function adoptResolvedTab(session, tab) {
    await saveSession({ ...session, tabId: tab.id, windowId: tab.windowId });
    return tab;
  }

  /**
   * Resolve the queue's pinned target tab from the saved session.
   * NEVER falls back to the foreground tab — that was the v14 drift bug.
   * Order: direct hit → URL fallback (prefer original window) → null.
   */
  async function resolveSessionTab(session) {
    if (!session || session.tabId == null) return null;
    const direct = await directHitTab(session);
    if (direct) return direct;
    const matches = await queryTabsByProjectUrl(session);
    if (matches.length === 0) return null;
    const pick = pickSessionMatch(session, matches);
    return await adoptResolvedTab(session, pick);
  }

  /** Find the pinned Lovable project tab for the active queue session. Returns null if missing. */
  async function getLovableTab() {
    try {
      const session = await loadSession();
      return await resolveSessionTab(session);
    } catch (e) {
      logErr(e, "getLovableTab");
      return null;
    }
  }

  /**
   * One-shot read of the foreground Lovable project tab, used ONLY at Run-click
   * to bootstrap the session. Every subsequent tick uses resolveSessionTab().
   * vbx-allow-active-query: run-bootstrap
   */
  function queryActiveProjectTabForBootstrap() {
    return new Promise((resolve) => {
      try {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
          const tab = (tabs || []).find((t) => parseProjectId(t && t.url));
          resolve(tab || null);
        });
      } catch (e) {
        logErr(e, "queryActiveProjectTabForBootstrap");
        resolve(null);
      }
    });
  }

  /**
   * Runs IN the Lovable page (via chrome.scripting). Returns true when no
   * "generating / stop / loading" markers are present, false otherwise.
   */
  function probeIdleInPage() {
    const sels = [
      'button[aria-label*="Stop" i]', // Stop generating button
      'button[data-testid*="stop" i]', // alt Stop button via testid
      'button[title*="Stop" i]', // alt Stop button via title
      '[data-testid*="generating" i]', // any "generating" testid marker
      '[aria-label*="Generating" i]', // any "Generating" aria-label
      '[aria-label*="thinking" i]', // "thinking" indicator
      '[data-state="loading"]', // generic loading state
    ];

    for (const s of sels) {
      try {
        if (document.querySelector(s)) {
          return false; // any of these means Lovable is still busy
        }
      } catch (inner) {
        logErr(inner, "probeIdleInPage.selector");

        console.log("[" + SCRIPT_FILE + " :: probeIdleInPage.selector] selector:", s); // surface which selector failed
      }
    }

    try {
      const txt = (document.body.innerText || "").toLowerCase(); // last-resort textual scan

      if (txt.includes("stop generating") || txt.includes("generating response") || txt.includes("working on it")) {
        return false; // textual evidence of an in-flight request
      }
    } catch (inner) {
      logErr(inner, "probeIdleInPage.bodyText");
    }

    return true; // no evidence of busy → idle
  }

  /** Bridge: execute probeIdleInPage inside the Lovable tab and return its bool. */
  async function isLovableIdle(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId }, // inject into the lovable tab
        func: probeIdleInPage, // function to run
        world: "MAIN", // run in page world so DOM/selectors match
      });

      return results && results[0] && results[0].result === true; // unwrap script result
    } catch (e) {
      logErr(e, "isLovableIdle");
      return false; // fail-closed so transient probe errors cannot skip queued items
    }
  }

  /** Wait until Lovable goes busy then idle, or the deadline passes. */
  async function waitForLovableIdle(deadline) {
    const start = Date.now(); // poll-loop start time

    let consecutiveIdle = 0; // idle polls observed in a row after seeing busy
    let sawBusy = false; // ever seen busy during this call?

    while (Date.now() < deadline) {
      if (stopFlag) {
        return false; // user pressed Stop
      }

      const elapsed = Date.now() - start; // ms since poll-loop start
      const tab = await getLovableTab(); // re-resolve in case user switched tabs

      if (!tab || tab.id == null) {
        pauseQueue("pinned tab missing"); // step 14: do NOT clearSession — preserve queue/session for Resume
        return false;
      }

      const idle = await isLovableIdle(tab.id); // current page state

      if (stopFlag) {
        return false; // user pressed Stop while we were awaiting
      }

      if (!idle) {
        sawBusy = true; // remember that we observed work in flight
        consecutiveIdle = 0; // reset idle counter
      } else if (sawBusy) {
        consecutiveIdle += 1; // accumulate idle polls after busy
      } else if (elapsed >= POPUP_BUSY_GRACE_MS) {
        return true; // never saw busy and grace expired → assume done
      }

      if (sawBusy && consecutiveIdle >= IDLE_POLLS_NEEDED) {
        return true; // enough idle polls after busy → done
      }

      await sleep(Math.min(POLL_MS, Math.max(0, deadline - Date.now()))); // back off without overshooting deadline
    }

    return true; // deadline reached → caller treats it as done
  }

  /** Simple promise-based sleep. */
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms)); // resolve after ms milliseconds
  }

  /** Resolve true exactly when the per-task deadline expires (for Promise.race). */
  function waitUntilTaskDeadline(deadline) {
    return sleep(Math.max(0, deadline - Date.now())).then(() => true); // never negative, always true
  }

  /** Hold the runner until the armed per-item budget has actually elapsed. */
  async function waitForArmedTaskBudget(deadline) {
    if (Date.now() < deadline) {
      await waitUntilTaskDeadline(deadline); // selected wait is pacing, not only an early-idle cap
    }
  }

  /**
   * Stale-data guard. V6 uses the ACTIVE budget (which may be larger than
   * the V5 default), so anything older than `currentTaskWaitMs` is stale.
   */
  function isFreshProgress(p) {
    if (!p || typeof p.startedAt !== "number") {
      return false; // malformed payload → treat as stale
    }

    const budgetMs = typeof p.waitBudgetMs === "number" ? p.waitBudgetMs : currentTaskWaitMs; // prefer armed budget
    const heartbeatAt = typeof p.ts === "number" ? p.ts : p.startedAt; // V10: active runs repaint/persist every second
    const staleAfterMs = Math.max(2000, budgetMs, currentTaskWaitMs); // keep zombie cleanup but allow real over-budget display

    return Date.now() - heartbeatAt <= staleAfterMs; // fresh when the progress heartbeat is recent
  }

  // ==========================================================================
  // Progress banner (clamp uses the active budget, not the hardcoded 8s)
  // ==========================================================================

  /** Build / fetch the progress banner element appended inside WRAP_ID. */
  function ensureProgressEl() {
    let el = document.getElementById(PROGRESS_ID); // existing banner?

    if (el) {
      return el;
    }

    const wrap = document.getElementById(WRAP_ID); // banner lives inside the wrap

    if (!wrap) {
      return null; // wrap not injected yet
    }

    el = document.createElement("div"); // build new single-line status (no box)
    el.id = PROGRESS_ID;
    el.style.cssText = [
      "flex:1 1 100%", // take full row width inside the wrap
      "margin-top:2px", // tight gap under the button row
      "padding:0", // no padding — no box
      "background:transparent", // no white/purple box
      "border:0", // no border
      "color:rgba(255,255,255,.75)", // subtle status text
      "font:600 11px Inter,system-ui,sans-serif", // compact UI font
      "text-align:left", // align flush left
      "display:none", // hidden until a run starts
      "line-height:1.3", // tight single line
      "white-space:nowrap", // single-line
      "overflow:hidden", // clip overflow
      "text-overflow:ellipsis", // ellipsis long text
    ].join(";");

    wrap.appendChild(el); // mount inside wrap

    return el;
  }

  /** V16: build (once) the small project-id badge. Collapsed by default — shows ⓘ icon; click to reveal full id. */
  function ensureProjectBadge() {
    let el = document.getElementById(PROJECT_BADGE_ID);
    if (el) return el;
    const wrap = document.getElementById(WRAP_ID);
    if (!wrap) return null;
    el = document.createElement("span");
    el.id = PROJECT_BADGE_ID;
    el.dataset.expanded = "0"; // V16: collapsed-by-default
    el.style.cssText =
      "flex:0 0 auto;margin-left:auto;padding:2px 6px;border-radius:4px;font:600 10px Inter,system-ui,sans-serif;color:" +
      BADGE_COLOR_ACTIVE +
      ";background:rgba(255,255,255,.06);white-space:nowrap;cursor:pointer;user-select:none";
    el.addEventListener("click", () => {
      el.dataset.expanded = el.dataset.expanded === "1" ? "0" : "1";
      updateProjectBadge().catch((e) => logErr(e, "projectBadge.toggle"));
    });
    wrap.appendChild(el);
    return el;
  }

  /** V16: paint badge — icon when collapsed, full id when expanded; mirror paused tint. */
  async function updateProjectBadge() {
    const el = ensureProjectBadge();
    if (!el) return;
    const session = await loadSession().catch((e) => {
      logErr(e, "updateProjectBadge.loadSession");
      return null;
    });
    const id = session && session.projectId ? session.projectId : "no session";
    const expanded = el.dataset.expanded === "1";
    const icon = paused ? "⏸" : "ⓘ";
    el.textContent = expanded ? (paused ? "⏸ " + id : id) : icon;
    el.style.color = paused ? BADGE_COLOR_PAUSED : BADGE_COLOR_ACTIVE;
    el.title =
      (paused ? "Queue paused — press Run to resume · " : "Pinned project: ") +
      id +
      " (click to " +
      (expanded ? "hide" : "show") +
      ")";
    applyPausedTint(paused);
  }

  /** Step 22: tint the wrap + queue rows when paused (data-attr drives nothing else). */
  function applyPausedTint(isPaused) {
    const wrap = document.getElementById(WRAP_ID);
    if (!wrap) return;
    wrap.dataset.paused = isPaused ? "1" : "0";
    const list = document.getElementById(LIST_ID);
    if (!list) return;
    list.style.opacity = isPaused ? "0.55" : "1";
    list.style.borderLeft = isPaused ? "3px solid " + BADGE_COLOR_PAUSED : "0";
  }

  /** Active per-task budget in seconds (used by the banner labels). */
  function progressBudgetSec() {
    return Math.max(1, Math.ceil((progressWaitBudgetMs || currentTaskWaitMs) / 1000)); // floor of 1s for display
  }

  /** Current selector budget in seconds (may differ from the armed run budget). */
  function selectedBudgetSec() {
    return Math.max(1, Math.ceil((currentTaskWaitMs || DEFAULT_TASK_WAIT_MS) / 1000)); // floor of 1s for display
  }

  /** Explain budget drift only when a storage/UI change happened after this task armed. */
  function formatBudgetDrift(armedSec, selectedSec) {
    return armedSec === selectedSec ? "" : ` · armed ${armedSec}s; selector now ${selectedSec}s`; // no noise unless the two values differ
  }

  /** Compact a prompt for inline display (collapses whitespace, truncates). */
  function formatPromptSnippet(text) {
    const compact = String(text || "")
      .replace(/\s+/g, " ")
      .trim(); // collapse whitespace

    if (!compact) {
      return "empty prompt"; // placeholder so the banner is never blank
    }

    return compact.length > 42 ? compact.slice(0, 39) + "…" : compact; // 42-char ceiling
  }

  /** Render the "remaining items" line in the banner. */
  function formatRemainingItems(current) {
    const source = progressRemainingItems.length > 0 ? progressRemainingItems : queue.slice(1); // prefer snapshot
    const visible = source.slice(0, 3); // cap the banner so ×100 cannot cover the composer
    const hiddenCount = Math.max(0, source.length - visible.length); // count hidden tail items
    const items = visible.map((text, idx) => `${current + idx + 1}: ${formatPromptSnippet(text)}`); // "N: text"

    if (hiddenCount > 0) {
      items.push(`+${hiddenCount} more`); // compact tail summary
    }

    return items.length > 0 ? ` · remaining items: ${items.join(" | ")}` : " · remaining items: none"; // explicit empty tail message
  }

  /** Step 12 helper: format the first progress-banner line without touching DOM/storage. */
  function formatProgressHeader(current, total, elapsedSec, limitSec, selectedSec) {
    const budgetDrift = formatBudgetDrift(limitSec, selectedSec); // surfaces armed-vs-selector mismatch without changing timing

    if (elapsedSec > limitSec) {
      const overSec = elapsedSec - limitSec; // V10 step 6: explicit overrun text instead of misleading "0s left"

      return `Task ${current} of ${total} · ${elapsedSec}s elapsed · over budget by ${overSec}s (limit ${limitSec}s)${budgetDrift}`;
    }

    const leftSec = Math.max(0, limitSec - elapsedSec); // within budget — standard countdown

    return `Task ${current} of ${total} · ${elapsedSec}s/${limitSec}s elapsed · ${leftSec}s left${budgetDrift}`;
  }

  /** Paint only the status/header line differently when the task is over budget. */
  function applyProgressHeaderStyle(status, isOverBudget) {
    status.style.cssText = isOverBudget
      ? [
          "margin:-1px -3px 3px", // slight inset badge without shifting banner layout
          "padding:2px 5px", // compact highlight padding
          "border-radius:4px", // matches small injected UI controls
          "background:rgba(255,193,7,.18)", // amber warning wash
          "border:1px solid rgba(255,193,7,.45)", // amber warning stroke
          "color:#fff", // keep requested white text
        ].join(";")
      : "color:#fff"; // normal state stays visually quiet
  }

  /**
   * Step 13: pure formatter for the progress banner body lines.
   * Returns the three lines (reason / current / remaining) as plain strings so
   * setProgress() only does DOM assembly. No DOM, no storage, no globals read
   * here — caller supplies everything. Keeps text output byte-identical to the
   * pre-extraction inline version.
   */
  function formatProgressBody(reason, currentText, remainingText) {
    return {
      reasonLine: `reason: ${reason || "submitting prompt"}`, // matches prior default
      currentLine: `current: ${currentText}`, // unchanged label
      remainingLine: remainingText, // already pre-formatted by caller
    };
  }

  /** Paint the progress banner + optionally persist progress to storage. */
  function setProgress(current, total, persist = true) {
    const el = ensureProgressEl();

    if (!el) {
      return; // wrap not present yet
    }

    if (!total || total <= 0) {
      el.style.display = "none"; // hide banner when nothing to show
      el.textContent = ""; // clear text
      delete el.dataset.startedAt; // wipe stamp

      try {
        chrome.storage.local.remove(PROGRESS_KEY); // also wipe persisted progress
      } catch (e) {
        logErr(e, "setProgress.remove");
      }

      return;
    }

    const startedAt = progressCurrentStartedAt || Date.now(); // first paint fills startedAt

    el.dataset.startedAt = String(startedAt); // remember in DOM so re-renders match

    const limitSec = progressBudgetSec(); // armed progress budget in seconds
    const selectorSec = selectedBudgetSec(); // current selector budget in seconds; may differ after cross-popup storage changes
    const elapsed = Math.max(0, Math.round((Date.now() - startedAt) / 1000)); // V10: real elapsed (no longer clamped to limitSec, so the header reports the truth when a task overruns its budget)
    const isOverBudget = elapsed > limitSec; // visual warning only; timing/drain behavior remains unchanged

    el.innerHTML = ""; // wipe previous lines

    const status = document.createElement("div"); // single-line "Task X of Y · ..."

    status.textContent = formatProgressHeader(current, total, elapsed, limitSec, selectorSec); // step 12: pure formatter
    applyProgressHeaderStyle(status, isOverBudget); // highlight only when the task has actually exceeded its armed budget

    el.appendChild(status);

    el.style.display = "none"; // V16: banner suppressed — Run/Stop button mirrors elapsed/limit/left/current/total, so the extra line that appeared during timer mode is gone

    // Mirror compact countdown onto the Run/Stop button so the timer is visible even without the status line.
    try {
      const runBtn = document.getElementById(BTN_RUN_ID);
      if (runBtn && running) {
        const leftSec = Math.max(0, limitSec - elapsed);
        const compact = isOverBudget
          ? `Stop ■ · ${elapsed}s/${limitSec}s (+${elapsed - limitSec}s)`
          : `Stop ■ · ${elapsed}s/${limitSec}s · ${leftSec}s left`;
        runBtn.textContent = `${compact} · ${current}/${total}`;
      }
    } catch (e) {
      logErr(e, "setProgress.runBtnLabel");
    }

    if (persist) {
      try {
        chrome.storage.local.set({
          [PROGRESS_KEY]: {
            current, // task number
            total, // total tasks
            startedAt, // start of current task
            reason: progressReason, // current phase string
            waitBudgetMs: progressWaitBudgetMs, // budget snapshot
            currentItem: progressCurrentItem, // current prompt text
            remainingItems: progressRemainingItems, // remaining prompts snapshot
            ts: Date.now(), // write timestamp
          },
        });
      } catch (e) {
        logErr(e, "setProgress.persist");
      }
    }
  }

  /** Reset in-memory progress state and clear the banner. */
  function clearProgress() {
    clearProgressTimerHandle(); // stop ticker, including stale copies from re-injection
    progressCurrent = 0; // reset current task
    progressTotal = 0; // reset total
    progressCurrentStartedAt = 0; // reset start stamp
    progressReason = ""; // reset phase
    progressWaitBudgetMs = currentTaskWaitMs; // reset snapshot to active budget
    progressCurrentItem = ""; // reset current item text
    progressRemainingItems = []; // reset tail

    setProgress(0, 0); // hide + wipe persisted record
  }

  /** Begin/continue tracking a run; starts the 1s repaint timer once. */
  function trackProgress(current, total, reason = "submitting prompt") {
    if (progressCurrent !== current) {
      progressCurrentStartedAt = Date.now(); // restart stopwatch on task boundary
    }

    progressReason = reason; // current phase
    progressWaitBudgetMs = currentTaskWaitMs; // snapshot budget
    progressCurrentItem = typeof queue[0] === "string" ? queue[0] : ""; // current prompt text
    progressRemainingItems = queue.slice(1); // tail after current
    progressCurrent = current; // task index
    progressTotal = total; // total tasks

    setProgress(current, total); // paint immediately

    clearProgressTimerHandle(); // root cause fix: clear+null any previous painter before creating one

    progressTimer = setInterval(() => {
      if (!running || !progressCurrent || !progressTotal) {
        return; // skip ticks when nothing is in flight
      }

      setProgress(progressCurrent, progressTotal); // 1s repaint to update elapsed/left
    }, 1000);

    getGlobalRuntime().progressTimer = progressTimer; // expose handle so the next injected copy can clean it
  }

  /** Update only the "reason" line without touching the stopwatch. */
  function setProgressReason(reason) {
    progressReason = reason;

    if (progressCurrent && progressTotal) {
      setProgress(progressCurrent, progressTotal); // re-render with new reason
    }
  }

  /** Finalize a run (success, stop, or error) and reset everything. */
  function finishRun(msg) {
    running = false; // unlock UI
    stopFlag = false; // forget stop flag

    const finalMsg = formatRunCompleteMessage(msg, runItemTimings); // capture before clear/reset

    try {
      chrome.storage.local.set({ [RUN_KEY]: false }); // mark run done in storage
    } catch (e) {
      logErr(e, "finishRun");
    }

    clearSession().catch((e) => logErr(e, "finishRun.clearSession")); // drop pinned tab/project

    clearProgress(); // wipe banner + persisted progress
    updateRunButton(); // refresh Run/Stop label
    runItemTimings = []; // reset summary records after the final toast text is built

    if (finalMsg) {
      toast(finalMsg); // user-visible result
    }
  }

  /** Pause the run without clearing session/queue so the user can Resume. */
  function pauseQueue(reason) {
    paused = true; // step 15.5: drain must skip finishRun (which clears session)
    running = false; // unlock UI loop
    stopFlag = true; // short-circuit any in-flight awaits
    try {
      chrome.storage.local.set({ [RUN_KEY]: false });
    } catch (e) {
      // mark run halted for other popups
      logErr(e, "pauseQueue.runKey");
    }
    savePauseReason(reason).catch((e) => logErr(e, "pauseQueue.savePauseReason"));
    clearProgress(); // wipe banner; queue + session intact
    updateRunButton(); // refresh Run/Stop label → will show Resume in step 16
    toast("Queue paused: " + (reason || "unknown") + " — press Run to resume");
  }

  /** Record how far a completed item exceeded its own armed budget. */
  function recordRunItemTiming(index, startedAt, budgetMs) {
    const elapsedMs = Math.max(0, Date.now() - startedAt); // actual wall time for this item
    const lastOverrunMs = Math.max(0, elapsedMs - budgetMs); // requested per-item overrun metric

    runItemTimings.push({ index, elapsedMs, budgetMs, lastOverrunMs }); // store compact summary only
  }

  /** Append a concise overrun summary to the completion toast. */
  function formatRunCompleteMessage(msg, timings) {
    if (!msg) {
      return "";
    }

    const overruns = timings.filter((x) => x.lastOverrunMs > 0); // only noisy items

    if (overruns.length === 0) {
      return msg; // keep the old toast when nothing exceeded budget
    }

    const details = overruns
      .slice(0, 3)
      .map((x) => `#${x.index}+${Math.ceil(x.lastOverrunMs / 1000)}s`) // compact: #2+4s
      .join(", ");
    const suffix = overruns.length > 3 ? ` +${overruns.length - 3} more` : "";

    return `${msg} · overruns: ${details}${suffix}`;
  }

  // ==========================================================================
  // Runner — uses `currentTaskWaitMs` as the per-item deadline.
  // ==========================================================================

  /** Promise-wrapped chrome.runtime.sendMessage that surfaces lastError. */
  function sendBgMessage(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          const lastErr = chrome.runtime.lastError; // capture before it auto-clears

          if (lastErr) {
            logErr(lastErr, "sendBgMessage.callback"); // surface instead of swallow
          }

          resolve(res || null); // always resolve, never reject
        });
      } catch (e) {
        logErr(e, "sendBgMessage");
        resolve(null);
      }
    });
  }

  /** Start a run if the queue is non-empty and a Lovable project tab is active. */
  async function runQueue() {
    if (running) {
      return; // already running
    }

    if (queue.length === 0) {
      toast("Queue is empty");
      return;
    }

    const resumeSession = paused ? await loadSession() : null; // step 16: Resume reuses the pinned session

    let session = resumeSession;
    if (!session) {
      const preTab = await queryActiveProjectTabForBootstrap(); // one-shot active-tab read; resolver takes over after this
      if (!preTab || preTab.id == null) {
        toast("Open a lovable.dev/projects/... tab first");
        return;
      }
      try {
        session = buildSession(preTab);
        await saveSession(session); // pin the queue to THIS tab/project for the entire run
      } catch (e) {
        logErr(e, "runQueue.buildSession");
        toast("Could not pin queue to this tab");
        return;
      }
    }

    paused = false; // step 16: clear pause gate before draining
    clearPauseReason().catch((e) => logErr(e, "runQueue.clearPauseReason")); // wipe persisted Resume flag
    running = true; // lock UI
    stopFlag = false; // fresh start
    if (!resumeSession) runItemTimings = []; // preserve timings across Resume; reset only on fresh runs

    trackProgress(1, queue.length); // banner shows 1 / N immediately
    updateRunButton(); // flip to Stop

    try {
      chrome.storage.local.set({ [RUN_KEY]: true }); // mark run active in storage
    } catch (e) {
      logErr(e, "runQueue.setRunKey");
    }

    drainQueueLocally(++runToken); // kick off the drain loop with a fresh token
  }

  /** Sequentially submit each queued prompt within `currentTaskWaitMs` deadlines. */
  async function drainQueueLocally(token) {
    const total = queue.length; // snapshot total at run start

    for (let current = 1; queue.length > 0; current++) {
      if (stopFlag || token !== runToken) {
        return; // user stopped or another run started
      }

      trackProgress(current, total, "submitting prompt"); // banner: starting next task

      const itemStartedAt = Date.now(); // start time used for post-run overrun summary
      const itemBudgetMs = currentTaskWaitMs; // snapshot so later selector changes do not rewrite this item
      const deadline = itemStartedAt + itemBudgetMs; // V6: deadline uses the user-chosen budget instead of the V5 hardcoded 8s
      const prompt = queue[0]; // peek (we shift after success)
      const submitted = submitPromptInPopup(prompt); // synchronous best-effort submit

      if (!submitted.ok) {
        return finishRun("Composer not ready"); // bail early if composer is missing
      }

      setProgressReason("waiting for popup idle"); // phase 2: composer settles
      await Promise.race([waitForPopupIdle(deadline), waitUntilTaskDeadline(deadline)]); // race vs deadline

      setProgressReason("waiting for Lovable idle"); // phase 3: page settles
      const pageReady = await Promise.race([
        waitForLovableIdle(deadline), // probe inside the page
        waitUntilTaskDeadline(deadline), // hard cap
      ]);

      if (!pageReady) {
        if (paused) return; // step 15.5: pauseQueue already handled bookkeeping — DO NOT clearSession
        return finishRun("Queue stopped"); // genuine stop (deadline or stopFlag from stopRun)
      }

      setProgressReason("holding selected wait budget"); // phase 3b: do not advance faster than the armed per-item time
      await waitForArmedTaskBudget(deadline);

      if (stopFlag || token !== runToken) {
        return; // stopped while holding the pacing floor
      }

      setProgressReason("moving to next item"); // phase 4: advance
      recordRunItemTiming(current, itemStartedAt, itemBudgetMs); // store lastOverrunMs before removing the item
      queue.shift(); // drop the processed prompt
      saveQueue(); // persist new queue
      renderList(); // refresh list UI
    }

    finishRun("Queue complete"); // all done
  }

  /** Stop an in-flight run (does not clear the remaining queue). */
  function stopRun() {
    if (!running) {
      return;
    }

    sendBgMessage({ type: "vbx_queue_stop" }); // notify background worker

    runToken++; // invalidate the in-flight drain
    stopFlag = true; // make the loop bail at its next check
    running = false; // unlock UI
    paused = false; // explicit stop is not resumable

    try {
      chrome.storage.local.set({ [RUN_KEY]: false }); // persist stopped state so other/reloaded popups do not resume a stale run
    } catch (e) {
      logErr(e, "stopRun.setRunKey");
    }

    clearPauseReason().catch((e) => logErr(e, "stopRun.clearPauseReason")); // drop stale Resume flag
    clearSession().catch((e) => logErr(e, "stopRun.clearSession")); // drop pinned tab/project

    const finalMsg = formatRunCompleteMessage("Queue stopped", runItemTimings); // include completed-item overruns, if any

    clearProgress(); // wipe banner
    updateRunButton(); // refresh Run/Stop label
    runItemTimings = []; // do not leak stopped-run timings into the next run

    toast(finalMsg);
  }

  // ==========================================================================
  // Storage subscribers + worker bridge (verbatim from V5, with V6 wait key)
  // ==========================================================================

  /**
   * Step 15: handle a single change to RUN_KEY from storage.
   *
   * Behavior preserved exactly from the inline version:
   *  - newValue truthy → consult PROGRESS_KEY; only mark running when the
   *    progress payload is fresh. Stale → also wipe stopFlag so a future run
   *    isn't pre-cancelled. Always repaints the run button.
   *  - newValue falsy → unconditionally clear running + stopFlag and repaint.
   *
   * Pure delegation: no other globals are touched, no extra reads/writes.
   */
  function handleRunKeyChange(change) {
    if (change.newValue) {
      chrome.storage.local.get([PROGRESS_KEY], (res) => {
        running = isFreshProgress(res && res[PROGRESS_KEY]); // only trust fresh progress

        if (!running) {
          stopFlag = false; // stale → wipe stop flag too
        }

        updateRunButton();
      });
    } else {
      running = false; // explicit RUN_KEY=false
      stopFlag = false;
      updateRunButton();
    }
  }

  /**
   * Step 16: handle a single change to PROGRESS_KEY from storage.
   *
   * Behavior preserved exactly: mirror startedAt / reason / waitBudgetMs /
   * currentItem / remainingItems into the in-memory progress state, then
   * repaint via setProgress(..., persist=false) so we do NOT re-write the
   * same payload we just received (avoids storage echo loops). Stale or
   * empty payloads route to clearProgress() instead.
   *
   * Each field falls back to the existing in-memory value when the incoming
   * field has the wrong type — same defensive checks as the inline version.
   */
  function handleProgressKeyChange(change) {
    const p = change.newValue;

    if (p && p.total > 0 && isFreshProgress(p)) {
      progressCurrentStartedAt = typeof p.startedAt === "number" ? p.startedAt : Date.now(); // mirror start stamp
      progressReason = typeof p.reason === "string" ? p.reason : progressReason; // mirror phase
      progressWaitBudgetMs = typeof p.waitBudgetMs === "number" ? p.waitBudgetMs : progressWaitBudgetMs; // mirror budget
      progressCurrentItem = typeof p.currentItem === "string" ? p.currentItem : progressCurrentItem; // mirror current
      progressRemainingItems = Array.isArray(p.remainingItems)
        ? p.remainingItems.filter((x) => typeof x === "string") // mirror tail (sanitized)
        : progressRemainingItems;

      setProgress(p.current, p.total, false); // paint without re-persisting
    } else {
      clearProgress(); // stale or empty progress → wipe
    }
  }

  /**
   * Step 17: dispatcher for the two "queue-like" storage keys whose changes
   * are independent of run/progress state.
   *
   *  - kind === "queue":  STORAGE_KEY changed. Sanitize the array (drop
   *    non-strings, default to []) and re-render the list. Sanitization is
   *    critical — corrupt payloads from another popup must not crash render.
   *  - kind === "wait":   TASK_WAIT_KEY changed. Only mirror when newValue is
   *    a number; re-clamp through clampWaitSec(seconds)*1000 to enforce
   *    bounds, then reflect into the UI. Non-number values are ignored to
   *    preserve current in-memory budget.
   *
   * Single helper (rather than two) because each branch is 2-3 lines and they
   * share the same shape: read newValue → sanitize → apply → repaint.
   */
  function handleQueueLikeChange(kind, change) {
    if (kind === "queue") {
      const next = change.newValue;

      queue = Array.isArray(next) ? next.filter((x) => typeof x === "string") : []; // sanitize queue
      renderList();
      return;
    }

    if (kind === "wait") {
      const v = change.newValue;

      if (typeof v === "number") {
        currentTaskWaitMs = clampWaitSec(v / 1000) * 1000; // re-clamp into bounds
        applyLoadedWaitToUI(currentTaskWaitMs); // reflect in UI
      }
    }
  }

  /** Mirror storage changes back into in-memory state + UI. */
  function bindStorageSubscribers() {
    try {
      const runtime = getGlobalRuntime(); // holds the previous injected copy's listener

      if (runtime.storageListener) {
        chrome.storage.onChanged.removeListener(runtime.storageListener); // prevent duplicate mirrors after re-injection
      }

      const listener = (changes, area) => {
        if (area !== "local") {
          return; // we only care about local storage
        }

        if (changes[RUN_KEY]) {
          handleRunKeyChange(changes[RUN_KEY]); // step 15
        }

        if (changes[PROGRESS_KEY]) {
          handleProgressKeyChange(changes[PROGRESS_KEY]); // step 16
        }

        if (changes[STORAGE_KEY]) {
          handleQueueLikeChange("queue", changes[STORAGE_KEY]); // step 17
        }

        // V6: if another popup instance changed the wait budget,
        // mirror it into our in-memory + UI state.
        if (changes[TASK_WAIT_KEY]) {
          handleQueueLikeChange("wait", changes[TASK_WAIT_KEY]); // step 17
        }

        if (changes[PAUSED_KEY]) {
          hydratePaused(changes[PAUSED_KEY].newValue); // step 16.5: mirror persisted Resume state
        }
      };

      runtime.storageListener = listener; // make removable by the next injected copy
      chrome.storage.onChanged.addListener(listener);
    } catch (e) {
      logErr(e, "bindStorageSubscribers");
    }
  }

  /** Step 19: pause queue when pinned tab is closed or navigates away from the project URL. */
  async function handlePinnedTabRemoved(tabId) {
    const session = await loadSession();
    if (!session || session.tabId !== tabId) return; // not our pinned tab
    if (!running) return; // nothing to pause
    pauseQueue("pinned tab closed");
  }

  async function handlePinnedTabUrlChange(tabId, changeInfo) {
    if (typeof changeInfo.url !== "string") return; // only react to URL changes
    const session = await loadSession();
    if (!session || session.tabId !== tabId) return; // not our pinned tab
    if (changeInfo.url.startsWith(session.projectUrl)) return; // still on project
    if (!running) return;
    pauseQueue("pinned tab navigated away");
  }

  function bindTabSubscribers() {
    try {
      if (!chrome.tabs || !chrome.tabs.onRemoved) return; // API unavailable in this context
      const runtime = getGlobalRuntime(); // holds prior listeners for cleanup
      if (runtime.tabRemovedListener) chrome.tabs.onRemoved.removeListener(runtime.tabRemovedListener);
      if (runtime.tabUpdatedListener) chrome.tabs.onUpdated.removeListener(runtime.tabUpdatedListener);
      const onRemoved = (tabId) => {
        handlePinnedTabRemoved(tabId).catch((e) => logErr(e, "tabs.onRemoved"));
      };
      const onUpdated = (tabId, changeInfo) => {
        handlePinnedTabUrlChange(tabId, changeInfo).catch((e) => logErr(e, "tabs.onUpdated"));
      };
      runtime.tabRemovedListener = onRemoved;
      runtime.tabUpdatedListener = onUpdated;
      chrome.tabs.onRemoved.addListener(onRemoved);
      chrome.tabs.onUpdated.addListener(onUpdated);
    } catch (e) {
      logErr(e, "bindTabSubscribers");
    }
  }

  /** True when the composer Send button is enabled and no spinner is shown. */
  function isComposerIdle() {
    const send = document.getElementById("chat-send");

    if (!send) {
      return true; // no composer → not blocking
    }

    if (send.disabled) {
      return false; // disabled = in flight
    }

    const spinner = send.querySelector(".chat-send-spinner");

    if (spinner && !spinner.hidden) {
      return false; // spinner visible = in flight
    }

    return true;
  }

  /** Submit a prompt by filling the composer and clicking Send. */
  function submitPromptInPopup(prompt) {
    const input = document.getElementById("chat-input");
    const send = document.getElementById("chat-send");

    if (!input || !send) {
      return { ok: false, reason: "composer" }; // composer missing
    }

    const proto =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype // textarea proto
        : HTMLInputElement.prototype; // input proto

    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set; // native setter (bypasses React)

    if (setter) {
      setter.call(input, prompt); // preferred path
    } else {
      input.value = prompt; // fallback
    }

    input.dispatchEvent(new Event("input", { bubbles: true })); // React onChange
    input.dispatchEvent(new Event("change", { bubbles: true })); // some libs listen on change
    input.focus(); // mimic user behavior

    setTimeout(() => {
      try {
        send.click(); // submit on next tick so React state catches up
      } catch (e) {
        logErr(e, "submitPromptInPopup.click");
      }
    }, 50);

    return { ok: true };
  }

  /** Wait until the composer is idle (with grace) or deadline expires. */
  function waitForPopupIdle(deadline) {
    return new Promise((resolve) => {
      const start = Date.now(); // poll-loop start

      let sawBusy = false; // ever observed busy?

      const tick = () => {
        const idle = isComposerIdle(); // current state

        if (!idle) {
          sawBusy = true; // remember
        }

        if (!sawBusy && Date.now() - start > POPUP_BUSY_GRACE_MS) {
          return resolve(true); // never busy + grace expired → done
        }

        if (sawBusy && idle) {
          return resolve(true); // busy→idle transition → done
        }

        if (Date.now() >= deadline) {
          return resolve(true); // out of time → done
        }

        setTimeout(tick, Math.min(POLL_MS, Math.max(0, deadline - Date.now()))); // next poll without overshooting
      };

      setTimeout(tick, 100); // initial small delay before first probe
    });
  }

  /** Listen for messages from the background worker / other popup instances. */
  function bindWorkerBridge() {
    try {
      const runtime = getGlobalRuntime(); // holds the previous injected copy's bridge

      if (runtime.messageListener) {
        chrome.runtime.onMessage.removeListener(runtime.messageListener); // prevent duplicate message handlers after re-injection
      }

      const listener = (msg, _sender, sendResponse) => {
        if (!msg || typeof msg !== "object") {
          return false; // ignore malformed messages
        }

        if (msg.type === "vbx_popup_submit") {
          const res = submitPromptInPopup(String(msg.prompt || "")); // forward to local submit

          sendResponse(res.ok ? { ok: true, idle: false } : res); // echo result back
          return false; // synchronous reply
        }

        if (msg.type === "vbx_popup_ping") {
          sendResponse({ ok: true }); // health check
          return true; // keep channel open
        }

        return false; // unhandled
      };

      runtime.messageListener = listener; // make removable by the next injected copy
      chrome.runtime.onMessage.addListener(listener);
    } catch (e) {
      logErr(e, "bindWorkerBridge");
    }
  }

  // ==========================================================================
  // Button injection — V5 layout + V6 wait selector + V7 Ctrl+Enter shortcut
  // ==========================================================================

  /** Inject the Next/×N/wait/Run/Clear row into the popup composer area. */
  /** Step 6 helper: build the outer flex wrap (DOM only, no listeners). */
  function buildWrap() {
    const wrap = document.createElement("div"); // outer flex row

    wrap.id = WRAP_ID;
    wrap.style.cssText = [
      "display:flex", // horizontal layout
      "align-items:center", // vertically center children
      "gap:6px", // 6px gutter between children
      "flex-wrap:wrap", // wrap to new row when tight
      "width:100%", // span composer width
      "margin-top:8px", // 8px gap above
    ].join(";");

    return wrap;
  }

  function buildBaseButtonCss() {
    return [
      "height:30px", // uniform button height
      "padding:0 10px", // horizontal padding
      "border:0", // borderless (variants add border)
      "border-radius:8px", // rounded corners
      "cursor:pointer", // affordance
      "color:#fff", // white text
      "font:800 11px Inter,system-ui,sans-serif", // compact bold UI font
      "letter-spacing:0", // no extra tracking
      "white-space:nowrap", // never wrap label
      "min-width:0", // allow flex shrink
    ].join(";");
  }

  /** Step 7 helper: build the Next button (DOM only, no listeners). */
  function buildNextButton(baseBtnCss) {
    const nextBtn = document.createElement("button"); // enqueue button

    nextBtn.id = BTN_NEXT_ID;
    nextBtn.type = "button";
    nextBtn.textContent = "Next →";
    nextBtn.title = "Queue this prompt (Ctrl+Enter) — runs after the previous one finishes";
    nextBtn.style.cssText =
      baseBtnCss +
      ";background:linear-gradient(135deg,var(--orange,#ff8a3d),var(--purple,#a259ff))" + // gradient background
      ";box-shadow:0 6px 18px rgba(162,89,255,.22)"; // soft purple glow

    return nextBtn;
  }

  /** Step 8 helper: build the ×N selector pair (DOM only, no listeners). */
  function buildCountSelector() {
    const countSel = document.createElement("select"); // ×N dropdown

    countSel.id = COUNT_SEL_ID;
    countSel.title = "How many copies to enqueue when you click Next";
    countSel.style.cssText = [
      "height:30px", // align with buttons
      "padding:0 6px", // tight horizontal padding
      "border-radius:8px", // rounded corners
      "background:rgba(162,89,255,.10)", // faint purple wash
      "border:1px solid rgba(162,89,255,.35)", // purple border
      "color:#fff", // white text
      "font:800 11px Inter,system-ui,sans-serif", // compact bold UI font
      "cursor:pointer", // affordance
      "flex:0 0 auto", // do not stretch
    ].join(";");

    for (const v of [...COUNT_PRESETS.map(String), "custom"]) {
      const o = document.createElement("option"); // one option per preset + custom

      o.value = v;
      o.textContent = v === "custom" ? "Custom" : `×${v}`; // human label
      o.style.color = "#000"; // ensure readable in native dropdown
      countSel.appendChild(o);
    }

    const countCustom = document.createElement("input"); // custom ×N field

    countCustom.id = COUNT_CUSTOM_ID;
    countCustom.type = "number";
    countCustom.min = String(COUNT_MIN);
    countCustom.max = String(COUNT_MAX);
    countCustom.step = "1";
    countCustom.placeholder = "N";
    countCustom.style.cssText = [
      "display:none", // hidden until "Custom" is picked
      "width:54px", // narrow numeric field
      "height:30px", // align with buttons
      "padding:0 6px", // tight horizontal padding
      "border-radius:8px", // rounded corners
      "background:rgba(162,89,255,.06)", // very faint purple wash
      "border:1px solid rgba(162,89,255,.35)", // purple border
      "color:#fff", // white text
      "font:800 11px Inter,system-ui,sans-serif", // compact bold UI font
      "text-align:center", // centered number
      "flex:0 0 auto", // do not stretch
    ].join(";");

    return { select: countSel, customInput: countCustom };
  }

  /** Step 9 helper: build the wait-time selector pair (DOM only, no listeners). */
  function buildWaitSelector() {
    const waitSel = document.createElement("select"); // wait dropdown

    waitSel.id = WAIT_SEL_ID;
    waitSel.title = "Max seconds to wait for Lovable per queued task";
    waitSel.style.cssText = [
      "height:30px", // align with buttons
      "padding:0 6px", // tight padding
      "border-radius:8px", // rounded
      "background:rgba(255,138,61,.12)", // faint orange wash
      "border:1px solid rgba(255,138,61,.45)", // orange border
      "color:#fff", // white text
      "font:800 11px Inter,system-ui,sans-serif", // compact bold UI font
      "cursor:pointer", // affordance
      "flex:0 0 auto", // do not stretch
    ].join(";");

    for (const sec of WAIT_PRESETS_SEC) {
      const o = document.createElement("option"); // one option per preset

      o.value = String(sec);
      o.textContent = `${sec}s`; // e.g. "8s"
      o.style.color = "#000"; // readable in native dropdown
      waitSel.appendChild(o);
    }

    {
      const o = document.createElement("option"); // trailing "Custom" option

      o.value = "custom";
      o.textContent = "Custom";
      o.style.color = "#000";
      waitSel.appendChild(o);
    }

    const waitCustom = document.createElement("input"); // custom wait field

    waitCustom.id = WAIT_CUSTOM_ID;
    waitCustom.type = "number";
    waitCustom.min = String(WAIT_MIN_SEC);
    waitCustom.max = String(WAIT_MAX_SEC);
    waitCustom.step = "1";
    waitCustom.placeholder = "s";
    waitCustom.style.cssText = [
      "display:none", // hidden until "Custom" is picked
      "width:60px", // narrow numeric field
      "height:30px", // align with buttons
      "padding:0 6px", // tight padding
      "border-radius:8px", // rounded
      "background:rgba(255,138,61,.06)", // very faint orange wash
      "border:1px solid rgba(255,138,61,.45)", // orange border
      "color:#fff", // white text
      "font:800 11px Inter,system-ui,sans-serif", // compact bold UI font
      "text-align:center", // centered number
      "flex:0 0 auto", // do not stretch
    ].join(";");

    return { select: waitSel, customInput: waitCustom };
  }

  /** Step 10a helper: build the Run / Stop toggle button (DOM only, no listeners). */
  function buildRunButton(baseBtnCss) {
    const runBtn = document.createElement("button"); // run/stop toggle

    runBtn.id = BTN_RUN_ID;
    runBtn.type = "button";
    runBtn.textContent = "Run queue ▶";
    runBtn.title = "Submit queued prompts one by one";
    runBtn.style.cssText =
      baseBtnCss +
      ";background:rgba(162,89,255,.18)" + // faint purple fill
      ";border:1px solid rgba(162,89,255,.45)"; // purple border

    return runBtn;
  }

  /** Step 10b helper: build the Clear button (DOM only, no listeners). */
  function buildClearButton(baseBtnCss) {
    const clearBtn = document.createElement("button"); // clear queue button

    clearBtn.id = BTN_CLEAR_ID;
    clearBtn.type = "button";
    clearBtn.textContent = "Clear ✕";
    clearBtn.title = "Remove all queued prompts";
    clearBtn.style.cssText =
      baseBtnCss +
      ";background:rgba(255,255,255,.08)" + // faint white wash (was red)
      ";border:1px solid rgba(255,255,255,.35)" + // subtle white border (was red)
      ";flex:0 0 auto"; // do not stretch

    return clearBtn;
  }

  function insertPromptIntoComposer(body, prompt) {
    const input = document.getElementById("chat-input");

    if (!input) {
      toast("Composer not ready");
      return false;
    }

    const current = String(input.value || "");
    const addition = body || "";
    const next = current.trim() ? current.replace(/\s+$/, "") + "\n\n" + addition : addition;
    setNativeValue(input, next);
    input.focus();
    return true;
  }

  function mountPromptButton(container, anchorBeforeEl, buttonCss) {
    const api = window.__vbxPromptButton;

    if (!api || typeof api.mount !== "function") {
      return null;
    }

    return api.mount({
      container,
      anchorBeforeEl,
      prompts: PROMPTS,
      insertIntoComposer: insertPromptIntoComposer,
      toast,
      buttonCss,
      ids: {
        button: PROMPTS_BTN_ID,
        popover: PROMPTS_POPOVER_ID,
      },
      getRuntime: getGlobalRuntime,
    });
  }

  /** Step 11 helper: attach inject-time event handlers only; DOM building stays outside. */
  function wireInjectHandlers(parts) {
    const input = parts.input; // composer input used by Next + shortcut
    const nextBtn = parts.nextBtn; // Next button
    const runBtn = parts.runBtn; // Run/Stop button
    const clearBtn = parts.clearBtn; // Clear button
    const countSel = parts.countSel; // ×N dropdown
    const countCustom = parts.countCustom; // custom ×N input
    const waitSel = parts.waitSel; // wait dropdown
    const waitCustom = parts.waitCustom; // custom wait input
    const runtime = getGlobalRuntime(); // shared holder for stale shortcut cleanup across reinjection

    const triggerNext = () => {
      const current = String(input.value || "").trim(); // current composer text

      if (!current) {
        toast("Type a prompt first");
        input.focus();
        return;
      }

      const n = clampCount(readCountFromUI()); // how many copies

      for (let i = 0; i < n; i++) {
        queue.push(current); // enqueue n copies
      }

      saveQueue(); // persist
      setNativeValue(input, ""); // clear composer the React-friendly way
      renderList(); // refresh list

      if (n > 1) {
        toast(`Queued ${n} — press Run queue ▶`); // batch message
      } else {
        toast(`Queued (${queue.length})`); // single enqueue message
      }
    };

    nextBtn.addEventListener("click", triggerNext); // button click

    const onShortcut = (ev) => {
      if (ev.key !== "Enter" || !(ev.ctrlKey || ev.metaKey)) {
        return; // not our shortcut
      }

      if (nextBtn.disabled) {
        return; // mid-run; do nothing
      }

      ev.preventDefault(); // suppress newline / form submit
      ev.stopPropagation(); // don't let the page also handle it
      triggerNext(); // same path as clicking Next
    };

    if (runtime.shortcutDocumentListener) {
      document.removeEventListener("keydown", runtime.shortcutDocumentListener, true); // remove stale Ctrl/Cmd+Enter handler from prior DOM
    }

    if (runtime.shortcutInput && runtime.shortcutInputListener) {
      runtime.shortcutInput.removeEventListener("keydown", runtime.shortcutInputListener, true); // remove stale handler from detached composer
    }

    input.addEventListener("keydown", onShortcut, true); // capture on composer
    document.addEventListener("keydown", onShortcut, true); // capture anywhere in popup
    runtime.shortcutInput = input; // make removable by the next injected copy
    runtime.shortcutInputListener = onShortcut; // paired with shortcutInput
    runtime.shortcutDocumentListener = onShortcut; // paired with document capture listener

    const onCountChange = () => {
      selectedCount = readCountFromUI(); // re-read from UI
      saveCount(); // persist
      syncCustomVisibility(); // show/hide custom field
      updateNextBadge(); // refresh Next label
    };

    countSel.addEventListener("change", onCountChange); // preset change
    countCustom.addEventListener("input", onCountChange); // typing
    countCustom.addEventListener("change", onCountChange); // commit
    countCustom.addEventListener("blur", () => {
      if (countCustom.value === "") {
        return; // empty → leave alone
      }

      const clamped = clampCount(countCustom.value); // enforce bounds on blur

      if (String(clamped) !== countCustom.value) {
        countCustom.value = String(clamped); // overwrite with clamped value
        onCountChange(); // re-run side effects
      }
    });

    const onWaitChange = () => {
      currentTaskWaitMs = readWaitMsFromUI(); // re-read from UI
      saveTaskWaitMs(); // persist
      syncWaitCustomVisibility(); // show/hide custom field
      updateRunButton(); // refresh idle Run label with the newly armed budget
    };

    waitSel.addEventListener("change", onWaitChange); // preset change
    waitCustom.addEventListener("input", onWaitChange); // typing
    waitCustom.addEventListener("change", onWaitChange); // commit
    waitCustom.addEventListener("blur", () => {
      if (waitCustom.value === "") {
        return; // empty → leave alone
      }

      const clamped = clampWaitSec(waitCustom.value); // enforce bounds on blur

      if (String(clamped) !== waitCustom.value) {
        waitCustom.value = String(clamped); // overwrite with clamped value
        onWaitChange(); // re-run side effects
      }
    });

    runBtn.addEventListener("click", () => {
      if (running) {
        stopRun(); // toggle stop when running
      } else {
        runQueue(); // start otherwise
      }
    });

    clearBtn.addEventListener("click", () => {
      if (running) {
        return; // cannot clear mid-run
      }

      if (queue.length === 0) {
        return; // nothing to clear
      }

      queue = []; // wipe in-memory
      paused = false; // clearing queue also clears resumable state
      saveQueue(); // persist
      clearPauseReason().catch((e) => logErr(e, "clearQueue.clearPauseReason")); // remove stale Resume flag
      clearSession().catch((e) => logErr(e, "clearQueue.clearSession")); // remove stale pinned tab
      renderList(); // refresh list
      toast("Queue cleared");
    });
  }

  function inject() {
    const existingWrap = document.getElementById(WRAP_ID);

    if (existingWrap) {
      const existingRunBtn = document.getElementById(BTN_RUN_ID);

      if (existingRunBtn && existingRunBtn.parentElement === existingWrap && !document.getElementById(PROMPTS_BTN_ID)) {
        mountPromptButton(existingWrap, existingRunBtn, buildBaseButtonCss()); // upgrade an already-mounted v10/v11 row in place
      }

      return true; // already injected
    }

    const send = document.getElementById("chat-send");
    const input = document.getElementById("chat-input");

    if (!send || !input || !send.parentElement) {
      return false; // composer not ready yet
    }

    const wrap = buildWrap(); // step 6: factored-out wrap builder

    const baseBtnCss = buildBaseButtonCss(); // shared by fresh inject and in-place v10→v11 upgrade

    const nextBtn = buildNextButton(baseBtnCss); // step 7: factored-out Next button builder

    const countSelector = buildCountSelector(); // step 8: factored-out ×N selector builder
    const countSel = countSelector.select; // keep existing local name for listener code
    const countCustom = countSelector.customInput; // keep existing local name for custom field code

    // --- V6: wait-time selector (per-task budget in seconds) ---
    const waitSelector = buildWaitSelector(); // step 9: factored-out wait selector builder
    const waitSel = waitSelector.select; // dropdown reference
    const waitCustom = waitSelector.customInput; // custom input reference

    // --- Run / Stop ---
    const runBtn = buildRunButton(baseBtnCss); // step 10a: factored-out Run button builder

    // --- Clear ---
    const clearBtn = buildClearButton(baseBtnCss); // step 10b: factored-out Clear button builder

    wireInjectHandlers({ input, nextBtn, runBtn, clearBtn, countSel, countCustom, waitSel, waitCustom }); // step 11: listeners only

    nextBtn.style.flex = "1 1 96px"; // Next stretches with a 96px basis
    runBtn.style.flex = "1 1 112px"; // Run stretches with a 112px basis

    // Layout order: Next | ×N | (custom) | wait | (custom) | Prompts | Run | Clear
    wrap.appendChild(nextBtn);
    wrap.appendChild(countSel);
    wrap.appendChild(countCustom);
    wrap.appendChild(waitSel);
    wrap.appendChild(waitCustom);
    mountPromptButton(wrap, runBtn, baseBtnCss); // V11: delegated prompt picker, mounted before Run
    wrap.appendChild(runBtn);
    wrap.appendChild(clearBtn);

    const shell = input.closest(".chat-input-shell") || send.closest(".chat-input-shell"); // preferred mount parent
    const bar = send.closest(".chat-compose-bar"); // sibling anchor

    if (shell && bar && bar.parentElement === shell) {
      shell.insertBefore(wrap, bar); // preferred: just above the compose bar
    } else {
      send.parentElement.insertBefore(wrap, send); // fallback: directly before Send
    }

    // --- Hydrate ---
    running = false; // we always start fresh on inject
    stopFlag = false;

    loadQueue().then((q) => {
      queue = q; // mirror persisted queue
      renderList(); // paint list
      updateRunButton(); // refresh button states
    });

    loadCount().then((n) => {
      selectedCount = n; // mirror persisted ×N
      applyLoadedCountToUI(n); // reflect in UI
    });

    loadTaskWaitMs().then((ms) => {
      currentTaskWaitMs = ms; // mirror persisted budget
      applyLoadedWaitToUI(ms); // reflect in UI
    });

    try {
      chrome.storage.local.get([RUN_KEY, PROGRESS_KEY, PAUSED_KEY], (res) => {
        const p = res && res[PROGRESS_KEY]; // last-known progress payload
        const freshProgress = isFreshProgress(p); // still within budget?

        running = Boolean(res && res[RUN_KEY] && freshProgress); // resume only when fresh
        hydratePaused(res && res[PAUSED_KEY]); // restore Resume after popup reload

        if (res && res[RUN_KEY] && !freshProgress) {
          chrome.storage.local.set({ [RUN_KEY]: false }); // wipe stale running flag
          chrome.storage.local.remove(PROGRESS_KEY); // wipe stale progress
        }

        updateRunButton(); // reflect resumed/idle state

        if (p && typeof p.current === "number" && typeof p.total === "number") {
          if (p.total > 0 && p.current > 0 && freshProgress) {
            progressCurrentStartedAt = typeof p.startedAt === "number" ? p.startedAt : Date.now(); // restore start stamp
            progressReason = typeof p.reason === "string" ? p.reason : "resuming saved run"; // restore phase
            progressWaitBudgetMs = typeof p.waitBudgetMs === "number" ? p.waitBudgetMs : currentTaskWaitMs; // restore budget
            progressCurrentItem = typeof p.currentItem === "string" ? p.currentItem : ""; // restore current
            progressRemainingItems = Array.isArray(p.remainingItems)
              ? p.remainingItems.filter((x) => typeof x === "string") // restore tail
              : [];

            setProgress(p.current, p.total); // paint resumed banner
          }
        }
      });
    } catch (e) {
      logErr(e, "inject.hydrate");
    }

    bindStorageSubscribers(); // start mirroring storage changes
    bindTabSubscribers(); // step 20: pause if pinned tab is closed or navigates away
    bindWorkerBridge(); // start handling background messages

    return true;
  }

  /** Retry inject() until the composer mounts (up to ~8s). */
  function boot() {
    let tries = 0; // attempt counter

    const tick = () => {
      if (inject()) {
        return; // injected successfully
      }

      if (++tries < 80) {
        setTimeout(tick, 100); // poll every 100ms
      }
    };

    tick();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true }); // wait for DOM
  } else {
    boot(); // DOM already ready
  }
})();

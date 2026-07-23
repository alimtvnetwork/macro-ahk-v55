---
name: Auto-attach policy (autoStart + URL + ALL script conditions + body marker)
description: Auto-attach a library script to a project ONLY when ALL of these are true — project.autoStart === true AND project URL matches the script's UrlMatches AND every other condition declared by the script (InjectionConditions, runAt, world, cookies, element, online, delay, custom predicates) is satisfied; track injected-state via a body data attribute
type: feature
---

# Auto-attach Policy — Full Spec

> **Hard rule**: Auto-attach is **AND-gated** on every condition below. Failing **any single** one MUST skip attach/inject and log the reason (no silent skips). URL match alone is NEVER sufficient.

## 1. Conditions that ALL must be true to auto-attach

A library script `S` is auto-attached to project `P` only if **every** condition holds:

| # | Condition | Source of truth | If false |
|---|-----------|-----------------|----------|
| C1 | `P.autoStart === true` | `StoredProject.settings.autoStart` (or top-level `autoStart` flag) | Skip silently for this project (log INFO: `AUTOATTACH_SKIPPED_AUTOSTART_OFF`) |
| C2 | `P.url` matches at least one entry in `S.instruction.UrlMatches` | Compiled `instruction.json` of the script | Skip (log INFO: `AUTOATTACH_SKIPPED_URL_NO_MATCH`) |
| C3 | Every `S.instruction.InjectionConditions` predicate evaluates true at attach-time evaluation (cookie present, required element selector resolvable on a representative page, `requireOnline` honored, `minDelayMs` respected at inject-time) | `condition-evaluator.ts` `evaluateConditions()` | Skip (log INFO: `AUTOATTACH_SKIPPED_CONDITION_FAIL` with `failedCondition`) |
| C4 | `S.instruction.AutoAttach !== false` (script may opt out) | `instruction.json` | Skip (log INFO: `AUTOATTACH_SKIPPED_OPT_OUT`) |
| C5 | Script declares a compatible `runAt` and `world` for the project's injection mode | `instruction.json` | Skip (log INFO: `AUTOATTACH_SKIPPED_INCOMPATIBLE_RUN_CONTEXT`) |
| C6 | Required cookies (`S.instruction.RequiredCookies`) are bindable to `P.cookies` | project + instruction | Skip (log WARN: `AUTOATTACH_SKIPPED_COOKIE_BINDING_MISSING`) |
| C7 | All `S.instruction.Dependencies` are present in the library (or in `P.dependencies`) | library + project | Skip (log WARN: `AUTOATTACH_SKIPPED_DEP_MISSING`) |
| C8 | `S` is not already in `P.scripts` (idempotent) | `P.scripts[].path` | Skip silently |

> **Order**: evaluate cheapest → most expensive (C1 → C4 → C2 → C8 → C5 → C6 → C7 → C3). Short-circuit on first failure.

> **No URL-only shortcut.** Do NOT add a script just because URL matches. Any reviewer or future agent must reject a PR that drops C3–C7.

## 2. Runtime injection — body marker (per-page dedup)

Independent of auto-attach. At inject time the content-script runner MUST:

1. Read `document.body.getAttribute('data-marco-injected')`, split on `,`, check for `scriptId`.
2. If present → skip injection, log INFO `INJECT_SKIPPED_ALREADY_MARKED`.
3. If absent → inject, then append `scriptId` to the CSV and re-set the attribute.

Why body data-attribute (not `window.*`, not sentinel div):
- Survives SPA re-renders (React commits don't strip unknown `data-*` on `<body>`).
- Sentinel `<div id="__marco_sentinel__">` answers "does the extension apply on this page?" — a different question.
- `window.__marco_injected` is wiped by SPA route remounts.

## 3. No silent failures (cross-ref)

If `C1 && C2` are true but the bound script is **missing from the library**, log FATAL via `persistInjectionError` tagged `SCRIPT_MISSING_FATAL`. See `mem://standards/no-silent-failures.md`.

Every skip above MUST emit a structured log entry — NEVER a bare early-return.

## 4. Implementation checkpoints

1. `StoredProject` / `ProjectSettings` — confirm `autoStart?: boolean` field exists (add if missing, default `false`).
2. New module `src/background/auto-attach.ts` exporting `evaluateAutoAttach(project, script): { ok: boolean; reason: string }` implementing C1–C8 in the stated order.
3. Project save flow hook — when a project is saved, iterate `library.scripts`, call `evaluateAutoAttach`, append `ok` matches to `project.scripts`, log every non-ok with its reason code.
4. Injection runner — read/write body marker; log INFO on skip.
5. Diagnostics tab — surface the per-script `AUTOATTACH_SKIPPED_*` reasons so users can see why a script wasn't attached.
6. Tests — one unit test per skip reason (C1..C8) ensuring no silent return.

## 5. Anti-patterns (do NOT do)

- ❌ Attach on URL match alone.
- ❌ Swallow a condition failure with `return` / `catch {}`.
- ❌ Use `window.__marco_injected` for dedup.
- ❌ Default `autoStart` to `true`.
- ❌ Skip C3 evaluation "because it's expensive" — make it lazy/cached, never skipped.

## Related

- `mem://standards/no-silent-failures.md`
- `mem://features/new-tab-no-url-guard`
- `src/background/condition-evaluator.ts` (C3 evaluator — reuse, do not duplicate)
- `src/content-scripts/sentinel-reader.ts` (separate concern: project applicability)

---

## C9 — User dismissed for origin (added 2026-05-24)

A **ninth** gate sits in front of C1..C8 at the auto-injector entrypoint. When the user clicks "Not now" or "Don't ask for this site" in the first-attach toast, the (tab, origin) — or origin alone, if persisted — is recorded and ALL subsequent navigations short-circuit before evaluateUrlMatches runs.

- Module: `src/background/dismissed-origins.ts`
- Storage key (persistent): `marco_dismissed_origins` in `chrome.storage.local` (array of origin strings)
- Tab-scoped layer: ephemeral `Map<tabId, Set<origin>>`, cleared on `chrome.tabs.onRemoved`
- Hot-path API: `isOriginDismissedForTab(tabId, url): boolean` (sync, no I/O)
- Mutators: `dismissOriginForTab` (tab only), `persistDismissOrigin` / `unpersistDismissOrigin` (cross-tab)
- Boot hook: call `preloadDismissedOrigins()` once at SW startup to hydrate the persistent layer
- Log code on skip: `AUTOATTACH_SKIPPED_USER_DISMISSED` (mirrors C1..C8 shape — no silent return)
- Tests: `src/background/__tests__/dismissed-origins.test.ts`

Wired into `src/background/auto-injector.ts` at the top of both `handleNavigationCompleted` (T1) and `handleTabActivated` (T3), ahead of the existing dedup cache.

---

## C10 — First-attach intent / seen-origins gate (added 2026-05-24)

Before the first-attach toast has ever surfaced for an origin, C1..C9 may all be true and auto-attach proceeds silently. After the toast is shown once, `seen-origins` records the origin so the toast never re-appears. This gate ensures the toast fires at most once per origin per profile.

- Module: `src/background/seen-origins.ts`
- Storage key (persistent): `marco_seen_origins` in `chrome.storage.local` (array of origin strings)
- Hot-path API: `isOriginSeen(url): boolean` (sync, no I/O; returns `true` for unparseable URLs as a safety fallback)
- Mutators: `markOriginSeen(url)` (idempotent, async fire-and-forget)
- Boot hook: call `preloadSeenOrigins()` once at SW startup to hydrate the in-memory Set
- Tests: `src/background/__tests__/seen-origins.test.ts`

The toast itself is injected via `maybeShowFirstAttachToast(tabId, url)` in `src/background/first-attach-toast.ts`, called from the auto-injector immediately after successful script injection. It checks `isOriginDismissedForTab` (C9) and `isOriginSeen` (C10) before injecting; on success it optimistically marks the origin seen to prevent burst re-fire.

---

## First-attach toast contract (added 2026-05-24)

When auto-attach injects for the *first time* on an origin, an in-page toast asks the user whether to keep attaching. The toast is a self-contained DOM element injected via `chrome.scripting.executeScript`.

### Architecture

| Layer | World | Role |
|-------|-------|------|
| `toastPagePayload` | `MAIN` | Renders the toast DOM, handles clicks, posts `window.postMessage` |
| `bridgePagePayload` | `ISOLATED` | Listens to `window.postMessage`, forwards via `chrome.runtime.sendMessage` |
| `registerFirstAttachToastBridge` | Background | Receives runtime messages, updates `seen-origins` / `dismissed-origins` state |

### User actions

| Button | Action value | Background effect |
|--------|-------------|-------------------|
| Yes, keep attaching | `accept` | `markOriginSeen(url)` |
| Not now | `dismiss-tab` | `dismissOriginForTab(tabId, url)` + `markOriginSeen(url)` |
| Don't ask for this site | `dismiss-persist` | `persistDismissOrigin(url)` + `markOriginSeen(url)` |

All three actions remove the toast immediately. The toast auto-removes after 30s if untouched.

### Styling

Dark theme matching the extension: `#1a1a2e` background, `#e8edf3` text, `#4f46e5` primary button, `z-index: 2147483647`. Zero external dependencies; all styles inline.

### Error handling

- Restricted URLs (chrome://, chrome-extension://, etc.) are skipped; `executeScript` throws and we log once, no retry.
- No retry/backoff on any I/O (per mem://constraints/no-retry-policy).

### Related

- `src/background/first-attach-toast.ts` — toast + bridge + background handler
- `src/background/seen-origins.ts` — C10 gate
- `src/background/dismissed-origins.ts` — C9 gate
- `src/background/auto-injector.ts` — triggers toast after injection
- `src/components/options/DismissedSitesCard.tsx` — UI to manage dismissed origins

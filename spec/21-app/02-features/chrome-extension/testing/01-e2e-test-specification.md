# Chrome Extension — End-to-End Test Specification

> **Version**: 1.0.0
> **Last updated**: 2026-02-28
> **Status**: Active

---

## Overview

This document defines the complete end-to-end (E2E) test suite for the Chrome Extension. Tests run via **Playwright** against a packaged extension build and validate the full user journey: onboarding, project management, script injection, authentication, error recovery, and UI interactions.

---

## Test Architecture

### Runner

- **Framework**: Playwright
- **Extension load**: Chromium with `--load-extension` launch arg
- **Fixtures**: `tests/e2e/fixtures.ts` exports `launchExtension`, `getExtensionId`, `openPopup`, `openOptions`
- **Execution**: Sequential (extension state is global)
- **Reporters**: HTML, JUnit, GitHub annotations

### Test Categories

| Category | Description | Count |
|----------|-------------|-------|
| `onboarding` | First-run experience and setup | 1 |
| `projects` | Project CRUD and URL matching | 2 |
| `injection` | Isolated and MAIN world script execution | 2 |
| `config` | Config cascade and recovery | 2 |
| `auth` | Bearer token and cookie fallback | 1 |
| `popup` | Popup match state and project switching | 1 |
| `recovery` | SW rehydration, WASM fallback, state transitions | 5 |
| `edge` | Multi-tab, network backoff | 2 |
| `deploy` | PowerShell install, watch mode, ZIP export | 3 |
| `ui` | Options page CRUD and XPath recorder | 2 |

---

## Test Matrix

| ID | Priority | Area | Test Name | Stub File |
|----|----------|------|-----------|-----------|
| E2E-01 | P0 | Onboarding | First-Run Onboarding | `tests/e2e/e2e-01-onboarding.spec.ts` |
| E2E-02 | P0 | Projects | Project CRUD Lifecycle | `tests/e2e/e2e-02-project-crud.spec.ts` |
| E2E-03 | P0 | Projects | URL Matching Rules | `tests/e2e/e2e-03-url-matching.spec.ts` |
| E2E-04 | P0 | Injection | Script Injection (Isolated World) | `tests/e2e/e2e-04-injection-isolated.spec.ts` |
| E2E-05 | P0 | Injection | Script Injection (Main World) | `tests/e2e/e2e-05-injection-main.spec.ts` |
| E2E-06 | P1 | Config | Config Cascade (Remote > Local > Bundled) | `tests/e2e/e2e-06-config-cascade.spec.ts` |
| E2E-07 | P0 | Auth | Authentication Flow | `tests/e2e/e2e-07-auth-flow.spec.ts` |
| E2E-08 | P0 | Popup | Popup Project Selection & Match Status | `tests/e2e/e2e-08-popup-match.spec.ts` |
| E2E-09 | P0 | Recovery | Service Worker Termination + Rehydration | `tests/e2e/e2e-09-sw-rehydration.spec.ts` |
| E2E-10 | P1 | Recovery | WASM/SQLite Integrity Fallback | `tests/e2e/e2e-10-wasm-fallback.spec.ts` |
| E2E-11 | P1 | Recovery | 3-Tier Config Recovery | `tests/e2e/e2e-11-config-recovery.spec.ts` |
| E2E-12 | P1 | Recovery | CSP Detection + Fallback Injection | `tests/e2e/e2e-12-csp-fallback.spec.ts` |
| E2E-13 | P2 | Edge | Network Failure & Exponential Backoff | `tests/e2e/e2e-13-backoff.spec.ts` |
| E2E-14 | P0 | Recovery | Error State Transitions (HEALTHY→FATAL) | `tests/e2e/e2e-14-state-transitions.spec.ts` |
| E2E-15 | P1 | Edge | Multi-Tab Tracking + Independent Injection | `tests/e2e/e2e-15-multi-tab.spec.ts` |
| E2E-16 | P1 | Deploy | Extension Install via PowerShell Toolchain | `tests/e2e/e2e-16-ps-install.spec.ts` |
| E2E-17 | P1 | Deploy | Watch Mode (File Change → Reload) | `tests/e2e/e2e-17-watch-mode.spec.ts` |
| E2E-18 | P2 | Deploy | ZIP Export (Diagnostic Bundle) | `tests/e2e/e2e-18-zip-export.spec.ts` |
| E2E-19 | P0 | UI | Options Page CRUD + Library Management | `tests/e2e/e2e-19-options-crud.spec.ts` |
| E2E-20 | P2 | UI | XPath Recorder Toggle + Capture Flow | `tests/e2e/e2e-20-xpath-recorder.spec.ts` |

---

## Detailed Test Specifications

### E2E-01 — First-Run Onboarding

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Category** | onboarding |
| **Preconditions** | Fresh profile; no `onboarding_complete` flag |

**Steps**
1. Launch extension with empty storage.
2. Navigate to Options page.
3. Assert welcome page renders with onboarding UI.
4. Complete onboarding flow (accept defaults).
5. Assert `onboarding_complete` is persisted in storage.

**Expected Result**
- Welcome page visible on first open.
- Default project created automatically.
- Onboarding flag set; subsequent opens skip welcome.

**Pass Criteria**
- `onboarding_complete === true` in extension storage.
- Default project exists with valid ID.

---

### E2E-02 — Project CRUD Lifecycle

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Category** | projects |
| **Preconditions** | Onboarding complete |

**Steps**
1. Open Options page.
2. Create a new project with name and URL rule.
3. Assert project appears in list.
4. Edit project name; assert update persists.
5. Delete project; assert removal from list.
6. Verify storage clean (no orphaned scripts/configs).

**Expected Result**
- CRUD operations reflect immediately in UI.
- Deleted project's associated data is removed.

**Pass Criteria**
- Project list matches storage after each operation.
- No orphaned keys in `chrome.storage.local`.

---

### E2E-03 — URL Matching Rules

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Category** | projects |
| **Preconditions** | At least one project with multiple rules |

**Steps**
1. Create project with exact-match rule.
2. Create project with prefix rule.
3. Create project with regex rule.
4. Navigate tabs to matching and non-matching URLs.
5. Verify popup shows correct active project.
6. Delete a rule; verify deactivation is immediate.

**Expected Result**
- Exact, prefix, and regex rules resolve correctly.
- Rule changes apply without reload.

**Pass Criteria**
- Popup project badge matches expected project for each URL.
- Deleted rule no longer triggers injection.

---

### E2E-04 — Script Injection (Isolated World)

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Category** | injection |
| **Preconditions** | Project with isolated-world script bound to matching URL |

**Steps**
1. Navigate to matching URL.
2. Wait for injection.
3. In page context, assert `window.__pageVar` is undefined.
4. Check extension logs for successful execution entry.

**Expected Result**
- Script executes without page-global access.
- Log entry created in SQLite logs.

**Pass Criteria**
- Isolated execution confirmed (no page var leakage).
- Log entry has `StepKindId` and success status.

---

### E2E-05 — Script Injection (Main World)

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Category** | injection |
| **Preconditions** | Project with MAIN-world script bound to matching URL |

**Steps**
1. Navigate to matching URL.
2. Wait for injection.
3. In page context, assert script can access page globals.
4. Inject script that throws; verify error routes to `errors.db`.

**Expected Result**
- Main world script accesses `window` and DOM freely.
- Runtime errors are captured and stored.

**Pass Criteria**
- Page-global access confirmed.
- Error record present in `errors.db` with full context.

---

### E2E-06 — Config Cascade

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Category** | config |
| **Preconditions** | Bundled config present; optional remote/local overrides |

**Steps**
1. Load extension with only bundled config.
2. Override with local config; assert merge.
3. Override with remote config; assert remote wins.
4. Remove remote; assert fallback to local.
5. Remove local; assert fallback to bundled.

**Expected Result**
- Merge strategy produces deterministic key resolution.
- Each tier falls through in order: Remote > Local > Bundled.

**Pass Criteria**
- Config values match expected tier precedence.
- No stale keys after tier removal.

---

### E2E-07 — Authentication Flow

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Category** | auth |
| **Preconditions** | Extension installed; auth backend reachable |

**Steps**
1. Trigger login via Options or popup.
2. Assert bearer token is acquired and stored.
3. Simulate cookie presence; assert fallback recovery.
4. Clear auth state; assert unauthenticated UI.

**Expected Result**
- Token persisted with TTL awareness.
- Cookie fallback recovers session when token expires.
- Clear action shows login prompt.

**Pass Criteria**
- `getBearerToken()` resolves valid token.
- Cleared state: token null, UI shows "Sign In".

---

### E2E-08 — Popup Project Selection & Match Status

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Category** | popup |
| **Preconditions** | Multiple projects with overlapping rules |

**Steps**
1. Open tab matching Project A.
2. Open popup; assert Project A selected.
3. Switch popup to Project B.
4. Assert re-evaluation triggered.
5. Open new tab with no match; assert "No Project" state.

**Expected Result**
- Popup reflects real-time tab URL state.
- Project switch triggers immediate re-injection evaluation.

**Pass Criteria**
- Selected project matches active tab.
- Switch causes background re-evaluation message.

---

### E2E-09 — Service Worker Termination + Rehydration

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Category** | recovery |
| **Preconditions** | Active session with injected tabs |

**Steps**
1. Inject scripts into multiple tabs.
2. Force service worker termination (e.g., `chrome://serviceworker-internals`).
3. Trigger event that wakes SW (tab navigation).
4. Assert session state rehydrated from SQLite.
5. Assert injection resumes automatically.

**Expected Result**
- Zero data loss after termination.
- Rehydration restores all tracked tabs.
- Injection resumes without manual refresh.

**Pass Criteria**
- Post-rehydration tab count equals pre-termination count.
- Each tab receives injection after SW restart.

---

### E2E-10 — WASM/SQLite Integrity Fallback

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Category** | recovery |
| **Preconditions** | WASM module available; SQLite OPFS active |

**Steps**
1. Verify full mode: SQLite + WASM functional.
2. Corrupt or block WASM load.
3. Assert extension enters degraded mode.
4. Verify core features still work (no crash).
5. Restore WASM; assert full capability recovery.

**Expected Result**
- Degraded mode keeps extension usable.
- Recovery restores full SQLite/WASM capability.

**Pass Criteria**
- No unhandled errors in degraded mode.
- Full mode restored after recovery.

---

### E2E-11 — 3-Tier Config Recovery

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Category** | recovery |
| **Preconditions** | Remote config configured |

**Steps**
1. Block remote fetch.
2. Assert fallback to local config.
3. Remove local config.
4. Assert fallback to bundled config.
5. Restore remote; assert automatic re-adoption.

**Expected Result**
- Fallback tiers activate in strict order.
- Recovery is automatic; no manual restart required.

**Pass Criteria**
- Each tier produces expected config keys.
- Remote restoration updates live config within 10s.

---

### E2E-12 — CSP Detection + Fallback Injection

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Category** | recovery |
| **Preconditions** | Target page has strict CSP headers |

**Steps**
1. Navigate to CSP-restricted page.
2. Attempt normal injection.
3. Assert CSP detection triggers fallback path.
4. Verify fallback injection executes successfully.
5. Verify log records fallback activation.

**Expected Result**
- CSP doesn't crash injection pipeline.
- Fallback activates transparently to user.

**Pass Criteria**
- Script executes despite CSP.
- Log entry tags `CspFallback` path.

---

### E2E-13 — Network Failure & Exponential Backoff

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Category** | edge |
| **Preconditions** | Network-intercept or offline mode |

**Steps**
1. Trigger network-dependent operation.
2. Block network response.
3. Observe retry timing: 1s, 2s, 4s...
4. Assert cap is respected (max interval).
5. Restore network; assert retry resets.

**Expected Result**
- Backoff doubles each attempt.
- Cap prevents infinite growth.
- Recovery resets timer immediately.

**Pass Criteria**
- Inter-attempt delays follow exponential pattern.
- Max delay ≤ configured cap.

---

### E2E-14 — Error State Transitions (HEALTHY→FATAL)

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Category** | recovery |
| **Preconditions** | Extension in HEALTHY state |

**Steps**
1. Verify initial state: HEALTHY.
2. Inject transient error; assert DEGRADED.
3. Inject persistent error; assert ERROR.
4. Inject unrecoverable error; assert FATAL.
5. Verify badge color/icon updates at each step.

**Expected Result**
- State machine transitions follow spec diagram.
- Badge updates in real-time.
- FATAL state shows user-facing error banner.

**Pass Criteria**
- Each transition logged with `Reason` + `ReasonDetail`.
- Badge CSS class matches state.

---

### E2E-15 — Multi-Tab Tracking + Independent Injection

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Category** | edge |
| **Preconditions** | Multiple tabs with different projects |

**Steps**
1. Open Tab A (Project X); verify injection.
2. Open Tab B (Project Y); verify injection.
3. Assert each tab has independent script context.
4. Close Tab A; assert cleanup.
5. Verify Tab B still injects correctly.

**Expected Result**
- Tabs inject independently without cross-contamination.
- Tab close cleans up background state.

**Pass Criteria**
- Tab A closure removes its session from state manager.
- Tab B injection continues unaffected.

---

### E2E-16 — Extension Install via PowerShell Toolchain

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Category** | deploy |
| **Preconditions** | Windows; PowerShell 5.1+; `browser-deploy.ps1` present |

**Steps**
1. Run `browser-deploy.ps1` with active profile check.
2. Verify extension loads into Chrome.
3. Open Options page; run health check.
4. Assert all P0 tests would pass.

**Expected Result**
- Install script completes without errors.
- Extension loads and passes health check.

**Pass Criteria**
- `browser-deploy.ps1` exit code 0.
- Options page opens; no console errors.

---

### E2E-17 — Watch Mode (File Change → Reload)

| Field | Value |
|-------|-------|
| **Priority** | P1 |
| **Category** | deploy |
| **Preconditions** | Dev build; watch mode enabled |

**Steps**
1. Start extension in watch mode.
2. Modify a bound script file.
3. Assert reload triggered within 2s.
4. Verify updated script is injected on next navigation.

**Expected Result**
- File change triggers extension reload.
- Injected scripts update without manual browser refresh.

**Pass Criteria**
- File system event detected.
- New script version executes in tab.

---

### E2E-18 — ZIP Export (Diagnostic Bundle)

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Category** | deploy |
| **Preconditions** | Session with logs and errors |

**Steps**
1. Trigger ZIP export from Options or popup.
2. Assert download starts.
3. Open ZIP; verify contains `logs.db`, `errors.db`, config snapshot.
4. Verify files are non-empty and valid.

**Expected Result**
- Bundle contains all diagnostic artifacts.
- File opens successfully in system explorer.

**Pass Criteria**
- ZIP includes `logs.db`, `errors.db`, `config.json`.
- Each file size > 0.

---

### E2E-19 — Options Page CRUD + Library Management

| Field | Value |
|-------|-------|
| **Priority** | P0 |
| **Category** | ui |
| **Preconditions** | Authenticated; multiple projects |

**Steps**
1. Open Options page.
2. Create, edit, delete project.
3. Create script within project; assign to URL rule.
4. Create config override.
5. Perform bulk operations (delete multiple items).

**Expected Result**
- Full CRUD for projects, scripts, and configs.
- Library management (organize, reorder, bulk delete).

**Pass Criteria**
- All mutations persist to storage.
- Bulk delete removes selected items only.

---

### E2E-20 — XPath Recorder Toggle + Capture Flow

| Field | Value |
|-------|-------|
| **Priority** | P2 |
| **Category** | ui |
| **Preconditions** | Page with interactive DOM elements |

**Steps**
1. Activate XPath recorder (hotkey or button).
2. Hover over elements; assert highlight overlay.
3. Click element; assert XPath captured.
4. Dismiss recorder; assert overlay removed.
5. Verify captured XPath list in popup/Options.

**Expected Result**
- Recorder activates/deactivates cleanly.
- Hover highlights without interfering clicks.
- Capture produces valid, unique XPath.

**Pass Criteria**
- Overlay present during active recording.
- XPath list persists after dismiss.
- No console errors during capture.

---

## Pass/Fail Criteria Summary

| Priority | Must Pass | Notes |
|----------|-----------|-------|
| P0 | 8 tests | Release blocked if any fail |
| P1 | 7 tests | Must pass or have documented waiver |
| P2 | 5 tests | Nice to have; failure creates ticket |

---

## Related Documentation

- [Pre-Release Regression Checklist](02-pre-release-regression-checklist.md) — Manual QA sign-off form
- [Overview](00-overview.md) — Architecture references
- [Unified Testing Index](../../../../02-coding-guidelines/imported/00-testing-index.md) — Cross-product test matrix

---

*E2E Test Specification v1.0.1 — 2026-05-25*

---
issue: 118
title: past_due workspace — progress bar broken, refill label wrong, no "Nd passed" expire countdown
status: spec
version-target: v3.29.0
related: 117-past-due-badge-credit-display-rca.md, 116-credit-totals-modal.md
mem-refs:
  - mem://features/macro-controller/pro-zero-credit-balance
  - mem://features/macro-controller/workspace-badge-display
  - mem://features/macro-controller/workspace-tooltip-members-popup
date: 2026-05-26
reporter-sample: A0053 D3v053 WG — workspace_01kq3ytaj3ezfv86af3e8kfjhq
---

# Issue 118 — `past_due` Workspace: Progress Bar Misrenders, Expire Countdown Should Count **Days Passed Since Past-Due**, Not Days To Refill

## 1. Source payload (verbatim)

```json
{
  "Source": "CREDIT_BALANCE",
  "Workspace": {
    "id": "workspace_01kq3ytaj3ezfv86af3e8kfjhq",
    "name": "A0053 D3v053 WG",
    "plan": "pro_0",
    "subscription_status": "past_due",
    "subscription_status_changed_at": "2026-05-26T08:21:40Z",
    "billing_period_start_date": "2026-05-26T07:20:16Z",
    "billing_period_end_date":   "2026-06-26T07:20:16Z",
    "daily_credits_limit": 5,
    "billing_period_credits_limit": 20
  },
  "CreditBalance": {
    "total_remaining": 176.8,
    "total_granted": 225,
    "daily_remaining": 0,
    "daily_limit": 5,
    "total_billing_period_used": 18.2,
    "expiring_grants": [
      { "grant_type": "rollover", "credits": 156.8, "expires_at": "2026-06-26T08:00:00Z" },
      { "grant_type": "billing",  "credits": 20,    "expires_at": "2026-07-26T08:00:00Z" }
    ],
    "grant_type_balances": [
      { "grant_type": "daily",    "granted": 5,   "remaining": 0 },
      { "grant_type": "billing",  "granted": 20,  "remaining": 20 },
      { "grant_type": "rollover", "granted": 200, "remaining": 156.8 }
    ]
  }
}
```

## 2. Symptoms

1. **Progress bar is wrong.** The row's segmented credit bar does not visually reflect the real ratios:
   - Rollover (156.8 / 200) ≈ 78% remaining of the rollover grant
   - Billing (20 / 20) = 100% remaining of the billing grant
   - Daily (0 / 5) = 0% remaining
   - Total available 176.8 / 225 ≈ 78%
   The bar currently either (a) renders empty segments, or (b) scales segments off `total_granted` of the wrong bucket, or (c) skips the rollover bucket entirely for `past_due` rows. None of those match the data.
2. **Wrong lifecycle label for past_due that still has credits.** Per Issue 117 we already correctly classify `past_due` rows with live grants as `about-to-refill` → "Refill 31d". The user has now reversed the requirement: when `subscription_status === 'past_due'`, the row **must** show an **Expire** badge with a "**Nd passed**" label that counts how many days **since** `subscription_status_changed_at` (not until `billing_period_end_date`). Refill is no longer guaranteed.
3. **"Refill credits soon" filter does not handle past_due correctly.** A new sister filter — **"Expiring credits"** — must surface past_due rows sorted by `daysPassed × totalAvailableCredits` descending so the user can triage the biggest-loss workspaces first.

## 3. Behavioral spec (the contract this issue ships)

### 3.1 Past-due lifecycle classification

| Condition | Display kind | Pill label | Tone | Notes |
|---|---|---|---|---|
| `subscription_status === 'past_due'` (regardless of remaining credits) | `'past-due-expiring'` (new kind) | `Expire` | amber/red ramp (see 3.4) | Replaces the previous `about-to-refill` mapping for past_due. |
| `canceled` / `incomplete_expired` | `'canceled'` | `Cancel` | muted gray | Unchanged. |
| `active` and within refill warning window | `'refill-soon'` | `Refill Nd` | green | Unchanged. |
| `active` otherwise | `'normal'` | (no pill) | — | Unchanged. |

### 3.2 "Nd passed" countdown

`daysPassed = floor((now − subscription_status_changed_at) / 86_400_000)`, clamped to `[0, 999]`.
Label rule:
- `daysPassed === 0` → `Passed 0d` (rendered as `Today`)
- `1 ≤ daysPassed ≤ 999` → `Passed ${daysPassed}d`
- The badge text is **always** `Expire` (≤10 chars per Memory `workspace-badge-display`). The "Passed Nd" is the **status pill** text rendered next to it.

### 3.3 Progress-bar fix

The row's segmented bar must render three stacked segments scaled to a shared denominator `D = total_granted` (here 225):
- segment `rollover` width = `rollover.remaining / D` (156.8/225 ≈ 69.7%)
- segment `billing`  width = `billing.remaining  / D` (20/225 ≈ 8.9%)
- segment `daily`    width = `daily.remaining    / D` (0)
- background (used) width = `1 − Σremaining/D` (≈ 21.4%)

Past-due **never** zeros these segments. The previous `applyCanceledCreditOverride` path is already gated out by Issue 117; this spec adds a regression test to keep it gated.

### 3.4 Tone ramp for `past-due-expiring`

Past-due intensifies over time:
- `0–4d passed` → amber (`hsl(var(--warning))`)
- `5–9d passed` → orange (`hsl(var(--warning-strong))`)
- `≥10d passed` → red (`hsl(var(--destructive))`)

All colors via existing design tokens; no raw hex. Tone variable is computed by `pickPastDueTone(daysPassed)` in `workspace-status.ts`.

### 3.5 New "Expiring credits" filter chip

- Chip id: `marco-ws-filter-expiring`
- Predicate: `display.kind === 'past-due-expiring' && row.available > 0`
- Sort key (desc): `score = daysPassed × row.available`
  - Example: 5d passed × 176.8 credits = 884 → ranks above 1d × 1000 = 1000? **No** — 1000 wins. The user explicitly asked for `daysPassed × credits` so the score is what it is; ties broken by `row.available` desc, then workspace name asc.
- The chip lives next to the existing "Refill soon" chip, mutually exclusive when both selected we take their **union** (consistent with current filter union semantics).

### 3.6 Hover-card additions

The Subscription section gains, for `past_due` rows:
- `Past-due since: DD MMM YY (Nd passed)`
- `Grants still live until: DD MMM YY` (earliest `expiring_grants[*].expires_at`)
- `If unpaid by that date, ${rollover.remaining} credits will be lost.`

## 4. Acceptance criteria

A. With the §1 payload at clock `2026-05-26T09:00:00Z` (≈0d after status change):
   1. Row renders exactly one badge `Expire` + one status pill `Today`.
   2. Progress bar renders three visible segments matching §3.3 ratios within ±0.5%.
   3. Hover card shows `Past-due since: 26 May 26 (0d passed)` and `Grants still live until: 26 Jun 26`.
   4. Available = 176.8, Rollover = 156.8, Billing = 20, Daily = 0.
B. With the same payload but clock advanced to `2026-06-02T09:00:00Z` (7d passed):
   1. Pill reads `Passed 7d`, tone = orange.
   2. Sort score in expiring filter = 7 × 176.8 = 1237.6.
C. `active` rows are unaffected — no `Passed Nd` text ever appears for them.
D. `canceled` rows still render `Cancel` muted gray (Memory `workspace-badge-display` invariant).
E. Unit + integration + E2E test counts: **≥ 16** new tests across `__tests__/` and `tests/e2e/` (see Task #11).

## 5. Out of scope

- Stripe retry orchestration. We only read the state.
- Changing the badge for `unpaid` (treated identically to `past_due` for this spec).
- Touching free-plan or `pro_paid` rendering paths.

## 6. RCA (cross-link)

Full root-cause analysis lives at `.lovable/memory/rca/02-2026-05-26-past-due-progress-and-expire-countdown.md`.

## 7. Tasks (12)

Mirrored exactly into the loop task tracker. The 12th task ships the version bump.

| # | Task | File scope |
|---|---|---|
| 1 | Author this spec + RCA memory + ambiguity log | `spec/22-app-issues/118-*.md`, `.lovable/memory/rca/02-*.md`, `.lovable/question-and-ambiguity/118-*.md` |
| 2 | Add `'past-due-expiring'` display kind + `pickPastDueTone()` + `daysPassed` helper in `workspace-status.ts` | `workspace-status.ts` |
| 3 | Reroute `past_due` in `getEffectiveStatus` from `about-to-refill` to `past-due-expiring` (keep grants live) | `workspace-status.ts` |
| 4 | Fix progress-bar segment scaling in `ws-list-renderer.ts` so denominator is `total_granted` across all three grants | `ws-list-renderer.ts` |
| 5 | Render `Expire` badge + `Passed Nd` / `Today` pill for `past-due-expiring`; suppress duplicate `EXPIRED` tier badge | `ws-list-renderer.ts` |
| 6 | Add tone ramp (amber→orange→red) via `pickPastDueTone()` to status-pill CSS classes | `ws-list-renderer.ts`, `styles/marco.css` |
| 7 | Add `marco-ws-filter-expiring` chip + predicate + `daysPassed × available` sort | `ws-list-renderer.ts`, `ui/filter-chips.ts` |
| 8 | Extend hover card with Past-due-since / Grants-live-until / Lost-if-unpaid lines | `workspace-status-pill-and-hovercard` code path |
| 9 | Audit & correct adjacent mistakes: dead `about-to-expire` branch comments, stale Issue 117 fixtures, misleading `Refill Nd` for past_due in `status-explainer.ts` | `workspace-status.ts`, `status-explainer.ts`, related tests |
| 10 | Write unit tests (≥10): days-passed math, tone ramp, classifier table, progress-bar ratios, override-not-applied for past_due, filter predicate + sort, hover-card lines | `__tests__/past-due-expire-*.test.ts` (new) |
| 11 | Write integration + E2E tests (≥6): full pipeline with §1 fixture at t=0, t=7d, t=15d; filter chip ordering; canceled-still-gray invariant; active-row-unaffected invariant | `__tests__/past-due-pipeline.test.ts`, `tests/e2e/specs/past-due-expire-countdown.spec.ts` |
| 12 | Bump minor 3.28.0 → 3.29.0 (all version files), append `changelog.md` entry referencing this spec + RCA, pin `v3.29.0` in `readme.md` | `manifest.json`, `src/shared/constants.ts`, all `instruction.ts`, `shared-state.ts`, `changelog.md`, `readme.md` |

## 8. Regression invariants (added to `badge-credit-invariants.test.ts`)

- I-1: A row with `subscription_status === 'past_due'` AND `total_remaining > 0` MUST render a non-empty progress bar (Σsegments > 0).
- I-2: A `past_due` row MUST render exactly one badge (`Expire`) AND exactly one pill (`Today` or `Passed Nd`).
- I-3: A `past_due` row MUST NOT render the string `Refill` anywhere.
- I-4: For all `display.kind !== 'normal'`, the red `EXPIRED` tier badge is suppressed.
- I-5: Expiring-filter sort is stable: `(score desc, available desc, name asc)`.

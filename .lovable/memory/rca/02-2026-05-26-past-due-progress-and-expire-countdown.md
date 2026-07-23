# RCA-02 — `past_due` progress bar broken & expire countdown missing

**Date:** 2026-05-26
**Version target:** v3.29.0
**Spec:** `spec/22-app-issues/118-past-due-expire-countdown-and-progress-bar.md`
**Reporter payload:** workspace `workspace_01kq3ytaj3ezfv86af3e8kfjhq` (`A0053 D3v053 WG`)

---

## 1. Symptom (one paragraph)

A `pro_0` workspace whose Stripe `subscription_status` flipped to `past_due`
today still has 176.8 spendable credits (200 rollover − 43.2 used, full 20
billing, 0 daily). The dropdown row shows the badge/pill correctly per the
Issue 117 fix path BUT (a) the segmented credit progress bar is visually
empty or wildly off, and (b) the label still says "Refill 31d" which is
misleading — past-due means refill is uncertain; what the user needs to see
is **how long they have been past-due**, since grants will be lost the day
the subscription is canceled or grants expire.

## 2. Root cause (three threads, one underlying issue)

### 2a. Progress-bar denominator drift
`ws-list-renderer.ts` scales each segment off its own grant's `granted` value
when in `pro_0` mode, producing per-segment percentages that don't share a
denominator. When the renderer stacks them in a fixed-width bar the daily
segment (0 / 5) renders nothing, the rollover segment (156.8 / 200) takes
~78% of the bar, and the billing segment (20 / 20) takes 100% of the
remainder — which **visually overflows** the bar so the layout clamps to
empty in flex containers. The bar must use a single denominator (`total_granted`
= 225) for all three segments + a "used" remainder segment.

### 2b. past_due classifier still routes to `about-to-refill`
Issue 117 step 2 (v3.24.0) corrected the *credit* override but left
`getEffectiveStatus` routing past_due rows with live grants to
`about-to-refill`, producing the `Refill Nd` label. The user has now decided
that past_due **must always** show `Expire` + a "**Nd passed**" countdown
based on `subscription_status_changed_at`, regardless of how much time is
left on the grants. Refill semantics are reserved for `active` rows.

### 2c. No "expiring credits" triage filter
The existing "Refill soon" filter sorts active rows by upcoming refill, but
past-due rows are where the user loses real money. There is currently no
chip that surfaces them, and no sort key based on the at-risk amount.

### Underlying issue
All three threads share the same defect category: we conflated **lifecycle
phase** (active / past-due / canceled) with **credit liquidity** (granted /
remaining / used). The renderer and classifier both branched on credit
shape instead of lifecycle phase. The fix is to make the lifecycle phase the
primary axis and treat credit numbers as orthogonal display data.

## 3. Why existing tests missed it

- `past-due-credit-pipeline.test.ts` asserts the credit *numbers* survive
  but does not assert the *bar segments* render to non-zero widths.
- `ws-tier-badge-cancel-suppression.test.ts` covers the badge but not the
  pill text.
- No test feeds a `past_due` payload through the full pipeline at multiple
  `now` clocks.
- No invariant says "past_due rows MUST NOT render the substring `Refill`".

## 4. Fix surface

- Classifier: new display kind `'past-due-expiring'` + `pickPastDueTone()`.
- Renderer: shared-denominator progress bar + `Expire` / `Passed Nd` pair.
- Filter: `marco-ws-filter-expiring` chip with `daysPassed × available` sort.
- Hover card: Past-due-since + Grants-live-until + at-risk amount lines.
- Tests: ≥16 new (see spec §7 task 10–11).
- Invariants: 5 new (see spec §8).

## 5. Cross-mistakes to clean while here

- `workspace-status.ts` comment at line ~158 ("past_due → about-to-expire")
  contradicts the v3.24.0 code change and Issue 117 — rewrite.
- `status-explainer.ts` debug ladder still emits "About To Refill" for
  past_due — rewrite to emit "Past-Due Expiring (Nd passed)".
- Memory `pro-zero-credit-balance` references v3.11.1 only — append a
  v3.29.0 note pointing to this RCA.

## 6. Verification plan

1. Unit tests pass with timezone-deterministic clock (`vi.setSystemTime`).
2. Integration test renders DOM with §1 payload at t=0, t=7d, t=15d and
   snapshots the badge+pill+bar+hover.
3. E2E spec drives the actual extension popup, asserts `Expire` badge and
   `Passed Nd` pill, and asserts the expiring-filter sort order across
   three seeded past-due workspaces.
4. CI invariants block any future regression that re-introduces `Refill`
   for past_due or zero-width bar segments.

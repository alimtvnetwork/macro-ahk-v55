# 118 — past_due expire countdown & progress bar (ambiguity log)

Per No-Questions Mode, decisions logged here rather than asked.

## A1. Pill text when `daysPassed === 0`
- Options: `Passed 0d` · `Today` · `<1d passed`
- **Chosen:** `Today` — short, human, fits ≤10 char badge sibling.
- Pros: scannable, distinct from `Passed 1d`. Cons: requires special case in formatter (one branch).

## A2. Tone ramp thresholds
- Options: 3d/7d · 5d/10d · 7d/14d
- **Chosen:** 5d / 10d — matches Stripe's typical dunning cadence (retry at ~3d, ~5d, ~7d; final at ~10–14d). Pros: aligns with real billing behavior. Cons: hard-coded; could be a setting later.

## A3. Filter sort key
- Options: `daysPassed × available` (user-requested) · `daysPassed × rollover` · `daysPassed²  × available`
- **Chosen:** `daysPassed × available` exactly as user spec. Tie-break: `available desc, name asc`. Pros: matches user words verbatim. Cons: rows with `daysPassed=0` always score 0 — they appear last; acceptable since they're not the urgent triage targets.

## A4. Filter chip name
- Options: `Expiring` · `Past Due` · `At Risk`
- **Chosen:** `Expiring` — symmetric with existing `Refill soon` chip, matches user's "expire credits filter" phrasing.

## A5. `unpaid` status handling
- **Chosen:** treat identical to `past_due`. Stripe's `unpaid` is the terminal state after multiple failed retries — same UX intent (show days passed, urge action).

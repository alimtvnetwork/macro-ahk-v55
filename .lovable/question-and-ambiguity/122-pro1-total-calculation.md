# 122 — pro_1 Total credit calculation formula

**Logged:** 2026-05-29 (No-Questions Mode active)

## Source

User message attached P0058 (plan=`pro_1`) JSON and Lovable UI screenshot showing "Credits 102.3 left". User said:

> "Your JSON calculation is not fixed for the pro_1 plan. It should be: total credits used plus the daily credits limit plus billing period credits. The 58 actually contains 102 credits — how is this possible? Nowhere in the JSON does it show 102.3."

## Relevant JSON fields (P0058)

```
total_credits_used                       = 111
total_credits_used_in_billing_period     = 111
billing_period_credits_limit             = 100
billing_period_credits_used              = 100
daily_credits_limit                      = 5
daily_credits_used                       = 0
daily_credits_used_in_billing_period     = 10.999...
```

Lovable UI shows **102.3 left** — no field in JSON matches this; likely a server-side derived value (possibly involving rollover from prior period or partial-day proration).

## Ambiguities

### A1 — Literal reading of user's words

`Total = total_credits_used + daily_credits_limit + billing_period_credits_limit`
= 111 + 5 + 100 = **216**

- Pros: matches the user's words verbatim.
- Cons: 216 is larger than any sensible "credits granted this period"; mixes used + limits.

### A2 — Used + remaining-in-each-bucket

`Total = total_credits_used_in_billing_period + max(0, billingLimit - billingUsed) + max(0, dailyLimit - dailyUsed)`
= 111 + 0 + 5 = **116**

- Pros: equals "ever provisioned this period"; semantically defensible.
- Cons: user said "billing period credits **limit**" not "remaining".

### A3 — Plan grant only

`Total = billing_period_credits_limit + daily_credits_limit` = **105**

- Pros: matches what the plan actually grants per period.
- Cons: ignores `total_credits_used` overspend (P0058 used 111 > 100 cap).

## Recommendation (A1 — literal)

Per the user's explicit words. For pro_1 plans, in `parseWorkspaceItem`:

```ts
if (plan === 'pro_1') {
  totalCredits = total_credits_used_in_billing_period + daily_credits_limit + billing_period_credits_limit;
  available   = max(0, totalCredits - total_credits_used_in_billing_period - daily_credits_used);
  // = daily_credits_limit + billing_period_credits_limit - daily_credits_used
}
```

For P0058: ⚡105/216 (Used: 111).

If the user meant A2 or A3, they will correct and we flip the formula in one place.

## Note on Lovable's 102.3

We do not currently know how Lovable derives 102.3 — not visible in `/user/workspaces` payload. Likely sourced from the per-workspace `/credit-balance` endpoint (same one the pro_0 branch already consumes). If the user later asks us to match Lovable's number exactly, we will need to extend the pro_0 enrichment pattern to pro_1 as well.

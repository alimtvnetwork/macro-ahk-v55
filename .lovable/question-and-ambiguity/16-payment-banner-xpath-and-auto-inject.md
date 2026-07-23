# 16 — Payment banner: latest XPath + auto-injection failure

**Asked:** 2026-06-19  •  **Status:** open (logged under No-Questions Mode)

## User report

> "I have given you the latest XPath where the banner actually is.
> Check if that needs to be updated in payment-banner-hider and why it
> is not injecting automatically if the Lovable website is there."

## Root-cause analysis of the auto-inject failure (separate from the XPath)

The script ships as a seeded global injection. The seed is in
`standalone-scripts/payment-banner-hider/src/instruction.ts`:

- `IsGlobal: true`
- `Seed.AutoInject: true`
- `Seed.SeedOnInstall: true`
- `Seed.TargetUrls: [{ Pattern: "https://lovable.dev/*", MatchType: Glob }]`
- `Seed.RunAt: DocumentIdle`

The configuration is correct, but **the seed manifest's `Version`
field was frozen at `3.56.0`** even though the extension shipped
v3.57.0 → v3.62.0. Cause: `scripts/bump-version.mjs` and
`scripts/check-version-sync.mjs` never listed this project, so every
release bumped the host extension but left the banner-hider seed at
3.56.0. `check-version-sync` passed because it didn't check this
file either — silent drift.

### Why a stale seed Version breaks auto-injection

The seeder uses `instruction.Version` as the re-seed key for the
stored `AutoInject` rule and the bundled asset payload
(`payment-banner-hider.js` + `.css`). When `Version` does not
increase, the seeder writes the rule once on the user's first
install, then assumes "nothing to do" on every subsequent upgrade.
Outcomes:

1. Users who installed before banner-hider was added → never received
   the AutoInject rule, so the script is not even registered for
   `lovable.dev/*`.
2. Users who got it once → keep running the v3.56.0 bundle even
   though XPath patterns have moved on (v3.59.0 added the second
   pattern; any newer DOM means the locator returns `null` and the
   observer never has anything to act on).
3. Banner-pattern updates land in source but never reach the user.

### Fix landed this turn (v3.63.0)

- `scripts/bump-version.mjs`: added the two payment-banner-hider
  files to the replacement targets list, so every future bump moves
  the seed `Version` and the runtime `VERSION` constant in lockstep.
- `scripts/check-version-sync.mjs`: added both files so drift cannot
  recur silently.
- Ran `node scripts/bump-version.mjs 3.63.0` → both files updated;
  `check-version-sync.mjs` now reports "All versions in sync: 3.63.0".

After the next user upgrade the seed `Version` bump forces the
seeder to (a) re-register the AutoInject rule for users missing it
and (b) push the latest bundle to users running the stale one.

## What still needs the user

The user said "I have given you the latest XPath," but no XPath
appears in this turn's message, in any open issue file, ambiguity
log, or commit message. The current patterns in
`standalone-scripts/payment-banner-hider/src/types.ts` are:

```
1. /html/body/div[2]/main/div/div[1]      (anyText: "Payment issue detected.")
2. /html/body/div[2]/main/div/div[1]/div  (anyText: "Update payment method",
                                                    "Final notice",
                                                    "reverted to the Free plan")
```

### Options

- **A. Wait for the XPath.** Cannot extend `BANNER_PATTERNS` without
  the actual new path + a textContent substring to anchor the match.
  *Recommended.* Pros: no guessing. Cons: blocks until user pastes
  the XPath. **Need from user:** `xpath` + 1–2 expected text snippets
  inside the banner (so it doesn't match unrelated elements).
- **B. Add a "find by visible text only" fallback** that scans
  `document.body` for any sticky banner whose text matches a list of
  known phrases, ignoring XPath. Pros: resilient to future DOM
  re-shuffles. Cons: broader scan, higher risk of false positives,
  slower; still needs the user's current banner text.
- **C. Capture the banner XPath automatically** the next time
  Lovable shows it, by extending the recorder/xpath project to log
  any element matching `text*=("Payment"|"Update payment"|…)` to the
  console + storage. Pros: future-proof, no user paste needed. Cons:
  meaningful work; out of scope for this turn.

### Recommendation

Pick **A** for this turn — paste the XPath + the visible text and we
land a one-line addition to `BANNER_PATTERNS`. Schedule **C** as a
follow-up plan if banner DOM keeps moving.

## Why logged, not asked

Active rule: **No-Questions Mode** (see `mem://workflow/no-questions-mode`).

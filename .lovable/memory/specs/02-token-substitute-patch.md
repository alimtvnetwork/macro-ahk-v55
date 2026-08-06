---
name: Token Substitute Patch
description: Defensive patch for residual {{n}} tokens in token-substitute.ts.
type: feature
---

## Goal
Ensure no raw `{{n}}` tokens leak into the final prompt text displayed to the user.

## Implementation Details
- Added a fallback regex replacement in `token-substitute.ts`.
- Targets `{{n}}` and variants that might have escaped the primary pipeline.
- Ensures a clean user experience in the Plan and Next buttons.

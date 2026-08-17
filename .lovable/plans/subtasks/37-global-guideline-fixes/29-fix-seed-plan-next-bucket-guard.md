# Fixing isBucketMissing Guard in seed-plan-next

**Target:** `standalone-scripts/macro-controller/src/seed/seed-plan-next.ts`
**Rule:** Rule 3

## Violation

- **L151:** `if (!bucket)` — extract `const isBucketMissing = !bucket;`

## Instructions

Apply fix, run `pnpm run lint`, commit:

```
fix(guidelines): extract isBucketMissing in seed-plan-next
```

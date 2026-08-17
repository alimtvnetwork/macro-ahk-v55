# Fixing Key/Raw Data Guards in token-seeder

**Target:** `src/background/handlers/token-seeder.ts`
**Rule:** Rule 3

## Violations

- **L234:** `if (!key)` — extract `const isKeyMissing = !key;`
- **L240:** `if (!isSupabaseKey)` — extract `const isNonSupabaseKey = !isSupabaseKey;` (renamed from `isKeyNotSupabase` for positive phrasing)
- **L245:** `if (!raw || raw.length < 20)` — extract `const isRawTokenInvalid = !raw || raw.length < 20;`

## Instructions

Apply fixes, run lint, commit:

```
fix(guidelines): extract key/raw guards in token-seeder
```

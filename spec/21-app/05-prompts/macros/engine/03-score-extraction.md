# Score Extraction

## Purpose
Parse a numeric quality score from prompt output to drive `LoopIf` / `TargetScore` decisions.

## Canonical pattern
```
score: NN/100
```
Case-insensitive, leading/trailing whitespace tolerated, `NN` = integer 0–100.

## Regex (canonical)
```ts
const SCORE_REGEX = /(?:^|\n)\s*score\s*:\s*(\d{1,3})\s*\/\s*100\b/i;
```

## Resolution rules
1. Scan **last** `Output` chunk first (LLMs typically place verdict at the end).
2. If multiple matches in the same chunk, take the **last** one (final verdict wins).
3. Captured `NN` parsed as `parseInt(_, 10)`; reject if `< 0 || > 100` → `Reason='ScoreOutOfRange'`.
4. No match → `Reason='ScoreNotFound'`, `ReasonDetail` = first 240 chars of trailing output.

## Fail-fast policy
- **No alternate regexes.** No "/10" rescaling, no percent-sign tolerance, no XML/JSON extraction fallbacks.
- If a macro author wants a different format, they author a `JsInline` step that extracts and re-emits the canonical line.
- This keeps score parsing deterministic and audit-friendly.

## Emission
On success the runner emits:
```ts
{ type: 'ScoreParsed', RunId, StepIndex, Score: number, RawLine: string }
```
Persisted to `_log.jsonl` and bubbled to the panel banner.

## Tests
Unit tests under `tests/engine/score-parser.test.ts` cover:
- happy path (score at end)
- multiple matches → last wins
- whitespace / casing variants
- out-of-range rejection
- not-found rejection (with truncated `ReasonDetail`)

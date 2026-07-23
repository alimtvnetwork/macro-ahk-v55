# Score Parser Pseudo-code

```ts
const SCORE_RE = /^\s*Score:\s*(\d{1,3})\s*\/\s*100\s*$/gm;

export function parseScore(output: string): number | null {
  let match: RegExpExecArray | null;
  let last: number | null = null;
  while ((match = SCORE_RE.exec(output)) !== null) {
    const n = Number(match[1]);
    if (n >= 0 && n <= 100) last = n;
  }
  return last;
}
```

## Rules

- **Last match wins** (audit may print interim scores before the final).
- Out-of-range matches (>100) are ignored.
- Case-sensitive `Score:` prefix — variants (`SCORE`, `score`) must use the same case.
- Trailing whitespace tolerated; leading is tolerated.
- Returns `null` when no valid match; `loop-if` treats `null` as below threshold.

## Test vectors

| Input | Expected |
|---|---:|
| `Score: 87 / 100` | 87 |
| `score: 50/100` (lowercase) | null |
| `Score: 0 / 100` | 0 |
| `Score: 101 / 100` | null |
| `Intermediate Score: 40/100\n…\nScore: 90 / 100` | 90 |
| `no score line` | null |

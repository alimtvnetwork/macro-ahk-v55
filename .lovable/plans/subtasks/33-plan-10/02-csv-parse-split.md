# Subtask 02 — Split csv-parse cognitive complexity 53 -> <=15

Slug: 02-csv-parse-split
Parent: 33-plan-10
Status: pending
Created: 2026-07-20

## Target

`src/background/recorder/step-library/csv-parse.ts:49` — the top-level parse function currently has cognitive complexity 53 (baseline shows this as the single worst offender in the repo).

## Extraction plan

Introduce three named helpers, each under the 15-line cap:

1. `parseHeaderRow(rawLine: string, options: CsvOptions): CsvHeaderResult`
   - Handles BOM stripping, delimiter detection, header trimming.
   - Returns `{ columns, delimiter, failure? }`.
2. `parseBodyRow(rawLine: string, header: CsvHeader, rowIndex: number): CsvRowResult`
   - Splits on the detected delimiter, applies quote handling, coerces types.
   - Returns `{ cells, failure? }`.
3. `classifyRowFailure(row: CsvRowResult, header: CsvHeader): CsvFailureBranch | null`
   - Maps mismatched column counts, empty required cells, and quote imbalances to typed `CsvFailureBranch` values (already exists in `csv-parse.ts` per v4.339.0 changelog).

Top-level `parseCsv()` becomes a composition of these three helpers plus a `for` loop; it MUST be under 15 lines after the split.

## Error surfacing (per coding guidelines)

- Every helper that detects a failure returns a typed branch with:
  - `rowIndex` (1-based)
  - `Reason` (short code, e.g. `HeaderMissing`, `QuoteUnbalanced`, `ColumnCountMismatch`)
  - `ReasonDetail` (human string)
  - `rawSlice` (first 120 chars for verbose-logging users only; masked otherwise)
- Callers funnel every branch through `Logger.error('CsvParse.row', ...)` with the mandatory failure-log schema. No swallowed catches.

## Tests

- `csv-parse.header.test.ts` — 3 cases (happy, BOM present, delimiter override).
- `csv-parse.body.test.ts` — 4 cases (happy, mismatched column count, unbalanced quotes, type coercion).
- `csv-parse.classify.test.ts` — 3 cases (one per failure branch).
- Regression: existing `csv-parse.test.ts` MUST still pass unchanged (public API preserved).

## Verification

- `rg -n "cognitive-complexity" $(node -e "console.log(process.cwd())") --type ts` shows no rule violation for this file after refactor.
- Targeted lint: `pnpm lint src/background/recorder/step-library/csv-parse.ts` exits 0.
- `bunx vitest run csv-parse` — full green.

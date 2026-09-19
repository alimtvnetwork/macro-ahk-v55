# 00 - Inventory (denominator)

Generated: 2026-07-27 (manual sweep; deterministic re-run: see command block below).

## Command used

```bash
cd standalone-scripts && for pkg in */; do
  prod=$(find "$pkg" -type f -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/__tests__/*' -not -name '*.test.ts' -not -name '*.spec.ts' | wc -l)
  tests=$(find "$pkg" -type f -name '*.test.ts' -o -name '*.spec.ts' -o -path '*/__tests__/*' | wc -l)
  loc=$(find "$pkg" -type f -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/__tests__/*' -not -name '*.test.ts' -not -name '*.spec.ts' -exec cat {} + | wc -l)
  echo "$pkg $prod $tests $loc"
done
```

## Package rollup

| Package | Prod .ts files | Test .ts files | Prod LOC |
|---------|---------------:|---------------:|---------:|
| `_generated/` | 0 | 0 | 0 |
| `lovable-common/` | 33 | 0 | 1,628 |
| `lovable-dashboard/` | 15 | 2 | 889 |
| `lovable-owner-switch/` | 47 | 5 | 2,524 |
| `lovable-user-add/` | 44 | 4 | 2,345 |
| `macro-controller/` | 310 | 169 | 60,332 |
| `macros/` | 0 | 0 | 0 |
| `marco-sdk/` | 20 | 0 | 3,709 |
| `payment-banner-hider/` | 8 | 2 | 678 |
| `prompts/` | 0 | 0 | 0 |
| `types/` | 31 | 0 | 846 |
| `xpath/` | 6 | 0 | 278 |
| **Total** | **514** | **182** | **73,229** |

## Macro-controller subdirectory drill-down (top offender)

| Subdir under `macro-controller/src/` | Prod files | Prod LOC |
|--------------------------------------|-----------:|---------:|
| `capture/` | 4 | 386 |
| `core/` | 6 | 757 |
| `credit-balance/` | 6 | 708 |
| `credit-balance-update/` | 15 | 1,336 |
| `db/` | 6 | 964 |
| `gitsync/` | 3 | 612 |
| `loop-run-state/` | 2 | 109 |
| `pro-zero/` | 29 | 951 |
| `project-lock/` | 3 | 216 |
| `queue-control/` | 6 | 456 |
| `remix/` | 3 | 383 |
| `seed/` | 2 | 235 |
| `storage/` | 1 | 137 |
| `types/` | 15 | 1,114 |
| `ui/` | **106** | **28,800** |
| `util/` | 1 | 92 |
| `utils/` | 1 | 45 |

## Observations relevant to later steps

1. **`macro-controller/src/ui/` dominates**: 106 files, 28,800 LOC = ~48% of all prod code under `standalone-scripts/`. Expect the majority of design-system, logger-contract, and teardown violations to land here.
2. **`util/` and `utils/` coexist**: naming inconsistency. Rename target flagged in `03-file-folder-naming.md`.
3. **`_generated/`, `macros/`, `prompts/` are empty**: keep as buckets or delete? Flagged in `03-file-folder-naming.md`.
4. **`marco-sdk/` vs `macro-controller/`**: `marco` (typo) vs `macro`. Historical spelling drift; separate call-out.
5. **Test-to-prod ratio**: macro-controller 169/310 = 55%. Healthy. Other packages are under-tested (owner-switch 5/47 = 11%, user-add 4/44 = 9%). Not part of this audit's scope but noted.

## Denominator lock

Every downstream percentage in `99-summary.md` divides by **514 prod files / 73,229 prod LOC**. If those numbers change, regenerate this file first.

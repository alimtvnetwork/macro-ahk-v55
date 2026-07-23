---
Slug: innerhtml-migration-plan
Status: pending
Created: 2026-07-17
Parent: 17-standalone-scripts-guideline-remediation
---

# SS-04 — innerHTML migration plan (P0-01)

Root cause: 187 `.innerHTML =` sites across `ui/**` accept variable interpolation without a central escape/sanitisation contract, making every one a latent XSS if a workspace name, prompt body, or credit-response field ever contains user-controlled markup.

## New primitive

`standalone-scripts/macro-controller/src/ui/dom/safe-template.ts`

- `html\`...\`` tagged template literal that escapes every interpolated value via `escapeHtml()`.
- Explicit `raw()` wrapper for the rare pre-sanitised fragment (must include a reason comment).
- Returns `TrustedHtml` opaque type — assignment target `.innerHTML` accepts only `TrustedHtml`.

## Migration batches

| Batch | Files | Sinks (approx) |
| --- | --- | --- |
| B1 | `ui/prompt-dropdown.ts`, `ui/projects-modal.ts`, `ui/ws-list-renderer.ts` | 55 |
| B2 | `ui/database-*.ts` | 32 |
| B3 | `ui/settings-*.ts`, `ui/section-*.ts` | 41 |
| B4 | `ui/panel-*.ts`, `ui/prompt-*` remainder | 40 |
| B5 | Long tail (`ui/toast.ts`, `ui/error-overlay.ts`, `ui/summary-bar/**`) | 19 |

## Verification per batch

- Value-locking DOM snapshot test in `__tests__/<file>-dom-snapshot.test.ts`: render with sample inputs, assert `outerHTML` unchanged vs golden.
- After the final batch: `rg -c "\.innerHTML\s*=" standalone-scripts` returns 0 outside `dom/safe-template.ts`.
- `check-standalone-baselines.mjs innerHTMLSinks` = 0.

## Non-goals

Not adding a general HTML sanitiser (DOMPurify) — the values we accept are typed strings from our own DB; escape-only is sufficient and 15 KB smaller. Documented in `spec/02-coding-guidelines/11-security/`.

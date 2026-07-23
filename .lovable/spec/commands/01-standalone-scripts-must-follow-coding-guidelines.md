Slug: standalone-scripts-must-follow-coding-guidelines
Status: active
Created: 2026-07-17

# Command: standalone-scripts must follow coding-guidelines + error-manage specs

Captured: 2026-07-27
Scope: every package under `standalone-scripts/**` (macro-controller, payment-banner-hider, shared-state, and any future addition).

## Verbatim

"Can you please make sure that the coding that you have done in the standalone scripts, this actually follows the coding guideline? And how many places it does not follow — create a folder on top of the spec folder inside the spec folder, say, missing coding guideline. That would be 33-missing-coding-guideline, and the files which are missing and what it is missing, how we can improve it. Find those things from the standalone scripts to follow the coding guideline and error management."

## When it applies

- Any new file created under `standalone-scripts/**` must be checked against `spec/02-coding-guidelines/**` and `spec/03-error-manage/**` before merge.
- Whenever the user asks for an audit of `standalone-scripts`, produce/refresh `spec/33-missing-coding-guideline/` per Plan-16.
- Remediation of violations tracked separately (post Plan-16).

## Enforcement artefacts

- Audit report: `spec/33-missing-coding-guideline/`
- Machine-readable rollup: `spec/33-missing-coding-guideline/99-summary.json`
- Follow-up remediation plan: to be created after Plan-16 completes.

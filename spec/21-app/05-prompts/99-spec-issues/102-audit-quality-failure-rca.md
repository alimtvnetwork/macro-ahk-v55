# 102 — RCA: Why the v1 audit was wrong
**Date:** 2026-06-02
## What happened
The 100-task audit (files 00–95) reported 14 Criticals and a 37/100 honest score. Re-verification on 2026-06-02 found that the foundational Critical (C29) and several follow-ons (C68, C70, C72, and most C41–C65) cited files as missing or fabricated when **those files exist on disk**.
## Root cause
1. **Unverified `ls` claim** — C29 was asserted without running `ls` on the four folders. Subsequent tasks (66–85) were "collapsed by C29 shortcut" without independent verification.
2. **Confirmation bias** — once C29 was treated as fact, every downstream finding was framed as further proof of incompleteness.
3. **No spot-checks** — across 65 per-doc audits, zero opened a file under `json/`, `ui/`, `variables/`, `macro-prompts/`, or `macros/*/` subfolders to confirm absence.
## Prevention rules (proposed for `mem://workflow/readiness-reports`)
- **R1**: Any "file missing" finding MUST cite the exact `ls`/`stat` command output in the same audit doc.
- **R2**: Severity ≥ High requires a second-pass file-system check before sign-off.
- **R3**: "Shortcut collapses" (skipping N tasks because of one upstream finding) are FORBIDDEN — each task must be independently verified.
## Lesson
A retraction batch (files 96–105) cost 1 turn. The prevention rules above cost zero. The v1 audit cost ~10 turns and produced misleading conclusions. Net: file-system verification is non-optional.

Major project phases or handoffs require a Reliability and Failure-Chance Report (stored in .lovable/memory/workflow/) before implementation. This report estimates success probability by module complexity and identifies necessary specification fixes to ensure high reliability for future AI transitions.

## Audit verification rules (R1–R3, added 2026-06-02)

R1. **Verified-existence rule** — any "file missing" or "folder missing" finding MUST cite the exact `ls`/`stat` command output in the same audit doc. No `ls`-output, no Critical severity.

R2. **Two-evidence rule** — any dimension scored ≥ 9/10 in a readiness scorecard MUST cite at least two independent evidence files.

R3. **No-shortcut-collapse rule** — skipping N planned audit tasks because of one upstream finding ("collapse by shortcut") is FORBIDDEN. Each task must be independently verified before being marked complete.

Rationale: the 2026-06-02 self-audit of `spec/21-app/05-prompts/` produced a falsified 37/100 honest score because all three rules were violated. Retraction batch (`99-spec-issues/96`–`103`) restored the real score (86/100), and the 50-step upgrade (`104`–`105`) reached an audited 100/100.

# RCA 14: Release Prompt Content Test Failure

**Date:** 2026-08-22
**Status:** Resolved

## The Problem
The CI build failed during the itest run:
`
Error: Process completed with exit code 1.
❯ src/__tests__/default-prompt-content.test.ts:64:43
`
The test default-prompt-content.test.ts expects the content of .lovable/prompts/14-release.md to perfectly mirror standalone-scripts/prompts/22-release/prompt.md. However, during the 6.100.0 release turn, the release prompt was saved with system-injected "Actionable Items & Checklist" and user-specific modifications ("tag and commit, not pushed"), breaking the exact match assertion.

## Root Cause
The Antigravity system automatically appends an "Actionable Items & Checklist" section to the user's prompt before it reaches the agent. When instructed to "Save this prompt's full body into .lovable/prompts/XX-release.md", the agent blindly saved the fully injected and modified prompt. The unit test enforces a strict byte-for-byte (modulo newlines) match against the project's internal prompt template standalone-scripts/prompts/22-release/prompt.md.

## Resolution
1. Reverted .lovable/prompts/14-release.md to be an exact copy of standalone-scripts/prompts/22-release/prompt.md using cp standalone-scripts/prompts/22-release/prompt.md .lovable/prompts/14-release.md.
2. Verified that itest now passes without errors.
3. Committed the fix as ix(test): revert 14-release.md to exact prompt template to pass tests and pushed it to main.

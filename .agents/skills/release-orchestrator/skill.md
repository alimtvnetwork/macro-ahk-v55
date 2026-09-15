---
name: release-orchestrator
description: >-
  Execute full automated release orchestration, semantic version bumping, branch management, and tag creation using Python scripts.
---

# Automated Release Orchestrator

Execute full automated release orchestration, semantic version bumping, branch management, and tag creation using Python scripts.

## Core Directives

1. Determine bump tier (MINOR default, reset PATCH to 0).
2. Verify git clean status before release execution.
3. **Mandatory Pre-Release Unit Tests & CI/CD Verification:** Execute `python 03-ai-scripts/06-cicd-local-runner.py --run-tests` and verify all unit test suites, AST checks, and quality gates pass 100% green (`exit 0`).
4. **Test Inventory Validation:** Cross-reference `.lovable/temp/recent-file-changes.json` with `.lovable/test-inventory.json` to verify that all test suites covering recently modified files pass completely.
5. Use `03-ai-scripts/29-release-orchestrator.py` to coordinate version updates across packages, changelog, and git branches/tags.

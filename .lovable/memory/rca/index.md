# RCA Index

## CI/CD and Infrastructure
- [03-5-19-0-infra-outage](./03-5-19-0-infra-outage.md) — GH Actions 502/503 Service Unavailable (2026-08-06)
- [02-5-19-0-remote-tag-missing](../release/issues/02-5-19-0-remote-tag-missing.md) — Tag missing from remote preflight (2026-08-06)
- [01-5-19-0-git-tag-skipped](../release/issues/01-5-19-0-git-tag-skipped.md) — Git tag skipped due to sandbox limits (2026-08-06)
- [04-action-download-resolution-hardening](./04-action-download-resolution-hardening.md) - Removed 30 third-party `uses:` steps to shrink action-download outage surface (2026-08-06)
- [05-ci-not-triggering-and-not-releasing](./05-ci-not-triggering-and-not-releasing.md) - GITHUB_TOKEN push suppression and workflow parser rejection (2026-08-06)
- [06-release-published-without-assets](./06-release-published-without-assets.md) - v5.9.0 to v5.22.0 published zero-asset releases; three causes, plus the rule to verify releases through the Actions API instead of a file diff (2026-08-07)
- [07-e2e-class-serialization-2026-08-17](./07-e2e-class-serialization-2026-08-17.md) - Playwright evaluate serialization stripping ServiceResult class getter properties and data wrapper restructuring (2026-08-17)
- [08-swallowed-db-errors](./08-swallowed-db-errors.md) - DB queries wrapped manually with void 0, rewritten to use ServiceResult.wrapDb (2026-08-20)
- [09-seeder-error-stmt-step](./09-seeder-error-stmt-step.md) - TypeError: stmt.step is not a function due to ServiceResult.wrapDb blindly wrapping statements without unwrapping (2026-08-22)
- [10-prompt-dropdown-button-styling](./10-prompt-dropdown-button-styling.md) - UI: Fixed text wrapping, inconsistent button heights, and contrast issues in the prompt dropdown header (2026-08-22)

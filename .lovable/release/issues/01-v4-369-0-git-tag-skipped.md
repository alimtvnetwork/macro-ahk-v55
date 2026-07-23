# Commit and tag step skipped

- Previous version and new version: `4.368.0` to `4.369.0`
- Step that failed: 8, Tag and commit
- Command run and full error output: not run. The active tool policy forbids stateful git commands, including `git add`, `git commit`, and `git tag`.
- Files involved: release files changed in this turn
- Resolution or workaround: unresolved in the sandbox. Create the commit and tag outside this tool environment with message `release: v4.369.0 release prompt enforcement and full version pin sync`, then tag `v4.369.0`.
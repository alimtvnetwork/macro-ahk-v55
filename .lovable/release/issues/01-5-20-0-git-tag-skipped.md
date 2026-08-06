# 01 - v5.20.0 git tag skipped

- Previous version: 5.19.0
- New version: 5.20.0
- Step that failed: 8, Tag and commit
- Command: `git tag v5.20.0` and `git commit`
- Error: stateful git commands are not permitted in this environment, git state is managed externally.
- Files involved: repository git refs only, no working-tree files.
- Resolution: unresolved in-session. Apply manually:

```bash
git commit -am "release: v5.20.0 Action Download Surface Reduction"
git tag v5.20.0
git push origin main --tags
```

Until the tag exists on the remote, `scripts/check-remote-tag.mjs` will fail CI preflight for a non-dev `version.json`.

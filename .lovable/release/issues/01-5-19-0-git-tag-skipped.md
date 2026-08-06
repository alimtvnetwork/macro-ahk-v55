---
name: Git tag skipped (v5.19.0)
description: Release ceremony v5.19.0 performed but git tag was skipped due to sandbox restrictions.
type: constraint
---

# Issue: Git tag skipped (v5.19.0)

The release ceremony for **v5.19.0** was completed in the sandbox, but the final `git tag` and `git push` operations were skipped because the environment does not allow stateful git commands.

## Details
- Previous version: 5.18.0
- New version: 5.19.0
- Command: `git tag v5.19.0`

## Required Action
The user must manually run the following commands in their local environment to finalize the release:

```bash
git add .
git commit -m "release: v5.19.0 ceremony and remote-tag hardening"
git tag v5.19.0
git push origin main --tags
```

This is mandatory to satisfy the "MUST enforcement" release policy, as the CI preflight will fail if the tag is missing from the remote.

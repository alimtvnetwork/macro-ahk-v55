# Git hooks

Opt-in local hooks that mirror the CI markdown-filename policy.

## Enable

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

## What runs

- `pre-commit`: rejects any commit that stages a `.md` file whose name is not lowercase-hyphen-case (or ALL-CAPS for docs like `README.md`). Subtasks under `.lovable/plans/subtasks/` must start with the numeric sequence (`01-slug.md`, not `ss-01-slug.md`).

The hook shells out to `node scripts/check-markdown-filenames.mjs`, the same script CI runs (`.github/workflows/ci.yml` -> `check:markdown-filenames`), so local and CI results always agree.

## Bypass

Use `git commit --no-verify` for genuine emergencies only. CI will still block the push.

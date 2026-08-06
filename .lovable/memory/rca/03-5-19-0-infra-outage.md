# Release v5.19.0 — Service Unavailable / Bad Gateway

## Status
Active

## Context
CI/CD failed during the "Prepare all required actions" step with `Internal Server Error`, `Bad Gateway`, and `Service Unavailable`. This indicates a GitHub Actions infrastructure outage, not a code regression.

## Signal
- Runner version: '2.336.0'
- Error: `Failed to resolve action download info. Error: Service Unavailable`
- Step: `Prepare all required actions`

## Action
The build should be retried manually once GitHub status is green. No code changes required. The current version remains `5.19.0-dev` to maintain CI passability during the outage.

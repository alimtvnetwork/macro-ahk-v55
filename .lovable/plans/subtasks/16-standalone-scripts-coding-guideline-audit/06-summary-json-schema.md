# SS-06 summary JSON schema

Parent: 16-standalone-scripts-coding-guideline-audit
Status: pending
Created: 2026-07-27

## Schema

```jsonc
{
  "generatedAt": "ISO-8601 UTC",
  "inventory": { "totalFiles": 0, "totalLoc": 0 },
  "findings": [
    {
      "file": "standalone-scripts/macro-controller/src/ui/prompt-library-modal.ts",
      "line": 412,
      "guideline": "24-app-design-system-and-ui",
      "ruleId": "no-inline-hex",
      "severity": "P2",
      "note": "cssText literal uses #0f1522 instead of --surface-input token",
      "fixHint": "extract to shared style constant in ui/tokens.ts"
    }
  ],
  "rollups": {
    "byGuideline": { "24-app-design-system-and-ui": 42 },
    "bySeverity": { "P0": 0, "P1": 0, "P2": 0 },
    "byFile": [{ "file": "…", "count": 0 }]
  }
}
```

## Why JSON

CI can gate future PRs by comparing new-finding count against baseline. Markdown alone can't do that.

## Producer

A small `scripts/audit-standalone-guidelines.mjs` (to be written in the remediation plan, NOT this plan) will emit this file. For Plan-16 the JSON is hand-authored from the grep sweep outputs.

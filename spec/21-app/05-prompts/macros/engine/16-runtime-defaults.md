# Runtime Defaults
Authoritative source for all numeric/string defaults referenced elsewhere.
| Key | Value | Used by |
|---|---:|---|
| `runtimeDefaults.stepTimeoutMs` | 60_000 | watchdog (any step) |
| `runtimeDefaults.auditStepTimeoutMs` | 180_000 | `audit` step |
| `runtimeDefaults.nextLoopIterationTimeoutMs` | 30_000 | `next-loop` per iter |
| `runtimeDefaults.totalRunTimeoutMs` | 1_800_000 | total run |
| `runtimeDefaults.maxLoops` | 5 | `loop-if` |
| `runtimeDefaults.maxLoopsHardCap` | 20 | `loop-if` ceiling |
| `runtimeDefaults.targetScore` | 100 | `loop-if` threshold |
| `runtimeDefaults.eventBufferMax` | 1_000 | panel event ring |
| `runtimeDefaults.runStateMaxRows` | 50 | LRU prune in storage |
| `runtimeDefaults.auditFolderRoot` | `spec/audit/` | audit-writer |
| `runtimeDefaults.scoreRegex` | `/^\s*Score:\s*(\d{1,3})\s*\/\s*100\s*$/gm` | score-parser |
| `runtimeDefaults.tokenPattern` | `/\{\{\s*([A-Z][A-Za-z0-9]*)\s*\}\}/g` | interpolator |
| `runtimeDefaults.sensitivePattern` | `/password\|token\|secret\|api[_-]?key\|bearer/i` | masking |
| `runtimeDefaults.timezone` | `the user's local timezone` | all timestamps |
| `runtimeDefaults.runIdGen` | `crypto.randomUUID` | start of run |
## Override surface
- Macro-wide: top-level fields on `MacroDefinition`
- Step-wide: optional fields on `Step`
- Project-wide: `chrome.storage.local["Project.RuntimeDefaultsOverride"]`
- User-wide: NOT supported (defaults are spec-level)
## Override precedence
`Step > Macro > Project > Spec default`.

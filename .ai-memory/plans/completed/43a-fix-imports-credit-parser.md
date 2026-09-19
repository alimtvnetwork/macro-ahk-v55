# Task 43a: Fix inline import expressions in credit-parser.ts

Status: completed

## Instructions
1. Open `standalone-scripts/macro-controller/src/credit-parser.ts`.
2. Add `import type { WorkspaceCredit } from './types';` at the top of the file.
3. Replace all inline `import('./types').WorkspaceCredit` type annotations in the file (lines 93, 102, 126, 150, 233, 307, 346, 364, 381) with `WorkspaceCredit`.
4. Verify changes compile.

# Task 43b: Fix inline import expressions in workspace-detection, db, and types

Status: completed

## Instructions
1. Open `standalone-scripts/macro-controller/src/workspace-detection.ts`. Add `import type { WorkspaceCredit } from './types';` at the top and replace inline `import('./types').WorkspaceCredit[]` with `WorkspaceCredit[]` at lines 294, 313.
2. Open `standalone-scripts/macro-controller/src/ws-context-menu.ts`. Add `import type { WorkspaceCredit } from './types';` at the top and replace inline type references at lines 102, 106.
3. Open `standalone-scripts/macro-controller/src/db/prompt-role-db.ts`. Add `import type { UpsertInput } from './prompt-db';` at the top and replace inline type references.
4. Open `standalone-scripts/macro-controller/src/types/ui-types.ts`. Add `import type { PromptRole } from './prompt-role';` at the top and replace inline references.
5. Verify changes compile.

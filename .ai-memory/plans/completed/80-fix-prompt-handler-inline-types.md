# 80 – Move Inline Anonymous Types in prompt-handler to Types File

## Title
Move inline anonymous types in `prompt-handler` to `handler-types.ts`

## Target File (primary audit)
`src/background/handlers/prompt-handler.ts`

## Secondary File (type destination)
`src/background/handlers/handler-types.ts`

## Rule
**Rule 9 – Types Must Live in Their Own Files**
Inline anonymous object type shapes used in variable declarations, function signatures, or generic type arguments must be named and moved to a dedicated types file.

## Audit Instructions
Perform a full audit of `prompt-handler.ts` to identify all inline anonymous types. Look for the following patterns:

| Pattern | Example |
|---------|---------|
| Inline object type on variable | `const result: { id: string; text: string } = ...` |
| Inline object type as function parameter | `function save(prompt: { name: string; body: string })` |
| `Record<string, unknown>` | `const meta: Record<string, unknown> = ...` |
| Anonymous return type | `): { ok: boolean; prompt?: Prompt } {` |
| Inline generic type argument | `Array<{ name: string; slug: string }>` |

## Fix Template
For each inline type found:

### Step 1 – Name and export in `handler-types.ts`
```ts
// Example
export type PromptSaveRequest = {
  name: string;
  text: string;
  slug?: string;
};
```

### Step 2 – Import in `prompt-handler.ts`
```ts
import type { PromptSaveRequest } from "./handler-types";
```

### Step 3 – Replace the inline type
```ts
// Before
function savePrompt(prompt: { name: string; text: string; slug?: string }) {

// After
function savePrompt(prompt: PromptSaveRequest) {
```

## Instructions
1. Open `src/background/handlers/prompt-handler.ts`.
2. Audit the entire file for inline anonymous type shapes (see patterns table above).
3. For each inline type found:
   a. Create a descriptively named, exported type alias in `handler-types.ts`.
   b. Add/extend the import statement in `prompt-handler.ts`.
   c. Replace the inline type with the named alias.
4. If **no** inline anonymous types are found, record an audit note in the commit message and close the subtask as a no-op.
5. Run `npm run lint`. Resolve all errors.
6. Run `tsc --noEmit` to confirm clean compilation.
7. Commit with message:
   ```
   fix(guidelines): move inline types from prompt-handler to handler-types
   ```
   Include a list of extracted type names in the commit message body.

## Notes
- Do not extract trivial wrapper types like `string[]`, `number | null`, or `Promise<void>`.
- Only extract shapes that represent meaningful domain objects or request/response structures.
- Type names must be PascalCase and descriptive (e.g. `PromptSaveRequest`, `LegacyPromptEntry`, `PromptUpdateResult`).
- Cross-check with subtask 79 to avoid duplicate type names in `handler-types.ts` — if a shape is structurally identical to one extracted from `config-auth-handler`, consider a shared name.

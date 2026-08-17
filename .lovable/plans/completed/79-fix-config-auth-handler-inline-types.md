# 79 – Move Inline Anonymous Types in config-auth-handler to Types File

## Title
Move inline anonymous types in `config-auth-handler` to `handler-types.ts`

## Target File (primary audit)
`src/background/handlers/config-auth-handler.ts`

## Secondary File (type destination)
`src/background/handlers/handler-types.ts`

## Rule
**Rule 9 – Types Must Live in Their Own Files**
Named or anonymous inline type shapes (`{ field: type }`, `Record<string, unknown>`, etc.) used in variable declarations, function parameters, or return types must be extracted into named aliases in a dedicated types file.

## Audit Instructions
Before writing any code, perform a full audit of `config-auth-handler.ts` to identify all inline anonymous types. Look for the following patterns:

| Pattern | Example |
|---------|---------|
| Inline object type on variable | `const x: { id: string; name: string } = ...` |
| Inline object type as function parameter | `function f(opts: { token: string; projectId: string })` |
| `Record<string, unknown>` | `const payload: Record<string, unknown> = ...` |
| Anonymous return type | `): { success: boolean; error?: string } {` |
| Inline generic type argument | `Array<{ key: string; value: unknown }>` |

## Fix Template
For each inline type found:

### Step 1 – Name and export the type in `handler-types.ts`
```ts
// Example
export type ConfigAuthPayload = {
  token: string;
  projectId: string;
};
```

### Step 2 – Import in `config-auth-handler.ts`
```ts
import type { ConfigAuthPayload } from "./handler-types";
```

### Step 3 – Replace the inline type
```ts
// Before
const payload: { token: string; projectId: string } = ...;

// After
const payload: ConfigAuthPayload = ...;
```

## Instructions
1. Open `src/background/handlers/config-auth-handler.ts`.
2. Audit the entire file for inline anonymous type shapes (see patterns table above).
3. For each inline type found:
   a. Create a descriptively named, exported type alias in `handler-types.ts`.
   b. Add/extend the import in `config-auth-handler.ts`.
   c. Replace the inline type with the named alias.
4. If **no** inline anonymous types are found, record an audit note in the commit message and close the subtask as a no-op.
5. Run `npm run lint`. Resolve all errors.
6. Run `tsc --noEmit` to confirm clean compilation.
7. Commit with message:
   ```
   fix(guidelines): move inline types from config-auth-handler to handler-types
   ```
   Include a list of extracted type names in the commit message body.

## Notes
- Generic utility types like `Partial<T>`, `Readonly<T>`, `Promise<T>`, or simple `string[]` arrays do **not** need to be extracted.
- Only extract types that represent a meaningful domain shape — not trivial primitives.
- Type names should be PascalCase and descriptive of their domain role (e.g. `ConfigAuthPayload`, `TokenValidationResult`).

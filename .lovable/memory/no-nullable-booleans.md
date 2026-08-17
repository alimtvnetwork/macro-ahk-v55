# No Nullable Booleans (Strict False Default)

**Context:** The codebase requires strict predictability and minimal branching when evaluating feature flags, state checks, and database properties. Nullable booleans (`null`, `undefined`, or optional `?` properties) introduce a third state that causes ambiguity (true, false, or unset) and forces consumers to write complex null-checks.

## The Rule

1. **Never use nullable booleans**: A boolean must always be strictly `boolean`.
2. **Never use optional booleans**: Do not use the `?` modifier for boolean properties (e.g., `isFeatureEnabled?: boolean`). 
3. **Default to false**: Instead of defaulting to `null` or `undefined`, all boolean fields, state variables, and database columns MUST default to `false` (unless the business logic explicitly dictates a `true` default).
4. **Applies Everywhere**: This applies to TypeScript interfaces, database schemas, component props, and API response payloads.

## Examples

**Bad (Violation):**
```typescript
interface UserSettings {
  isPremium?: boolean;
  hasSeenOnboarding: boolean | null;
}

let isReady: boolean | undefined = undefined;
```

**Good (Compliant):**
```typescript
interface UserSettings {
  isPremium: boolean; // default false in initialization/db
  hasSeenOnboarding: boolean; // default false
}

let isReady: boolean = false;
```

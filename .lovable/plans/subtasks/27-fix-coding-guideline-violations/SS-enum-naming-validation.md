# Subtask: Strict Enum Naming Validation
Status: ⏳ Pending

## Objective
Replace garbage Enum names (`Enum_*`, `SemanticSemantic*`) with meaningful names and ensure ALL enums end in `Type`.

## Scope
`src/types/enums.ts` and anywhere `enum ` is declared.

## Validation
- `grep "enum \w+"` should yield zero results that don't end in `Type`.

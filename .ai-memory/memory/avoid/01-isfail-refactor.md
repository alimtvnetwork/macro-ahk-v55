# Root Cause Analysis: Inverted Boolean State Mass-Refactoring Failure

## The Problem
A regex-based mass-refactor was attempted to replace !x.isSuccess and !x.ok with x.isFail. This resulted in severe syntax errors and runtime crashes across the codebase.

## Root Cause
1. **Blind String Replacement**: The script eplace-in-file or sed equivalents were used to search for ! and .ok or .isSuccess. This inherently broke because not all objects with .ok properties natively implement an .isFail property. In particular:
   - The native DOM Response object returned by etch() has .ok but no .isFail.
   - The generic ApiResponse interface had an .ok field but no .isFail field.
   - The SqlBridgeResp interface had an .ok field but no .isFail field.
2. **Interface constraints**: Because ApiResponse and SqlBridgeResp were purely TypeScript interfaces, they could not define dynamic getters like get isFail(). Even if the string replace succeeded, TypeScript compilation failed because the objects instantiated at runtime didn't actually have an isFail property or it was typed as undefined.
3. **Double negation or partial matches**: In some cases, strings were partially matched, resulting in syntax errors such as !!x.isFail or x.isFail() being called improperly.

## The Solution (Implemented)
Instead of a blind regex replace, an AST-aware tool (	s-morph) was used to structurally identify the types of objects accessing .ok or .isSuccess.
1. SqlBridgeResp and ApiResponse were converted from interface to class, ensuring that they can instantiate a native get isFail() getter.
2. The central unSql and callEndpoint implementations were updated to construct and return these actual class instances instead of POJOs.
3. Only variables whose types resolved strictly to the known wrappers (ServiceResult, SqlBridgeResp, ApiResponse) were targeted for the !x.ok -> x.isFail replacement, completely avoiding native DOM Response breakages.

## Avoid
- DO NOT use regex or raw string manipulation for structural codebase-wide refactors involving properties. Use TypeScript's compiler API (AST) via 	s-morph or jscodeshift.
- DO NOT assume interface property additions will be reflected at runtime. Remember that objects instantiated from generic functions (like JSON.parse or raw API responses) need actual class mapping if you want them to have dynamic getters.

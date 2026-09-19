# Subtask 02: API Explorer Type Safety

Status: completed

## Goal
Resolve `any` type casting issues in `src/components/options/api-explorer/ApiExplorerSwagger.tsx` and `src/components/options/api-explorer/EndpointAccordionItem.tsx`.

## Action Items
1. Open `src/components/options/api-explorer/ApiExplorerSwagger.tsx`.
2. Locate `GET_API_STATUS as any` on line 31 and `GET_API_ENDPOINTS as any` on line 47.
3. Remove the redundant `as any` casting from those string types.
4. Locate the `setEndpoints` mapping on line 49. Replace the double cast `as any as Record<string, any>` with a clean cast mapping or safe type assertion matching `Record<string, SerializableValue>`.
5. Verify changes compile cleanly.

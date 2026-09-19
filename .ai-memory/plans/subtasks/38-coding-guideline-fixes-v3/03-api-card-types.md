# Subtask 03: API Explorer Card Type Safety

Status: completed

## Goal
Resolve `any` type casting issues in `src/components/options/ApiExplorerCard.tsx`.

## Action Items
1. Open `src/components/options/ApiExplorerCard.tsx`.
2. Locate line 72 and line 88 and remove redundant `as any` casting from payload types.
3. Locate line 124 to line 131. Replace `as Record<string, any>` and `sendMessage<any>(message as any)` with proper typed objects satisfying `MessagePayload` and `sendMessage<unknown>(message)`.
4. Verify changes compile cleanly.

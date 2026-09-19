# Subtask 01: Automation View Type Safety

Status: completed

## Goal
Resolve `any` type casting issues in `src/components/automation/AutomationView.tsx`.

## Action Items
1. Open `src/components/automation/AutomationView.tsx`.
2. Locate the calls to `sendMessage` around lines 59, 69, 79.
3. Replace the `as any` cast on the payloads with proper type definitions or let it satisfy `MessagePayload` naturally (using `import type { MessagePayload } from "@/platform/platform-adapter"` or `import type { SerializableValue } from "@/platform/platform-adapter"` if needed).
4. Verify changes compile cleanly.

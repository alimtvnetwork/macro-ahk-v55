# Message Contract — TypeScript

```ts
// ── Panel → Background ───────────────────────────────────────────────
export type PanelToBg =
  | { Type: "StartMacro"; Slug: string; Variables: Record<string, JsonValue>; TabId: number }
  | { Type: "PauseMacro"; RunId: string }
  | { Type: "ResumeMacro"; RunId: string }
  | { Type: "StopMacro"; RunId: string }
  | { Type: "GetRunState"; RunId: string };

// ── Background → Panel ───────────────────────────────────────────────
export type BgToPanel =
  | MacroEvent
  | { Type: "RunStateSnapshot"; State: RunState };

// ── Background → Injector (MAIN world) ───────────────────────────────
export type BgToInjector =
  | { Type: "ExecStep"; RunId: string; StepIndex: number; StepKindId: number; ResolvedBody: string; SensitiveNames: string[] }
  | { Type: "AbortStep"; RunId: string; StepIndex: number };

// ── Injector → Background ────────────────────────────────────────────
export type InjectorToBg =
  | { Type: "StepResult"; RunId: string; StepIndex: number; Output: string; Score?: number | null }
  | { Type: "StepFailed"; RunId: string; StepIndex: number; Reason: string; ReasonDetail: string;
      SelectorAttempts?: SelectorAttempt[]; VariableContext?: VarContext[] };

// ── Shared types ─────────────────────────────────────────────────────
export interface SelectorAttempt {
  Id: string; Strategy: "css" | "xpath" | "data-attr" | "text";
  Expression: string; Matched: boolean; MatchCount: number; Reason: string | null;
}
export interface VarContext {
  Name: string; Source: "step" | "macro" | "ui" | "builtIn" | "default";
  Row?: number; Column?: number; ResolvedValue: JsonValue; Type: string; Reason: string | null;
}
```

All inbound messages are validated against `json/13-event-stream.schema.json` (events) or hand-written guards for the rest. Unknown `Type` → drop + log `Reason='UnknownMessageType'`.

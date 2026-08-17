/**
 * Marco Extension — Shared Handler Types
 *
 * Common type aliases used across background message handlers
 * to replace bare `unknown` with semantically meaningful types.
 */

import type { MirrorDiagnosticToTabLevelType, PipelineLineLevelType, SourceType } from "../../types/enums";

/** A diagnostic log line to be mirrored to the devtools console of a target tab. */
export type MirrorDiagnosticLine = {
  "msg": string;
  level: MirrorDiagnosticToTabLevelType;
};

/** A primitive value returned by sql.js queries. */
export type SqlValue = string | number | Uint8Array | null;

/** A single row returned by sql.js `stmt.getAsObject()`. */
export type SqlRow = Record<string, SqlValue>;

/** Generic JSON-compatible value for message payloads and storage. */
export type JsonValue =
    | string
    | number
    | boolean
    | JsonValue[]
    | { [key: string]: JsonValue };

/** Generic JSON-compatible object (e.g., message payload fields). */
export type JsonRecord = Record<string, JsonValue>;

/** Pipeline console mirroring log line entry. */
export type PipelineLine = {
  "msg": string;
  level: PipelineLineLevelType;
};

/* ------------------------------------------------------------------ */
/*  Config & Auth Handler Types                                        */
/* ------------------------------------------------------------------ */

/** Result of resolving session and refresh cookie names from projects. */
export type ResolvedCookieNames = {
  sessionNames: readonly string[];
  refreshNames: readonly string[];
};

/** Active session and refresh tokens retrieved from cookies or storage. */
export type SessionTokens = {
  sessionId: string | null;
  refreshToken: string | null;
};

/** Result of a cookie lookup by candidate names. */
export type CookieLookupResult = {
  value: string | null;
  cookieName: string | null;
};

/** Summary of auth-like cookies discovered across candidate URLs. */
export type CookieDiscoverySummary = {
  checkedUrls: string[];
  authLikeCookieNames: string[];
};

/** Result of token validation. */
export type TokenValidationResult = {
  isValid: boolean;
  status: number | null;
};

/** Result of handleGetConfig returning merged config and source tier. */
export type GetConfigResult = {
  config: Record<string, unknown>;
  source: SourceType;
};

/** Result of handleGetToken resolving an auth token. */
export type GetTokenResult = {
  token: string | null;
  refreshed: boolean;
  errorMessage?: string;
  cookieName?: string;
};

/** Result of an individual auth token resolution strategy. */
export type AuthStrategyTokenResult = {
  token: string;
  refreshed: boolean;
  cookieName: string;
};

/** Result of handleRefreshToken forcing token renewal. */
export type RefreshTokenResult = SessionTokens & {
  authToken?: string;
  errorMessage?: string;
};

/* ------------------------------------------------------------------ */
/*  Prompt Handler Types                                               */
/* ------------------------------------------------------------------ */

/** Stored prompt record representation. */
export type PromptEntry = {
  id: string;
  slug?: string;
  name: string;
  text: string;
  version?: string;
  order: number;
  isDefault: boolean;
  isFavorite: boolean;
  category?: string;
  categories?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

/** Candidate record when checking if a prompt can be deleted. */
export type DeletePromptCandidate = {
  name: string;
  isDefault: boolean;
};

/** Raw default prompt shape before migration/mapping to PromptEntry. */
export type RawDefaultPromptEntry = {
  id?: string;
  slug?: string;
  name?: string;
  text?: string;
  version?: string;
  order?: number;
  isDefault: boolean;
  isFavorite: boolean;
  category?: string;
};

/** Bundled default prompts file bundle schema. */
export type BundledPromptBundle = {
  prompts?: RawDefaultPromptEntry[];
};

/** Response schema from bundled prompt JSON endpoint. */
export type BundledPromptsApiResponse = BundledPromptBundle | RawDefaultPromptEntry[];

/** Response shape for handleGetPrompts. */
export type GetPromptsResult = {
  prompts: PromptEntry[];
};

/** Payload for handleSavePrompt. */
export type SavePromptPayload = {
  prompt: Partial<PromptEntry>;
};

/** Response shape for handleSavePrompt. */
export type SavePromptResult = {
  isOk: true;
  prompt: PromptEntry;
};

/** Payload for handleDeletePrompt. */
export type DeletePromptPayload = {
  promptId: string;
};

/** Payload for handleReorderPrompts. */
export type ReorderPromptsPayload = {
  promptIds: string[];
};

/** Collects all rows from a sql.js prepared statement into typed array. */
export function collectTypedRows(
  stmt: { step(): boolean; getAsObject(): SqlRow; free(): void },
): SqlRow[] {
  const rows: SqlRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();

  return rows;
}

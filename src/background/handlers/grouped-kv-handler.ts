/**
 * Marco Extension — Grouped Key-Value Handler (Issue 60)
 *
 * CRUD operations for GroupedKv table in logs.db.
 * All column names use PascalCase per database naming convention.
 *
 * Validates required fields via handler-guards so missing 'group' or 'key'
 * payload fields return a clean isOk:false response instead of triggering
 * "tried to bind a value of an unknown type (undefined)" inside sql.js.
 *
 * @see src/background/handlers/handler-guards.ts — input validation
 * @see .lovable/memory/architecture/project-scoped-database.md — Project-scoped DB
 */

import type { Database as SqlJsDatabase } from "sql.js";
import type { DbManager } from "../db-manager";
import type { MessageRequest } from "../../shared/messages";
import {
  bindOpt,
  missingFieldError,
  requireField,
  requireKey,
  type HandlerErrorResponse,
} from "./handler-guards";
import { ServiceResult } from '@/utils/result-wrapper';

let dbManager: DbManager | null = null;

export function bindGroupedKvDbManager(manager: DbManager): void {
  dbManager = manager;
}

function requireGroupKey(
  group: string | null | undefined,
  key: string | null | undefined,
): boolean {
  const isGroupMissing = !group;
  const isKeyMissing = !key;

  return !isGroupMissing && !isKeyMissing;
}

function getDb(): SqlJsDatabase {
  const manager = dbManager;
  if (!manager) {
    throw new Error("[grouped-kv] DbManager not bound");
  }

  return manager.getLogsDb();
}

function markDirty(): void {
  dbManager?.markDirty();
}

export async function handleGkvGet(
  message: MessageRequest,
): Promise<{ value: string | null } | HandlerErrorResponse> {
  const raw = message as MessageRequest & { group?: unknown; key?: unknown };
  const group = requireField(raw.group);
  const key = requireKey(raw.key);
  if (!requireGroupKey(group, key)) {
    return missingFieldError(!group ? "group" : "key", "gkv:get");
  }

  const db = getDb();
  const execRes = ServiceResult.wrapDb(() => db.exec(
    "SELECT Value FROM GroupedKv WHERE GroupName = ? AND Key = ?",
    [group, key],
  ));
  if (execRes.isFail) {
    return { isOk: false, errorMessage: String(execRes.error) } as HandlerErrorResponse;
  }

  const result = execRes.data!;
  const value =
        result.length > 0 && result[0].values.length > 0
          ? String(result[0].values[0][0])
          : null;

  return { value };
}

export async function handleGkvSet(
  message: MessageRequest,
): Promise<{ isOk: true } | HandlerErrorResponse> {
  const raw = message as MessageRequest & { group?: unknown; key?: unknown; value?: unknown };
  const group = requireField(raw.group);
  const key = requireKey(raw.key);
  if (!requireGroupKey(group, key)) {
    return missingFieldError(!group ? "group" : "key", "gkv:set");
  }

  const safeValue = bindOpt(raw.value) ?? "";

  const db = getDb();
  const res = ServiceResult.wrapDb(() => db.run(
    `INSERT OR REPLACE INTO GroupedKv (GroupName, Key, Value, UpdatedAt) VALUES (?, ?, ?, datetime('now'))`,
    [group, key, safeValue],
  ));
  if (res.isFail) {
    return { isOk: false, errorMessage: String(res.error) };
  }

  markDirty();

  return { isOk: true };
}

export async function handleGkvDelete(
  message: MessageRequest,
): Promise<{ isOk: true } | HandlerErrorResponse> {
  const raw = message as MessageRequest & { group?: unknown; key?: unknown };
  const group = requireField(raw.group);
  const key = requireKey(raw.key);
  if (!requireGroupKey(group, key)) {
    return missingFieldError(!group ? "group" : "key", "gkv:delete");
  }

  const db = getDb();
  const res = ServiceResult.wrapDb(() => db.run("DELETE FROM GroupedKv WHERE GroupName = ? AND Key = ?", [group, key]));
  if (res.isFail) {
    return { isOk: false, errorMessage: String(res.error) };
  }

  markDirty();

  return { isOk: true };
}

export async function handleGkvList(
  message: MessageRequest,
): Promise<{ entries: Array<{ key: string; value: string }> } | HandlerErrorResponse> {
  const raw = message as MessageRequest & { group?: unknown };
  const group = requireField(raw.group);
  const isGroupMissing = !group;
  if (isGroupMissing) {
    return missingFieldError("group", "gkv:list");
  }

  const db = getDb();
  const stmtResult = ServiceResult.wrapDb(() => db.prepare(
    "SELECT Key, Value FROM GroupedKv WHERE GroupName = ? ORDER BY Key ASC",
  ));
  if (stmtResult.isFail) {
    return { isOk: false, errorMessage: String(stmtResult.error) } as HandlerErrorResponse;
  }

  const stmt = stmtResult.data!;
  stmt.bind([group]);
  const entries: Array<{ key: string; value: string }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    entries.push({ key: String(row.Key), value: String(row.Value) });
  }

  stmt.free();

  return { entries };
}

export async function handleGkvClearGroup(
  message: MessageRequest,
): Promise<{ isOk: true } | HandlerErrorResponse> {
  const raw = message as MessageRequest & { group?: unknown };
  const group = requireField(raw.group);
  const isGroupMissing = !group;
  if (isGroupMissing) {
    return missingFieldError("group", "gkv:clearGroup");
  }

  const db = getDb();
  const res = ServiceResult.wrapDb(() => db.run("DELETE FROM GroupedKv WHERE GroupName = ?", [group]));
  if (res.isFail) {
    return { isOk: false, errorMessage: String(res.error) };
  }

  markDirty();

  return { isOk: true };
}

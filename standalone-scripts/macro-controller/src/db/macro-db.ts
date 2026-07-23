/**
 * MacroLoop Controller — SQLite DB Management (prompts.macro)
 */

import { sendToExtension } from '../ui/extension-relay';
import { log } from '../logger';
import { logDiagnosticFromCode } from '../error-utils';
import {
  REPLACE_KEY_DEFAULT,
  REPLACE_VALUES_DEFAULT_JSON,
  PROMPT_REPLACE_KEY_COLUMN,
  PROMPT_REPLACE_VALUES_COLUMN,
} from './prompt-defaults';
import { DB_NAME } from './db-name';

// Re-export for legacy `import { DB_NAME } from './macro-db'` call-sites.
// New code should import directly from `./db-name` to avoid pulling in the
// full macro-db module graph.
export { DB_NAME };

export interface DbTask {
  id: string;
  projectId: string;
  projectName: string;
  prompt: string;
  status: string;
  error?: string;
  timestamp: number;
}

const SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS Projects (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      ProjectId TEXT UNIQUE,
      Name TEXT,
      Url TEXT,
      UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS Communications (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      ProjectId TEXT,
      Prompt TEXT,
      Response TEXT,
      Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(ProjectId) REFERENCES Projects(ProjectId)
    );
    CREATE TABLE IF NOT EXISTS TaskQueue (
      Id TEXT PRIMARY KEY,
      ProjectId TEXT,
      ProjectName TEXT,
      Prompt TEXT,
      Status TEXT,
      Error TEXT,
      Timestamp INTEGER,
      FOREIGN KEY(ProjectId) REFERENCES Projects(ProjectId)
    );
    CREATE TABLE IF NOT EXISTS ProjectChatSubmit (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      ProjectId TEXT NOT NULL,
      ProjectName TEXT,
      Source TEXT NOT NULL,
      FileId TEXT NOT NULL,
      CharCount INTEGER NOT NULL DEFAULT 0,
      CreatedAt INTEGER NOT NULL,
      MetaJson TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_project_chat_submit_project_created
      ON ProjectChatSubmit (ProjectId, CreatedAt);
    CREATE TABLE IF NOT EXISTS Prompt (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Slug TEXT NOT NULL UNIQUE,
      Name TEXT NOT NULL,
      Body TEXT NOT NULL,
      Role TEXT NOT NULL DEFAULT 'generic',
      IsDefault INTEGER NOT NULL DEFAULT 0,
      ReplaceKey TEXT NOT NULL DEFAULT '${REPLACE_KEY_DEFAULT}',
      ReplaceValues TEXT NOT NULL DEFAULT '${REPLACE_VALUES_DEFAULT_JSON}',
      CreatedAt INTEGER NOT NULL,
      UpdatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS PromptRevision (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      PromptId INTEGER NOT NULL,
      Slug TEXT NOT NULL,
      Name TEXT NOT NULL,
      Body TEXT NOT NULL,
      Role TEXT NOT NULL,
      ReplaceKey TEXT NOT NULL DEFAULT '',
      ReplaceValues TEXT NOT NULL DEFAULT '[]',
      CreatedAt INTEGER NOT NULL,
      Reason TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_prompt_revision_slug_createdat
      ON PromptRevision (Slug, CreatedAt);
    CREATE TABLE IF NOT EXISTS PromptSeedAudit (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      SeededAt INTEGER NOT NULL,
      AppVersion TEXT NOT NULL DEFAULT '',
      InsertedTotal INTEGER NOT NULL DEFAULT 0,
      SkippedTotal INTEGER NOT NULL DEFAULT 0,
      PromotedTotal INTEGER NOT NULL DEFAULT 0,
      UpgradedTotal INTEGER NOT NULL DEFAULT 0,
      Reason TEXT NOT NULL DEFAULT 'boot',
      TelemetryJson TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_prompt_seed_audit_seededat
      ON PromptSeedAudit (SeededAt);
    DROP VIEW IF EXISTS v_prompt_history;
    CREATE VIEW v_prompt_history AS
    SELECT c.Id, c.ProjectId, c.Prompt, c.Response, c.Timestamp, p.Name as ProjectName, p.Url as ProjectUrl
    FROM Communications c
    LEFT JOIN Projects p ON c.ProjectId = p.ProjectId;
  `;

interface PragmaColumnRow { name: string }

interface PromptColumnMigration { column: string; ddl: string }

const PROMPT_ROLE_COLUMN = 'Role';
const PROMPT_IS_DEFAULT_COLUMN = 'IsDefault';
const PROMPT_ROLE_DEFAULT_INDEX = 'idx_prompt_role_isdefault';

const PROMPT_COLUMN_MIGRATIONS: readonly PromptColumnMigration[] = [
  {
    column: PROMPT_ROLE_COLUMN,
    ddl: `ALTER TABLE Prompt ADD COLUMN ${PROMPT_ROLE_COLUMN} TEXT NOT NULL DEFAULT 'generic'`,
  },
  {
    column: PROMPT_IS_DEFAULT_COLUMN,
    ddl: `ALTER TABLE Prompt ADD COLUMN ${PROMPT_IS_DEFAULT_COLUMN} INTEGER NOT NULL DEFAULT 0`,
  },
  {
    column: PROMPT_REPLACE_KEY_COLUMN,
    ddl: `ALTER TABLE Prompt ADD COLUMN ${PROMPT_REPLACE_KEY_COLUMN} TEXT NOT NULL DEFAULT '${REPLACE_KEY_DEFAULT}'`,
  },
  {
    column: PROMPT_REPLACE_VALUES_COLUMN,
    ddl: `ALTER TABLE Prompt ADD COLUMN ${PROMPT_REPLACE_VALUES_COLUMN} TEXT NOT NULL DEFAULT '${REPLACE_VALUES_DEFAULT_JSON}'`,
  },
];

async function readPromptColumnNames(): Promise<Set<string>> {
  const resp = await sendToExtension('PROJECT_API', {
    project: DB_NAME,
    method: 'QUERY',
    endpoint: 'rawSql',
    params: { sql: 'PRAGMA table_info(Prompt)' },
  });
  const isOk = Boolean(resp?.isOk) && Array.isArray(resp?.rows);
  const rows = isOk ? (resp.rows as PragmaColumnRow[]) : [];

  return new Set(rows.map((row) => row?.name).filter((name): name is string => typeof name === 'string'));
}

async function applyPromptColumnMigration(migration: PromptColumnMigration): Promise<void> {
  const resp = await sendToExtension('PROJECT_API', {
    project: DB_NAME,
    method: 'SCHEMA',
    endpoint: 'rawSql',
    params: { sql: migration.ddl },
  });
  if (!resp?.isOk) {
    logDiagnosticFromCode('DB_MACRO_MIGRATION_E001', { column: migration.column, reason: resp?.errorMessage ?? UNKNOWN_ERROR });

    return;
  }
  log(`[MacroDb] Migrated Prompt: added column ${migration.column}`, 'success');
}

async function ensurePromptRoleDefaultIndex(): Promise<void> {
  const resp = await sendToExtension('PROJECT_API', {
    project: DB_NAME,
    method: 'SCHEMA',
    endpoint: 'rawSql',
    params: { sql: `CREATE INDEX IF NOT EXISTS ${PROMPT_ROLE_DEFAULT_INDEX} ON Prompt (${PROMPT_ROLE_COLUMN}, ${PROMPT_IS_DEFAULT_COLUMN})` },
  });
  if (resp?.isOk) return;
  logDiagnosticFromCode('DB_MACRO_MIGRATION_E001', { column: PROMPT_ROLE_DEFAULT_INDEX, reason: resp?.errorMessage ?? UNKNOWN_ERROR });
}

/**
 * Idempotently backfill Prompt columns added after the first Prompt schema.
 * Fresh DBs already have the columns from CREATE TABLE, so this becomes a
 * no-op after PRAGMA lookup.
 */
export async function migratePromptReplaceColumns(): Promise<void> {
  try {
    const existing = await readPromptColumnNames();
    for (const migration of PROMPT_COLUMN_MIGRATIONS) {
      if (existing.has(migration.column)) {
        continue;
      }
      await applyPromptColumnMigration(migration);
    }
    await ensurePromptRoleDefaultIndex();
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_MIGRATION_E001', { column: 'batch', reason: err instanceof Error ? err.message : String(err) }, err);
  }
}

const CODE_DB_MACRO_INIT = 'DB_MACRO_INIT_E001';
const UNKNOWN_ERROR = 'unknown error';
const STAGE_ORPHAN_REPAIR = 'orphan-repair';
const STAGE_AUTO_REPAIR = 'auto-repair';
const STAGE_SCHEMA_INIT = 'schema-init';

type Stage = import('../seed/seed-status-store').SeedStageReport;
type OrphanRepairReport = import('../seed/repair-plan-next-orphans').OrphanRepairReport;

async function runOrphanRepairStage(stages: Stage[]): Promise<OrphanRepairReport> {
  const { repairPlanNextOrphans } = await import('../seed/repair-plan-next-orphans');
  const report = await repairPlanNextOrphans();
  const metrics = { inspected: report.inspected, adopted: report.adopted, failures: report.failures };
  if (report.failures > 0) {
    logDiagnosticFromCode(CODE_DB_MACRO_INIT, {
      stage: STAGE_ORPHAN_REPAIR,
      reason: 'failures=' + report.failures + ' adopted=' + report.adopted,
    });
    stages.push({ stage: STAGE_ORPHAN_REPAIR, status: 'failed', reason: 'failures=' + report.failures, metrics });
  } else {
    stages.push({ stage: STAGE_ORPHAN_REPAIR, status: 'ok', metrics });
  }
  return report;
}

async function runSeedPlanNextStage(stages: Stage[]): Promise<void> {
  const { seedPlanNextPrompts } = await import('../seed/seed-plan-next');
  const seedResult = await seedPlanNextPrompts();
  if (!seedResult.ok) {
    const reason = seedResult.error ?? UNKNOWN_ERROR;
    logDiagnosticFromCode(CODE_DB_MACRO_INIT, { stage: 'seed-plan-next', reason });
    stages.push({ stage: 'seed-plan-next', status: 'failed', reason });
    return;
  }
  stages.push({ stage: 'seed-plan-next', status: 'ok' });
}

async function runAutoRepairStage(stages: Stage[]): Promise<void> {
  const { runPromptHealthCheckWithAutoRepair } = await import('../seed/prompt-health-auto-repair');
  const health = await runPromptHealthCheckWithAutoRepair();
  const initialIssues = health.initialReport.issues.length;
  const finalIssues = health.finalReport.issues.length;
  if (!health.isHealthy) {
    logDiagnosticFromCode(CODE_DB_MACRO_INIT, { stage: STAGE_AUTO_REPAIR, reason: 'residual issues=' + finalIssues });
    stages.push({ stage: STAGE_AUTO_REPAIR, status: 'failed', reason: 'residual issues=' + finalIssues, metrics: { initialIssues, finalIssues } });
    return;
  }
  if (health.repairAttempted) {
    log('[MacroDb] Prompt defaults auto-repaired on boot (initial issues=' + initialIssues + ')', 'success');
    stages.push({ stage: STAGE_AUTO_REPAIR, status: 'ok', metrics: { initialIssues, finalIssues: 0 } });
    return;
  }
  stages.push({ stage: STAGE_AUTO_REPAIR, status: 'ok', metrics: { initialIssues: 0, finalIssues: 0 } });
}

async function runReadMemoryDuplicateStage(stages: Stage[]): Promise<void> {
  const { validateAndDisableReadMemoryDuplicates } = await import('./validate-read-memory-duplicates');
  const report = await validateAndDisableReadMemoryDuplicates();
  const metrics = { detected: report.detected, disabled: report.disabled };
  if (report.detected > 0 && report.disabled < report.detected) {
    const reason = 'detected=' + report.detected + ' disabled=' + report.disabled;
    logDiagnosticFromCode(CODE_DB_MACRO_INIT, { stage: 'read-memory-duplicate-validation', reason });
    stages.push({ stage: 'read-memory-duplicate-validation', status: 'failed', reason, metrics });
    return;
  }
  stages.push({ stage: 'read-memory-duplicate-validation', status: 'ok', metrics });
}

async function runPostSchemaStages(stages: Stage[]): Promise<OrphanRepairReport | undefined> {
  await migratePromptReplaceColumns();
  const { migrateRemoveLegacyReadMemoryDuplicates } = await import('./migrate-legacy-read-memory');
  await migrateRemoveLegacyReadMemoryDuplicates();
  stages.push({ stage: 'legacy-read-memory-dedupe', status: 'ok' });
  const orphanReport = await runOrphanRepairStage(stages);
  await runSeedPlanNextStage(stages);
  await runAutoRepairStage(stages);
  await runReadMemoryDuplicateStage(stages);
  return orphanReport;
}

/**
 * Initialize the macro database schema.
 */
export async function initMacroDb(): Promise<void> {
  const { publishSeedStatusSnapshot, computeOverall } = await import('../seed/seed-status-store');
  const stages: Stage[] = [];
  let orphanReportRef: OrphanRepairReport | undefined;
  try {
    const resp = await sendToExtension('PROJECT_API', {
      project: DB_NAME,
      method: 'SCHEMA',
      endpoint: 'rawSql',
      params: { sql: SCHEMA_SQL },
    });
    if (resp && resp.isOk) {
      log('Macro DB initialized: ' + DB_NAME, 'success');
      stages.push({ stage: STAGE_SCHEMA_INIT, status: 'ok' });
      orphanReportRef = await runPostSchemaStages(stages);
    } else {
      const reason = resp?.errorMessage || UNKNOWN_ERROR;
      logDiagnosticFromCode(CODE_DB_MACRO_INIT, { stage: STAGE_SCHEMA_INIT, reason });
      stages.push({ stage: STAGE_SCHEMA_INIT, status: 'failed', reason });
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logDiagnosticFromCode(CODE_DB_MACRO_INIT, { stage: 'send-schema-init', reason }, err);
    stages.push({ stage: STAGE_SCHEMA_INIT, status: 'failed', reason });
  } finally {
    publishSeedStatusSnapshot({
      at: new Date().toISOString(),
      overall: computeOverall(stages),
      stages,
      ...(orphanReportRef ? { orphanRepair: orphanReportRef } : {}),
    });
  }
}


/**
 * Save project metadata.
 */
export async function saveProjectMetadata(projectId: string, name: string, url: string): Promise<void> {
  if (!projectId) return;
  
  const sql = `INSERT OR REPLACE INTO Projects (ProjectId, Name, Url, UpdatedAt) 
               VALUES ('${projectId.replace(/'/g, "''")}', '${name.replace(/'/g, "''")}', '${url.replace(/'/g, "''")}', CURRENT_TIMESTAMP)`;
  
  try {
    await sendToExtension('PROJECT_API', {
      project: DB_NAME,
      method: 'SCHEMA',
      endpoint: 'rawSql',
      params: { sql }
    });
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_WRITE_E001', { op: 'saveProjectMetadata', reason: err instanceof Error ? err.message : String(err) }, err);
  }
}

/**
 * Save a communication (prompt/response).
 */
export async function saveCommunication(projectId: string, prompt: string, response: string = ''): Promise<void> {
  if (!projectId || !prompt) return;
  
  // Also update Project metadata if we have it in state
  const { state } = await import('../shared-state');
  const projectName = state.projectNameFromApi || state.projectNameFromDom || 'Unknown Project';
  await saveProjectMetadata(projectId, projectName, window.location.href);

  const sql = `INSERT INTO Communications (ProjectId, Prompt, Response) 
               VALUES ('${projectId.replace(/'/g, "''")}', '${prompt.replace(/'/g, "''")}', '${response.replace(/'/g, "''")}')`;
  
  try {
    await sendToExtension('PROJECT_API', {
      project: DB_NAME,
      method: 'SCHEMA',
      endpoint: 'rawSql',
      params: { sql }
    });
    log('Communication saved to Macro DB', 'info');
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_WRITE_E001', { op: 'saveCommunication', reason: err instanceof Error ? err.message : String(err) }, err);
  }
}

/**
 * Sync the entire task queue for a project to SQLite.
 */
export async function syncTaskQueueToDb(projectId: string, tasks: DbTask[]): Promise<void> {
  if (!projectId) return;

  // Clear existing queue for this project
  const deleteSql = `DELETE FROM TaskQueue WHERE ProjectId = '${projectId.replace(/'/g, "''")}'`;
  
  const insertValues = tasks.map(t => {
    return `('${t.id}', '${t.projectId.replace(/'/g, "''")}', '${(t as { projectName?: string }).projectName ? (t as { projectName: string }).projectName.replace(/'/g, "''") : "Unknown"}', '${t.prompt.replace(/'/g, "''")}', '${t.status}', '${(t.error || '').replace(/'/g, "''")}', ${t.timestamp})`;
  }).join(',');

  const sql = insertValues.length > 0 
    ? `${deleteSql}; INSERT INTO TaskQueue (Id, ProjectId, ProjectName, Prompt, Status, Error, Timestamp) VALUES ${insertValues}`
    : deleteSql;

  try {
    await sendToExtension('PROJECT_API', {
      project: DB_NAME,
      method: 'SCHEMA',
      endpoint: 'rawSql',
      params: { sql }
    });
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_WRITE_E001', { op: 'syncTaskQueueToDb', reason: err instanceof Error ? err.message : String(err) }, err);
  }
}

/**
 * Manual trigger to sync current IndexedDB queue state to SQLite.
 */
export async function forceSyncQueueToDb(): Promise<void> {
  const { visualSyncConfirm } = await import('../ui/prompt-utils');
  const { loadTaskQueue } = await import('../task-queue');
  const { extractProjectIdFromUrl } = await import('../workspace-detection');
  
  const projectId = extractProjectIdFromUrl();
  if (!projectId) return;

  const queueState = await loadTaskQueue();
  // const projectName = state.projectNameFromApi || state.projectNameFromDom || 'Unknown Project';
  
  log('[MacroDb] Force-syncing task queue to SQLite...', 'check');
  await syncTaskQueueToDb(projectId, queueState.tasks);
  visualSyncConfirm();
  log('[MacroDb] Queue synced to SQLite', 'success');
}

/**
 * Purge communication history older than N days.
 */
export async function purgeOldCommunications(days: number = 30): Promise<void> {
  const sql = `DELETE FROM Communications WHERE Timestamp < datetime('now', '-${days} days')`;
  try {
    await sendToExtension('PROJECT_API', {
      project: DB_NAME,
      method: 'SCHEMA',
      endpoint: 'rawSql',
      params: { sql }
    });
    log(`[MacroDb] Purged communications older than ${days} days`, 'info');
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_WRITE_E001', { op: 'purgeOldCommunications', reason: err instanceof Error ? err.message : String(err) }, err);
  }
}

/**
 * Get communication history for the current project.
 */
export async function getCommunicationHistory(projectId: string, limit: number = 50): Promise<unknown[]> {
  const sql = `SELECT * FROM v_prompt_history WHERE ProjectId = '${projectId.replace(/'/g, "''")}' ORDER BY Timestamp DESC LIMIT ${limit}`;
  try {
    const resp = await sendToExtension('PROJECT_API', {
      project: DB_NAME,
      method: 'QUERY',
      endpoint: 'rawSql',
      params: { sql }
    });
    return resp?.isOk ? (Array.isArray(resp.rows) ? (resp.rows as unknown[]) : []) : [];
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_READ_E001', { op: 'getCommunicationHistory', reason: err instanceof Error ? err.message : String(err) }, err);
    return [];
  }
}

/**
 * Export the entire prompts.macro database as a SQL dump.
 */
export async function exportDatabaseDump(): Promise<void> {
  try {
    const resp = await sendToExtension('PROJECT_API', {
      project: DB_NAME,
      method: 'EXPORT',
      endpoint: 'dump'
    });
    
    if (resp && resp.isOk && resp.dump) {
      const blob = new Blob([resp.dump as string], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `prompts-macro-dump-${stamp}.sql`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      log('Database dump exported successfully', 'success');
    } else {
      logDiagnosticFromCode('DB_MACRO_EXPORT_E001', { reason: resp?.errorMessage || 'no dump data' });
    }
  } catch (err) {
    logDiagnosticFromCode('DB_MACRO_EXPORT_E001', { reason: err instanceof Error ? err.message : String(err) }, err);
  }
}


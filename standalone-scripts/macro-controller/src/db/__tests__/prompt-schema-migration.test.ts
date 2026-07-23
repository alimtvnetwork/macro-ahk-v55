/**
 * Prompt table column migration.
 *
 * Verifies the idempotent PRAGMA-guarded ALTER path: fresh DBs already have
 * the columns from CREATE TABLE, legacy DBs get them back-filled once, and
 * a second boot is a no-op.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall { method: string; sql: string }
interface QueuedResponse { isOk: boolean; rows?: unknown[]; errorMessage?: string }

const captured: CapturedCall[] = [];
let responsesQueue: QueuedResponse[] = [];

vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
    sendToExtension: vi.fn(async (_channel: string, payload: { method: string; params: { sql: string } }) => {
        captured.push({ method: payload.method, sql: payload.params.sql });
        return responsesQueue.shift() ?? { isOk: true };
    }),
}));
vi.mock('../../ui/extension-relay', () => ({
    sendToExtension: vi.fn(async (_channel: string, payload: { method: string; params: { sql: string } }) => {
        captured.push({ method: payload.method, sql: payload.params.sql });
        return responsesQueue.shift() ?? { isOk: true };
    }),
}));
vi.mock('../../error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
    return { ...actual, logError: vi.fn(), logDiagnosticFromCode: vi.fn() };
});
vi.mock('../../logging', () => ({ log: vi.fn() }));
vi.mock('../../seed/seed-plan-next', () => ({
    seedPlanNextPrompts: vi.fn(async () => ({ ok: true })),
}));

import { initMacroDb, migratePromptReplaceColumns } from '../macro-db';

beforeEach(() => {
    captured.length = 0;
    responsesQueue = [];
});

describe('Prompt column migration', () => {
    it('CREATE TABLE embeds ReplaceKey and ReplaceValues defaults', async () => {
        await initMacroDb();
        const schemaSql = captured[0].sql;
        expect(schemaSql).toMatch(/ReplaceKey TEXT NOT NULL DEFAULT 'n'/);
        expect(schemaSql).toMatch(/ReplaceValues TEXT NOT NULL DEFAULT '\["1","2","3","5","8"\]'/);
    });

    it('backfills role/default/replace columns on a legacy DB that lacks them', async () => {
        responsesQueue = [
            { isOk: true }, // schema
            { isOk: true, rows: [{ name: 'Id' }, { name: 'Slug' }] }, // PRAGMA
            { isOk: true }, // ALTER Role
            { isOk: true }, // ALTER IsDefault
            { isOk: true }, // ALTER ReplaceKey
            { isOk: true }, // ALTER ReplaceValues
            { isOk: true }, // CREATE index
        ];
        await initMacroDb();
        const alters = captured.filter((entry) => entry.sql.startsWith('ALTER TABLE Prompt ADD COLUMN'));
        expect(alters).toHaveLength(4);
        expect(alters[0].sql).toContain('Role');
        expect(alters[1].sql).toContain('IsDefault');
        expect(alters[2].sql).toContain('ReplaceKey');
        expect(alters[3].sql).toContain('ReplaceValues');
        expect(captured.some((entry) => entry.sql.startsWith('CREATE INDEX IF NOT EXISTS idx_prompt_role_isdefault'))).toBe(true);
    });

    it('skips ALTER when both columns already exist (idempotent second boot)', async () => {
        responsesQueue = [
            { isOk: true, rows: [{ name: 'Id' }, { name: 'Role' }, { name: 'IsDefault' }, { name: 'ReplaceKey' }, { name: 'ReplaceValues' }] },
            { isOk: true },
        ];
        await migratePromptReplaceColumns();
        const alters = captured.filter((entry) => entry.sql.startsWith('ALTER TABLE Prompt ADD COLUMN'));
        expect(alters).toHaveLength(0);
        expect(captured.some((entry) => entry.sql.startsWith('CREATE INDEX IF NOT EXISTS idx_prompt_role_isdefault'))).toBe(true);
    });

    it('adds only the missing column when one is already present', async () => {
        responsesQueue = [
            { isOk: true, rows: [{ name: 'Id' }, { name: 'Role' }, { name: 'IsDefault' }, { name: 'ReplaceKey' }] },
            { isOk: true },
            { isOk: true },
        ];
        await migratePromptReplaceColumns();
        const alters = captured.filter((entry) => entry.sql.startsWith('ALTER TABLE Prompt ADD COLUMN'));
        expect(alters).toHaveLength(1);
        expect(alters[0].sql).toContain('ReplaceValues');
    });
});

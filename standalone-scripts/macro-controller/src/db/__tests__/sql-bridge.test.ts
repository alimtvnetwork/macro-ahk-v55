/**
 * sql-bridge.test.ts — verifies the adaptive method-name probe.
 *
 * Locks the invariant that the reported failure modes
 * (`Unsupported method: QUERY` and `only ALTER TABLE statements are
 * allowed`) trigger a fallback probe, that real SQL errors do NOT
 * trigger a probe, and that the winning method is cached per bucket.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('../../ui/extension-relay', () => ({
    sendToExtension: (type: string, payload: Record<string, unknown>) => sendMock(type, payload),
}));
vi.mock('../db-name', () => ({ DB_NAME: 'testdb' }));

import { runSql, _resetSqlBridgeCacheForTest, _getSqlBridgeCacheForTest } from '../sql-bridge';

beforeEach(() => {
    sendMock.mockReset();
    _resetSqlBridgeCacheForTest();
});

describe('sql-bridge probe', () => {
    it('falls back past QUERY when backend rejects Unsupported method', async () => {
        sendMock.mockImplementation((_type: string, payload: Record<string, unknown>) => {
            if (payload.method === 'QUERY') {
                return Promise.resolve({ isOk: false, errorMessage: 'Unsupported method: QUERY' });
            }
            if (payload.method === 'SELECT') {
                return Promise.resolve({ isOk: true, rows: [{ Id: 1 }] });
            }
            return Promise.resolve({ isOk: false, errorMessage: 'unexpected: ' + String(payload.method) });
        });

        const resp = await runSql('QUERY', 'SELECT * FROM Prompt');
        expect(resp.isOk).toBe(true);
        expect(resp.rows).toEqual([{ Id: 1 }]);
        expect(_getSqlBridgeCacheForTest().SELECT).toBe('SELECT');
    });

    it('falls back past SCHEMA on non-ALTER writes', async () => {
        sendMock.mockImplementation((_type: string, payload: Record<string, unknown>) => {
            if (payload.method === 'SCHEMA') {
                return Promise.resolve({
                    isOk: false,
                    errorMessage: 'rawSql: only ALTER TABLE statements are allowed',
                });
            }
            if (payload.method === 'EXEC') return Promise.resolve({ isOk: true, lastInsertId: 42 });
            return Promise.resolve({ isOk: false, errorMessage: 'unexpected' });
        });

        const resp = await runSql('SCHEMA', 'INSERT OR IGNORE INTO Prompt (Slug) VALUES (\'x\')');
        expect(resp.isOk).toBe(true);
        expect(resp.lastInsertId).toBe(42);
        expect(_getSqlBridgeCacheForTest().WRITE).toBe('EXEC');
    });

    it('does NOT probe when SCHEMA + ALTER TABLE is the caller', async () => {
        sendMock.mockResolvedValue({ isOk: true });
        const resp = await runSql('SCHEMA', 'ALTER TABLE Prompt ADD COLUMN X TEXT');
        expect(resp.isOk).toBe(true);
        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(sendMock.mock.calls[0][1].method).toBe('SCHEMA');
    });

    it('does NOT probe on real SQL errors (syntax, missing table)', async () => {
        sendMock.mockResolvedValue({ isOk: false, errorMessage: 'no such table: Foo' });
        const resp = await runSql('QUERY', 'SELECT * FROM Foo');
        expect(resp.isOk).toBe(false);
        expect(resp.errorMessage).toBe('no such table: Foo');
        expect(sendMock).toHaveBeenCalledTimes(1);
    });

    it('caches the winning method so subsequent calls skip the probe', async () => {
        sendMock.mockImplementation((_type: string, payload: Record<string, unknown>) => {
            if (payload.method === 'QUERY') {
                return Promise.resolve({ isOk: false, errorMessage: 'Unsupported method: QUERY' });
            }
            return Promise.resolve({ isOk: true, rows: [] });
        });
        await runSql('QUERY', 'SELECT 1');
        const callsAfterFirst = sendMock.mock.calls.length;
        await runSql('QUERY', 'SELECT 2');
        expect(sendMock.mock.calls.length).toBe(callsAfterFirst + 1);
    });
});
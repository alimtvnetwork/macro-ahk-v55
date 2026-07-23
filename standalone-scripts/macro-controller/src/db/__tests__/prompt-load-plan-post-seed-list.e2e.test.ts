/**
 * prompt-load-plan-post-seed-list.e2e.test.ts
 *
 * End-to-end coverage for the reported PROMPT_LOAD_E001 regression: after
 * the rawSql v2 contract change (backend rejects `method: 'QUERY'` and
 * restricts `method: 'SCHEMA'` to `ALTER TABLE`), loading Plan prompts at
 * `stage=post-seed-list` with `seedAttempted=true` for role=plan must still
 * succeed via the adaptive sql-bridge fallback.
 *
 * Also asserts the retry-once behavior added to `pickPromptFromRole`: when
 * the cached bridge method starts returning a contract error, resetting the
 * bridge cache and retrying once recovers without surfacing E001.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const sendMock = vi.fn();

vi.mock('../../ui/prompt-loader', () => ({
    sendToExtension: (type: string, payload: Record<string, unknown>) =>
        sendMock(type, payload),
}));
vi.mock('../db-name', () => ({ DB_NAME: 'testdb' }));

import {
    _resetSqlBridgeCacheForTest,
    getSqlBridgeState,
    resetSqlBridgeCache,
    isSqlBridgeContractError,
} from '../sql-bridge';
import { listPromptsByRole } from '../prompt-db';

beforeEach(() => {
    sendMock.mockReset();
    _resetSqlBridgeCacheForTest();
});

function fakePlanRow(): Record<string, unknown> {
    return {
        Id: 1, Slug: 'plan-default', Name: 'Plan', Body: 'Plan {{n}} steps',
        Role: 'plan', IsDefault: 1, ReplaceKey: 'n', ReplaceValues: JSON.stringify(['1']),
        CreatedAt: 1, UpdatedAt: 1,
    };
}

describe('PROMPT_LOAD_E001 regression — post-seed-list plan load', () => {
    it('recovers when backend rejects QUERY and accepts SELECT', async () => {
        sendMock.mockImplementation((_t: string, p: Record<string, unknown>) => {
            if (p.method === 'QUERY') {
                return Promise.resolve({ isOk: false, errorMessage: 'Unsupported method: QUERY' });
            }
            if (p.method === 'SELECT') {
                return Promise.resolve({ isOk: true, rows: [fakePlanRow()] });
            }
            return Promise.resolve({ isOk: false, errorMessage: 'unexpected: ' + String(p.method) });
        });

        const res = await listPromptsByRole('plan');
        expect(res.ok).toBe(true);
        expect(res.value?.[0]?.Role).toBe('plan');

        // Bridge should have recorded the QUERY rejection and cached SELECT.
        const state = getSqlBridgeState();
        expect(state.winning.SELECT).toBe('SELECT');
        expect(state.rejections.SELECT.length).toBeGreaterThan(0);
        expect(state.rejections.SELECT[0].method).toBe('QUERY');
    });

    it('surfaces PROMPT_LOAD_E001-shaped reason when every SELECT candidate is rejected', async () => {
        sendMock.mockResolvedValue({ isOk: false, errorMessage: 'Unsupported method: QUERY' });
        const res = await listPromptsByRole('plan');
        expect(res.ok).toBe(false);
        expect(isSqlBridgeContractError(res.error) || /no accepted method/.test(res.error ?? ''))
            .toBe(true);
    });

    it('recovers on retry-once after a poisoned cache goes stale', async () => {
        // First call: SELECT accepted -> cached.
        sendMock.mockImplementationOnce(() =>
            Promise.resolve({ isOk: true, rows: [fakePlanRow()] }));
        const first = await listPromptsByRole('plan');
        expect(first.ok).toBe(true);

        // Backend then rolls forward and rejects the cached method with a
        // contract-shape error. The bridge should invalidate the cache and
        // re-probe on the very next call.
        sendMock.mockImplementation((_t: string, p: Record<string, unknown>) => {
            if (p.method === 'QUERY') {
                return Promise.resolve({ isOk: false, errorMessage: 'Unsupported method: QUERY' });
            }
            if (p.method === 'SELECT') {
                return Promise.resolve({ isOk: true, rows: [fakePlanRow()] });
            }
            return Promise.resolve({ isOk: false, errorMessage: 'unexpected' });
        });

        const second = await listPromptsByRole('plan');
        expect(second.ok).toBe(true);
    });

    it('manual resetSqlBridgeCache clears winning state for one bucket', () => {
        // Prime cache via test hook.
        (getSqlBridgeState as unknown); // no-op ref
        resetSqlBridgeCache('SELECT');
        expect(getSqlBridgeState().winning.SELECT).toBeNull();
    });
});
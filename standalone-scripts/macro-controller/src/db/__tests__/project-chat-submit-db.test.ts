/**
 * ProjectChatSubmit DB CRUD — unit tests (plan 13 step 4).
 *
 * Mocks `sendToExtension` so we can assert every emitted SQL string
 * verbatim. Guards against: quote-escape regressions, wrong table name,
 * wrong ORDER BY, missing WHERE clause on the rename backfill (would
 * silently rename every project's history).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPromptLoaderMock } from '../../__tests__/helpers/prompt-loader-mock';

interface CapturedCall {
  method: string;
  sql: string;
}
const captured: CapturedCall[] = [];
let nextResponse: Record<string, unknown> = { isOk: true, rows: [] };

vi.mock('../../ui/prompt-loader', () => buildPromptLoaderMock({
  sendToExtension: vi.fn(async (_channel: string, payload: {
    method: string;
    params: { sql: string };
  }) => {
    captured.push({ method: payload.method, sql: payload.params.sql });
    return nextResponse;
  }),
}));
vi.mock('../../ui/extension-relay', () => ({
  sendToExtension: vi.fn(async (_channel: string, payload: {
    method: string;
    params: { sql: string };
  }) => {
    captured.push({ method: payload.method, sql: payload.params.sql });
    return nextResponse;
  }),
}));

vi.mock('../../error-utils', async () => {
  const actual = await vi.importActual<typeof import('../../error-utils')>('../../error-utils');
  return { ...actual, logError: vi.fn(), logDiagnosticFromCode: vi.fn() };
});

import {
  insertChatSubmit,
  countChatSubmits,
  listRecentChatSubmits,
  listOldestChatSubmits,
  deleteChatSubmit,
  deleteAllChatSubmitsForProject,
  renameProjectChatSubmits,
} from '../project-chat-submit-db';

beforeEach(() => {
  captured.length = 0;
  nextResponse = { isOk: true, rows: [] };
});

describe('insertChatSubmit', () => {
  it('emits an INSERT with all columns and NULL for missing MetaJson', async () => {
    const isOk = await insertChatSubmit({
      projectId: 'proj-1', projectName: 'Alpha', source: 'repeat',
      fileId: 'file-abc', charCount: 42, createdAt: 1700000000000, metaJson: null,
    });
    expect(isOk).toBe(true);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('SCHEMA');
    expect(captured[0].sql).toContain('INSERT INTO ProjectChatSubmit');
    expect(captured[0].sql).toContain("'proj-1'");
    expect(captured[0].sql).toContain("'Alpha'");
    expect(captured[0].sql).toContain("'repeat'");
    expect(captured[0].sql).toContain("'file-abc'");
    expect(captured[0].sql).toContain('42');
    expect(captured[0].sql).toContain('1700000000000');
    expect(captured[0].sql).toContain('NULL');
  });

  it("escapes single quotes in project name (O'Brien project)", async () => {
    await insertChatSubmit({
      projectId: 'p', projectName: "O'Brien", source: 'paste',
      fileId: 'f', charCount: 1, createdAt: 1, metaJson: '{"k":"v"}',
    });
    expect(captured[0].sql).toContain("'O''Brien'");
    expect(captured[0].sql).toContain(`'{"k":"v"}'`);
  });

  it('floors negative or fractional char count to 0/int', async () => {
    await insertChatSubmit({
      projectId: 'p', projectName: null, source: 'paste',
      fileId: 'f', charCount: -5, createdAt: 1.7, metaJson: null,
    });
    expect(captured[0].sql).toMatch(/\b0,\s*1,/);
  });
});

describe('countChatSubmits', () => {
  it('returns the numeric count from row 0', async () => {
    nextResponse = { isOk: true, rows: [{ n: 7 }] };
    const n = await countChatSubmits('proj-1');
    expect(n).toBe(7);
    expect(captured[0].method).toBe('QUERY');
    expect(captured[0].sql).toContain("WHERE ProjectId = 'proj-1'");
  });

  it('returns 0 when no rows come back', async () => {
    nextResponse = { isOk: true, rows: [] };
    expect(await countChatSubmits('nope')).toBe(0);
  });
});

describe('listRecentChatSubmits / listOldestChatSubmits', () => {
  it('sorts DESC for recent, ASC for oldest, both clamp limit', async () => {
    await listRecentChatSubmits('p', 10);
    expect(captured[0].sql).toContain('ORDER BY CreatedAt DESC LIMIT 10');
    captured.length = 0;
    await listOldestChatSubmits('p', 99999);
    expect(captured[0].sql).toContain('ORDER BY CreatedAt ASC LIMIT 1000');
  });
});

describe('deleteChatSubmit', () => {
  it('deletes by integer id and rejects non-integers via Math.floor', async () => {
    await deleteChatSubmit(42.9);
    expect(captured[0].sql).toBe('DELETE FROM ProjectChatSubmit WHERE Id = 42');
  });
});

describe('renameProjectChatSubmits', () => {
  it('scopes UPDATE to the given projectId — never global rename', async () => {
    await renameProjectChatSubmits('proj-1', 'New Name');
    expect(captured[0].sql).toContain('UPDATE ProjectChatSubmit');
    expect(captured[0].sql).toContain("SET ProjectName = 'New Name'");
    expect(captured[0].sql).toContain("WHERE ProjectId = 'proj-1'");
  });
});

describe('deleteAllChatSubmitsForProject', () => {
  it('deletes only the target projectId', async () => {
    await deleteAllChatSubmitsForProject("proj'1");
    expect(captured[0].sql).toBe("DELETE FROM ProjectChatSubmit WHERE ProjectId = 'proj''1'");
  });
});

describe('error surfacing', () => {
  it('returns false / [] when isOk is false — never silently succeeds', async () => {
    nextResponse = { isOk: false, errorMessage: 'boom' };
    expect(await insertChatSubmit({
      projectId: 'p', projectName: null, source: 'paste',
      fileId: 'f', charCount: 1, createdAt: 1, metaJson: null,
    })).toBe(false);
    expect(await countChatSubmits('p')).toBe(0);
  });
});

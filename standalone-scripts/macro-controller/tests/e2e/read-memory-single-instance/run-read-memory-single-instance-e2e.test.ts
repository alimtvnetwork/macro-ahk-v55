/**
 * E2E harness: exactly-one Read Memory prompt (DB + UI).
 *
 * Simulates a real install that boots with duplicate Read Memory rows and
 * verifies the full recovery path:
 *   1. Seed DB with canonical + legacy + imported duplicates.
 *   2. Run `migrateRemoveLegacyReadMemoryDuplicates()` (deletes known slugs).
 *   3. Run `validateAndDisableReadMemoryDuplicates()` (disables unknown ones).
 *   4. Assert DB has exactly one ACTIVE (IsDefault=1) Read Memory row and
 *      that its slug is the canonical `read-memory-enhanced`.
 *   5. Open the Read Memory Admin modal and assert the UI shows exactly one
 *      Active/Canonical status badge.
 *
 * Uses a lightweight in-memory `Prompt` table that responds to the four
 * SQL shapes the code paths issue. No Chrome required (JSDOM).
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { DEFAULT_PROMPT_ORDER } from '../../../src/ui/prompt-drag-order';
import { isHiddenBySlug } from '../../../src/ui/prompt-dropdown';

interface PromptRow { Id: number; Slug: string; Name: string; IsDefault: number }

const CANONICAL_SLUG = 'read-memory-enhanced';
const state: { prompts: PromptRow[] } = { prompts: [] };

function seedInitial(): void {
    state.prompts = [
        { Id: 1, Slug: CANONICAL_SLUG,          Name: 'Read Memory (Enhanced)', IsDefault: 1 },
        { Id: 2, Slug: 'read-memory',           Name: 'Read Memory',            IsDefault: 1 },
        { Id: 3, Slug: 'rejog-the-memory-v1',   Name: 'Rejog the Memory v1',    IsDefault: 1 },
        { Id: 4, Slug: 'read-memory-imported',  Name: 'Read Memory (Imported)', IsDefault: 1 },
    ];
}

function extractInList(sql: string): string[] {
    const match = /IN\s*\(([^)]+)\)/i.exec(sql);
    if (!match) return [];
    return (match[1] ?? '').split(',').map((s) => s.trim().replace(/^'/, '').replace(/'$/, ''));
}

function handleDelete(sql: string): { isOk: true } {
    const slugs = extractInList(sql);
    state.prompts = state.prompts.filter((row) => !slugs.includes(row.Slug));
    return { isOk: true };
}

function handleUpdate(sql: string): { isOk: true } {
    const ids = extractInList(sql).map((v) => Number(v)).filter((n) => Number.isFinite(n));
    const nameMatch = /Name\s*=\s*'((?:[^']|'')*)'/i.exec(sql);
    const prefix = nameMatch ? nameMatch[1]?.replace(/''/g, "'") ?? '' : '';
    for (const row of state.prompts) {
        if (!ids.includes(row.Id)) continue;
        row.IsDefault = 0;
        if (prefix.includes('||')) row.Name = '[duplicate] ' + row.Name;
        else if (prefix.length > 0) row.Name = prefix;
    }
    return { isOk: true };
}

function handleSelect(sql: string): { isOk: true; rows: unknown[] } {
    if (/COUNT\(\*\)/i.test(sql)) {
        const slugs = extractInList(sql);
        const count = state.prompts.filter((row) => slugs.includes(row.Slug)).length;
        return { isOk: true, rows: [{ c: count }] };
    }
    const excludeCanonical = /Slug\s*<>\s*'read-memory-enhanced'/i.test(sql);
    const excludeDuplicatePrefix = /Name\s+NOT\s+LIKE\s+'\[duplicate\] %'/i.test(sql);
    const rows = state.prompts.filter((row) => {
        const slug = row.Slug.toLowerCase();
        const name = row.Name.toLowerCase();
        const matchesShape = slug.startsWith('read-memory') || slug.startsWith('rejog')
            || name.startsWith('read memory') || name.startsWith('rejog')
            || name.startsWith('[duplicate] ');
        if (!matchesShape) return false;
        if (excludeCanonical && row.Slug === CANONICAL_SLUG) return false;
        if (excludeDuplicatePrefix && row.Name.startsWith('[duplicate] ')) return false;
        return true;
    });
    return { isOk: true, rows: rows.map((row) => ({ ...row })) };
}

vi.mock('../../../src/ui/extension-relay', () => ({
    sendToExtension: vi.fn(async (_channel: string, payload: { method: string; params: { sql: string } }) => {
        const sql = payload.params.sql;
        if (payload.method === 'SCHEMA' && /^\s*DELETE/i.test(sql)) return handleDelete(sql);
        if (payload.method === 'SCHEMA' && /UPDATE\s+Prompt/i.test(sql)) return handleUpdate(sql);
        if (payload.method === 'QUERY' && /SELECT/i.test(sql)) return handleSelect(sql);
        return { isOk: true };
    }),
}));
vi.mock('../../../src/ui/prompt-cache', () => ({ clearPromptCache: vi.fn(async () => { /* void */ }) }));
vi.mock('../../../src/logging', () => ({ log: vi.fn() }));
vi.mock('../../../src/error-utils', async () => {
    const actual = await vi.importActual<typeof import('../../../src/error-utils')>('../../../src/error-utils');
    return { ...actual, logDiagnosticFromCode: vi.fn(), logError: vi.fn() };
});

import { migrateRemoveLegacyReadMemoryDuplicates } from '../../../src/db/migrate-legacy-read-memory';
import { validateAndDisableReadMemoryDuplicates } from '../../../src/db/validate-read-memory-duplicates';
import {
    openReadMemoryAdminModal,
    READ_MEMORY_ADMIN_MODAL_ID_FOR_TEST,
} from '../../../src/ui/read-memory-admin-modal';

beforeAll(() => { seedInitial(); });
beforeEach(() => { document.body.innerHTML = ''; });

describe('E2E: exactly one Read Memory prompt (DB + UI)', () => {
    it('boot flow reduces DB to exactly one active Read Memory row', async () => {
        seedInitial();
        expect(state.prompts.filter((row) => row.IsDefault === 1).length).toBe(4);
        await migrateRemoveLegacyReadMemoryDuplicates();
        await validateAndDisableReadMemoryDuplicates();
        const active = state.prompts.filter((row) => row.IsDefault === 1);
        expect(active.length).toBe(1);
        expect(active[0]?.Slug).toBe(CANONICAL_SLUG);
    });

    it('UI shows exactly one Active/Canonical Read Memory row after boot', async () => {
        seedInitial();
        await migrateRemoveLegacyReadMemoryDuplicates();
        await validateAndDisableReadMemoryDuplicates();
        await openReadMemoryAdminModal();
        const modal = document.getElementById(READ_MEMORY_ADMIN_MODAL_ID_FOR_TEST);
        expect(modal).not.toBeNull();
        const badges = Array.from(modal?.querySelectorAll('tbody tr span') ?? [])
            .map((element) => (element.textContent ?? '').trim());
        const activeOrCanonical = badges.filter((label) => label === 'Active' || label === 'Canonical');
        expect(activeOrCanonical).toEqual(['Canonical']);
        const enabledButtons = modal?.querySelectorAll('tbody button:not([disabled])') ?? [];
        expect(enabledButtons.length).toBe(0);
    });

    it('dropdown hides legacy Read Memory rows but keeps the canonical row', () => {
        expect(isHiddenBySlug({ slug: CANONICAL_SLUG, name: 'Read Memory' })).toBe(false);
        expect(isHiddenBySlug({ slug: 'read-memory', name: 'Read Memory' })).toBe(true);
        expect(isHiddenBySlug({ id: 'default-read-memory', name: 'Read Memory' })).toBe(true);
        expect(isHiddenBySlug({ slug: 'read-memory-imported', name: 'Read Memory' })).toBe(true);
    });

    it('default prompt order ends with the canonical terminal 7 (Read/Write/Insults/Release adjacent)', () => {
        expect(DEFAULT_PROMPT_ORDER.slice(-7)).toEqual([
            'proofread',
            'conversation-log',
            'app-spec-audit',
            CANONICAL_SLUG,
            'write-memory',
            'insults-explain',
            'release',
        ]);
    });
});

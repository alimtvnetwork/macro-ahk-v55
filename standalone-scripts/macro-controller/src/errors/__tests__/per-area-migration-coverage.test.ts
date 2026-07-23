/**
 * Plan 26 / step 18 — Per-area migration coverage suite.
 *
 * Root cause this suite guards against (one sentence):
 * Steps 15-17 gate the registry itself, but nothing proves the migrated call
 * sites and the registry stay in sync — a PR could delete the last reference
 * to a registered code (phantom entry) or import a wrong-area code (say
 * `DB_WRITE_E001` from `ui/prompt-editor.ts`) and CI would stay green while
 * users get toasts pointing at the wrong fix.
 *
 * What this suite proves:
 *  A. Every `E<NNN>` code textually referenced in a migrated source file is
 *     registered in `ERROR_CODES`.
 *  B. Every code referenced by a given migrated file belongs to that file's
 *     allowed-area set (catches area misfiles).
 *  C. Every registered code has at least one live emitter across the
 *     migrated set, EXCEPT for the four intentionally-unemitted scaffold
 *     codes explicitly listed in `INTENTIONALLY_UNEMITTED`. Adding a new
 *     orphan will fail this test until it is either wired up or explicitly
 *     annotated here (with a reason).
 *
 * This is a static-source scan, not a mock-and-invoke test — the registry
 * round-trip (step 17) already proves each entry can be constructed and
 * formatted. Per-area *behaviour* tests (each individual call site's
 * failure paths) live alongside each migrated module and are unaffected.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, type ErrorArea } from '../error-codes';

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Resolve from this test file to the macro-controller `src/` root.
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(HERE, '..', '..');

const CODE_PATTERN = /\b([A-Z][A-Z_]+_E\d{3})\b/g;

/**
 * Migrated modules and the areas each is allowed to emit codes for.
 *
 * Rules:
 *  - A module may emit codes from any listed area.
 *  - Adding a new area to a file requires a deliberate edit here — that
 *    keeps cross-area imports (e.g. `ui/prompt-editor.ts` reaching for
 *    `SEED_INSERT_E002` during preflight seed) explicit and reviewable.
 */
const MIGRATED_MODULES: readonly {
  readonly path: string;
  readonly allowedAreas: readonly ErrorArea[];
}[] = [
  { path: 'ui/prompt-editor.ts',        allowedAreas: ['PROMPT', 'SEED', 'DB'] },
  { path: 'ui/chip-gear-menu.ts',       allowedAreas: ['UI', 'PROMPT_IO', 'SEED', 'REPAIR', 'DB'] },
  { path: 'ui/chip-gear-picker.ts',     allowedAreas: ['PROMPT'] },
  { path: 'ui/prompt-injection.ts',     allowedAreas: ['PROMPT'] },
  { path: 'ui/prompt-history-panel.ts', allowedAreas: ['HISTORY'] },
  { path: 'ui/repair-report-modal.ts',  allowedAreas: ['REPAIR'] },
  { path: 'seed/plan-next-prompts.ts',          allowedAreas: ['SEED'] },
  { path: 'seed/seed-plan-next.ts',            allowedAreas: ['SEED'] },
  { path: 'seed/repair-plan-next-orphans.ts',  allowedAreas: ['SEED'] },
  { path: 'seed/prompt-health-check.ts',       allowedAreas: ['HEALTH'] },
  { path: 'seed/prompt-health-auto-repair.ts', allowedAreas: ['HEALTH'] },
  { path: 'db/prompt-role-db.ts',        allowedAreas: ['DB'] },
  { path: 'db/prompt-db.ts',             allowedAreas: ['DB'] },
  { path: 'db/prompt-revision-db.ts',    allowedAreas: ['DB'] },
  { path: 'db/macro-db.ts',              allowedAreas: ['DB'] },
  { path: 'db/project-chat-submit-db.ts',allowedAreas: ['DB'] },
  { path: 'credit-fetch.ts',             allowedAreas: ['CREDIT'] },
  { path: 'credit-balance.ts',            allowedAreas: ['CREDIT'] },
  { path: 'credit-api.ts',                allowedAreas: ['CREDIT'] },
  { path: 'remix-fetch.ts',               allowedAreas: ['REMIX'] },
  { path: 'remix-bulk.ts',                allowedAreas: ['REMIX'] },
  { path: 'remix-name-resolver.ts',       allowedAreas: ['REMIX'] },
  { path: 'ws-members-fetch.ts',          allowedAreas: ['WS_MEMBERS'] },
  { path: 'ws-members-mutations.ts',      allowedAreas: ['WS_MEMBERS'] },
  { path: 'ws-adjacent.ts',               allowedAreas: ['WS_CONTEXT'] },
  { path: 'rename-api.ts',                 allowedAreas: ['RENAME'] },
  { path: 'settings-store.ts',             allowedAreas: ['SETTINGS'] },
  { path: 'settings-modal.ts',             allowedAreas: ['SETTINGS'] },
  { path: 'ui/template-renderer.ts',       allowedAreas: ['UI'] },
  { path: 'ui/task-splitter-prompt.ts',    allowedAreas: ['SPLITTER'] },
  { path: 'ui/projects-modal.ts',          allowedAreas: ['UI', 'SDK'] },
  { path: 'ui/section-open-tabs.ts',       allowedAreas: ['UI'] },
  { path: 'ui/prompt-import-modal.ts',     allowedAreas: ['PROMPT_IO'] },
  { path: 'queue-control/task-queue.ts',   allowedAreas: ['QUEUE'] },
  { path: 'loop-cycle-fallback.ts',        allowedAreas: ['LOOP'] },
  { path: 'gitsync/progress-probe.ts',     allowedAreas: ['GITSYNC'] },
  { path: 'pro-zero/pro-zero-sdk-adapter.ts', allowedAreas: ['PROZERO'] },
  { path: 'ui/prompt-io-sqlite-reader.ts', allowedAreas: ['PROMPT_IO'] },
  { path: 'ui/prompt-io-zip-reader.ts',    allowedAreas: ['PROMPT_IO'] },
  { path: 'ui/prompt-io-format-detect.ts', allowedAreas: ['PROMPT_IO'] },
  { path: 'ui/prompt-import-audit.ts',     allowedAreas: ['PROMPT_IO'] },
  { path: 'async-utils.ts',                allowedAreas: ['ASYNC'] },
  { path: 'types/prompt-role.ts',          allowedAreas: ['TYPE'] },


];

/**
 * Codes that are registered but intentionally have no live emitter yet.
 * These were seeded as "one representative code per area" scaffolds when
 * the registry was first bootstrapped (see error-codes.ts lines 55-62).
 * They stay registered so the area contract is documented and the numeric
 * range for each area starts at E001 as expected.
 *
 * If a scaffold becomes wired up: remove it from this list (the test will
 * then require a live emitter). If a new orphan appears without being
 * listed here, the test will fail — that is the point.
 */
const INTENTIONALLY_UNEMITTED: ReadonlySet<string> = new Set([
  'PROMPT_EDIT_E001',   // superseded at throw sites by PROMPT_EDIT_E002..E007; kept as PROMPT area anchor.
  'HTTP_REQUEST_E001',  // area anchor for HTTP; migration lands in Plan 27.
  // SDK_NOT_READY_E001 graduated in Plan 27 step 9 (projects-modal.ts).
  'DB_WRITE_E001',      // generic DB.WRITE anchor; concrete emitters are DB_WRITE_E002..E004 + DB_MACRO_WRITE_E001.
  // Plan 27 step 3 reservations — graduate as steps 5..13 migrate each file.
  // CREDIT_ASSERT_E001 graduated in Plan 27 step 5 (credit-api.ts).
  // REMIX_* graduated in Plan 27 step 6 (remix-fetch/bulk/name-resolver).
  // WS_MEMBERS_* + WS_CONTEXT_ADJACENT_* graduated in Plan 27 step 7 (ws-members-fetch/mutations, ws-adjacent).
  // RENAME_* + SETTINGS_* graduated in Plan 27 step 8 (rename-api, settings-store, settings-modal).
  // UI_* + SPLITTER_* + PROMPT_IO_ENVELOPE_E001 graduated in Plan 27 step 9 (template-renderer, task-splitter-prompt, projects-modal, section-open-tabs, prompt-import-modal).
  // PROMPT_IO_AUDIT_* + PROMPT_IO_FORMAT_* + PROMPT_IO_SQLITE_E001..E004 + PROMPT_IO_ZIP_* graduated in Plan 27 step 12 (prompt-io-sqlite-reader, prompt-io-zip-reader, prompt-io-format-detect, prompt-import-audit).
  'PROMPT_IO_SQLITE_E005', // SQLITE_INIT (sql.js init failure) — anchor kept for future wiring in the reader open path.
  // QUEUE_INVARIANT_E001 graduated in Plan 27 step 10 (queue-control/task-queue.ts).
  // LOOP_FALLBACK_SDK_E001 + LOOP_FALLBACK_HTTP_E001 graduated in Plan 27 step 10 (loop-cycle-fallback.ts).
  // GITSYNC_PROBE_E001..E003 graduated in Plan 27 step 11 (gitsync/progress-probe.ts).
  // PROZERO_ADAPTER_E001 graduated in Plan 27 step 11 (pro-zero/pro-zero-sdk-adapter.ts).
  // ASYNC_RETRY_E001 + TYPE_EXHAUSTIVE_E001 graduated in Plan 27 step 13 (async-utils.ts, types/prompt-role.ts).
]);

function readMigrated(relativePath: string): string {
  return readFileSync(resolve(SRC_ROOT, relativePath), 'utf8');
}

function extractCodes(source: string): readonly string[] {
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  CODE_PATTERN.lastIndex = 0;
  while ((match = CODE_PATTERN.exec(source)) !== null) {
    if (match[1]) seen.add(match[1]);
  }
  return [...seen];
}

// ────────────────────────────────────────────────────────────────────────
// A. Every referenced code exists in the registry.
// ────────────────────────────────────────────────────────────────────────
describe('per-area migration — referenced codes exist in registry', () => {
  it.each(MIGRATED_MODULES)('$path references only registered codes', ({ path }) => {
    const codes = extractCodes(readMigrated(path));
    for (const code of codes) {
      expect(
        code in ERROR_CODES,
        `${path} references ${code} but the code is not registered in ERROR_CODES`,
      ).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// B. Every referenced code belongs to the module's allowed-area set.
// ────────────────────────────────────────────────────────────────────────
describe('per-area migration — referenced codes stay in-area', () => {
  it.each(MIGRATED_MODULES)('$path only emits codes from its allowed areas', ({ path, allowedAreas }) => {
    const codes = extractCodes(readMigrated(path));
    const allowed = new Set<ErrorArea>(allowedAreas);
    for (const code of codes) {
      const entry = ERROR_CODES[code];
      if (!entry) continue; // covered by suite A
      expect(
        allowed.has(entry.area),
        `${path} emits ${code} whose area="${entry.area}" is not in allowedAreas=[${allowedAreas.join(', ')}]`,
      ).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// C. Every registered code has a live emitter, or is explicitly allowlisted.
// ────────────────────────────────────────────────────────────────────────
describe('per-area migration — no orphan registry entries', () => {
  const emittedUnion = new Set<string>();
  for (const { path } of MIGRATED_MODULES) {
    for (const code of extractCodes(readMigrated(path))) {
      emittedUnion.add(code);
    }
  }

  const registeredCodes = Object.keys(ERROR_CODES);

  it.each(registeredCodes)('%s has a live emitter or is intentionally unemitted', (code) => {
    if (INTENTIONALLY_UNEMITTED.has(code)) return;
    expect(
      emittedUnion.has(code),
      `Registered code ${code} has no live emitter across MIGRATED_MODULES. ` +
      'Either wire it up at a throw site, or add it to INTENTIONALLY_UNEMITTED with a reason.',
    ).toBe(true);
  });

  it('every INTENTIONALLY_UNEMITTED code is actually registered', () => {
    for (const code of INTENTIONALLY_UNEMITTED) {
      expect(code in ERROR_CODES, `${code} is allowlisted as unemitted but not in ERROR_CODES`).toBe(true);
    }
  });

  it('INTENTIONALLY_UNEMITTED codes are truly unemitted (allowlist stays honest)', () => {
    for (const code of INTENTIONALLY_UNEMITTED) {
      expect(
        emittedUnion.has(code),
        `${code} is on INTENTIONALLY_UNEMITTED but IS emitted somewhere — remove it from the allowlist.`,
      ).toBe(false);
    }
  });
});

/**
 * Shared Prompt Editor entry point (Plan-23, step 4).
 *
 * Single reusable wrapper around `openPromptCreationModal` so every surface
 * that lets the user edit or add a prompt (Plan chip gear, Next chip gear,
 * Library modal row edit, Chatbox Save-Prompt button) opens the SAME editor.
 *
 * See: spec/33-missing-coding-guideline/prompt-editor-reuse.md
 *
 * Root cause the wrapper prevents:
 *   Before this file existed, editing was only reachable from the Library
 *   modal. The Plan and Next chips had no per-chip editor entry point, so
 *   users had to hunt through the modal (issue 04). By centralizing the
 *   contract here, each chip becomes a 3-line wire-up instead of a fork.
 */

import type { PromptRole } from '../types/prompt-role';
import type { EditablePrompt } from './prompt-loader';
import { getRevalidateContext } from './prompt-loader';
import { openPromptCreationModal } from './prompt-injection';
import { getDefaultPromptForRole, getPromptBySlug, listPromptsByRole, upsertPrompt, setDefaultPromptForRole } from '../db/prompt-db';
import type { PromptRow } from '../db/prompt-db';
import { extractParamTokens } from '../db/prompt-token-guard';
import { getRequiredTokensForRole, seedPlanNextPrompts } from '../seed/seed-plan-next';
import { PLAN_NEXT_SEED_ROWS } from '../seed/plan-next-prompts';
import { logDiagnosticFromCode } from '../error-utils';
import type { DiagnosticContext } from '../errors/diagnostic-error';
import { showToast } from '../toast';
import { recordPromptEditE005 } from '../telemetry/prompt-edit-e005-store';

/**
 * Plan 26 step 8: helper that emits a coded diagnostic toast for prompt-editor
 * failures. Keeps the friendly user sentence, appends `[code=X]` so users can
 * copy it into bug reports, and routes the full context object to the SDK
 * logger via `logDiagnosticFromCode` so the diagnostics ZIP indexes it.
 */
function reportEditorFailure(
  code: string,
  context: DiagnosticContext,
  userSentence: string,
  cause?: unknown,
): void {
  logDiagnosticFromCode(code, context, cause);
  if (code === 'PROMPT_EDIT_E005') {
    const role = (context['role'] as PromptRole | undefined) ?? 'generic';
    recordPromptEditE005(role, context, cause);
  }
  showToast(userSentence + '  [code=' + code + ']', 'error');
}

/**
 * Build a diagnostic snapshot for the default prompt of `role`. Used to
 * enrich PROMPT_EDIT_E005 payloads so the server-side log shows the
 * resolved slug, the role that currently owns that slug (if any), and
 * how many rows exist in the target role. Never throws: every DB error
 * is captured as a string field so a failed probe still produces useful
 * context instead of masking the primary failure.
 */
interface RoleSnapshot {
  role: string;
  resolvedSlug: string;
  seedRowKnown: string;
  roleListOk?: string;
  roleListCount?: string;
  roleDefaultIds?: string;
  roleListError?: string;
  roleListThrew?: string;
  slugLookupOk?: string;
  slugLookupError?: string;
  slugLookupThrew?: string;
  slugOwnerRole?: string;
  slugOwnerId?: string;
  slugOwnerIsDefault?: string;
  orphanRoleMismatch?: string;
}

async function collectRoleList(role: PromptRole, snapshot: RoleSnapshot): Promise<void> {
  try {
    const listed = await listPromptsByRole(role);
    snapshot.roleListOk = String(listed.ok);
    if (listed.ok && listed.value) {
      snapshot.roleListCount = String(listed.value.length);
      snapshot.roleDefaultIds = listed.value
        .filter((r: PromptRow) => r.IsDefault === 1)
        .map((r: PromptRow) => String(r.Id))
        .join(',') || '(none)';
      return;
    }
    snapshot.roleListError = listed.ok ? '(empty)' : (listed.error ?? 'unknown');
  } catch (err) {
    snapshot.roleListThrew = err instanceof Error ? err.message : String(err);
  }
}

function recordSlugOwner(
  bySlug: { ok: true; value: PromptRow | null } | { ok: false; error?: string },
  role: PromptRole,
  snapshot: RoleSnapshot,
): void {
  snapshot.slugLookupOk = String(bySlug.ok);
  if (bySlug.ok && bySlug.value) {
    snapshot.slugOwnerRole = bySlug.value.Role ?? '(null)';
    snapshot.slugOwnerId = String(bySlug.value.Id);
    snapshot.slugOwnerIsDefault = String(bySlug.value.IsDefault);
    snapshot.orphanRoleMismatch = String(bySlug.value.Role !== role);
    return;
  }
  snapshot.slugOwnerRole = '(no-row)';
  if (!bySlug.ok) snapshot.slugLookupError = bySlug.error ?? 'unknown';
}

async function collectSlugOwner(
  slug: string,
  role: PromptRole,
  snapshot: RoleSnapshot,
): Promise<void> {
  try {
    const bySlug = await getPromptBySlug(slug);
    recordSlugOwner(bySlug as Parameters<typeof recordSlugOwner>[0], role, snapshot);
  } catch (err) {
    snapshot.slugLookupThrew = err instanceof Error ? err.message : String(err);
  }
}

async function buildRoleDiagnosticSnapshot(role: PromptRole): Promise<DiagnosticContext> {
  const seedRow = PLAN_NEXT_SEED_ROWS.find((r) => r.role === role && r.isDefault);
  const snapshot: RoleSnapshot = {
    role,
    resolvedSlug: seedRow?.slug ?? '(no-seed-row)',
    seedRowKnown: String(Boolean(seedRow)),
  };
  await collectRoleList(role, snapshot);
  if (seedRow) await collectSlugOwner(seedRow.slug, role, snapshot);
  return snapshot as unknown as DiagnosticContext;
}


import { emitPromptSeedEvent } from '../telemetry/prompt-seed-telemetry';

export interface OpenPromptEditorInput {
  /** Role scope. Determines defaults, drift-guard requirements, and where the row lands. */
  role: PromptRole;
  /**
   * DB row id to edit. Omit to open the editor in "add new" mode (blank form
   * seeded with the role's default `ReplaceKey`).
   */
  promptId?: number;
  /** Optional prefill when adding a new prompt (used by the chatbox Save button). */
  prefill?: { name?: string; text?: string; category?: string; tags?: string[] };
}

/**
 * Open the shared prompt editor. Never throws: every failure is logged via
 * `logError('PromptEditor', ...)` and surfaced as a toast so the user is
 * never left with a silent no-op click (guideline 33).
 */
export async function openPromptEditor(input: OpenPromptEditorInput): Promise<void> {
  const rc = getRevalidateContext();
  if (!rc) {
    reportEditorFailure(
      'PROMPT_EDIT_E002',
      { role: input.role, action: input.promptId !== undefined ? 'edit' : 'add' },
      '❌ Prompt editor unavailable. Open the Prompts dropdown once, then retry',
    );
    return;
  }

  try {
    const editPrompt = input.promptId !== undefined
      ? await loadEditablePrompt(input.role, input.promptId)
      : null;
    const requiredTokens = await resolveRequiredTokensForRole(input.role);
    const roleLabel = input.role === 'plan' ? 'Plan' : input.role === 'next' ? 'Next' : 'Generic';
    // Add-new mode (no promptId, no explicit prefill): seed the editor with
    // the canonical role default body so the user starts from a working
    // template that already contains the required {{n}} token, instead of a
    // blank textarea that fails Rule-0 / token drift on save.
    const prefill = input.promptId === undefined
      ? (input.prefill ?? buildAddNewTemplatePrefill(input.role))
      : input.prefill;
    const templatePreview = input.promptId === undefined
      ? buildTemplatePreviewForRole(input.role)
      : undefined;
    const modalOptions: Parameters<typeof openPromptCreationModal>[4] = { requiredTokens, roleLabel, role: input.role };
    if (templatePreview) modalOptions.templatePreview = templatePreview;
    openPromptCreationModal(rc.ctx, rc.taskNextDeps, editPrompt, prefill, modalOptions);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    reportEditorFailure(
      'PROMPT_EDIT_E003',
      { role: input.role, action: input.promptId !== undefined ? 'edit' : 'add', reason },
      '❌ Prompt editor failed to open',
      err,
    );
  }
}

function buildAddNewTemplatePrefill(role: PromptRole): OpenPromptEditorInput['prefill'] | undefined {
  if (role !== 'plan' && role !== 'next') return undefined;
  const seed = PLAN_NEXT_SEED_ROWS.find((r) => r.role === role && r.isDefault);
  if (!seed) return undefined;
  const roleLabel = role === 'plan' ? 'Plan' : 'Next';
  return {
    name: 'New ' + roleLabel + ' prompt',
    text: seed.body,
    category: role,
    tags: [],
  };
}

function buildTemplatePreviewForRole(role: PromptRole): { body: string; slug?: string } | undefined {
  if (role !== 'plan' && role !== 'next') return undefined;
  const seed = PLAN_NEXT_SEED_ROWS.find((r) => r.role === role && r.isDefault);
  if (!seed) return undefined;
  return { body: seed.body, slug: seed.slug };
}

/**
 * Plan-23 step 5 (rewired for remaining-item #3): derive the tokens the
 * drift-guard MUST preserve for a role. Baseline is the single source of
 * truth `getRequiredTokensForRole(role)` in `seed-plan-next.ts`; we then
 * merge any additional `{{…}}` tokens found in the CURRENT DB default body
 * so user-authored additions inherit the same protection automatically.
 */
async function resolveRequiredTokensForRole(role: PromptRole): Promise<string[]> {
  const tokens = new Set<string>(getRequiredTokensForRole(role));
  if (role === 'generic') return Array.from(tokens);
  try {
    const result = await getDefaultPromptForRole(role);
    if (result?.ok && result.value && typeof result.value.Body === 'string') {
      for (const t of extractParamTokens(result.value.Body)) tokens.add(t);
    }
  } catch (err) {
    const snap = await buildRoleDiagnosticSnapshot(role);
    const context: DiagnosticContext = {
      ...snap,
      site: 'resolveRequiredTokensForRole',
      reason: 'resolveRequiredTokensForRole soft-fail: ' + (err instanceof Error ? err.message : String(err)),
    };
    logDiagnosticFromCode('PROMPT_EDIT_E005', context, err);
    recordPromptEditE005(role, context, err);
  }
  return Array.from(tokens);
}

async function runPreflightSeed(role: PromptRole): Promise<void> {
  emitPromptSeedEvent({ event: 'editor.prefill.reseed', role, outcome: 'ok', detail: 'preflight' });
  const seed = await seedPlanNextPrompts();
  if (!seed.ok) {
    logDiagnosticFromCode('SEED_INSERT_E002', { role, reason: seed.error ?? 'seed failed' });
    emitPromptSeedEvent({ event: 'editor.prefill.reseed', role, outcome: 'failed', detail: seed.error ?? 'seed failed' });
  }
}


async function selfHealMissingDefault(
  role: PromptRole,
  seedRow: { slug: string; name: string; body: string },
): Promise<number | null> {
  const existingSlugId = await repairExistingSeedSlugBeforeInsert(role, seedRow);
  if (existingSlugId !== null) return existingSlugId;
  const inserted = await tryInsertAndPromoteSeed(role, seedRow);
  if (inserted !== null) {
    emitPromptSeedEvent({
      event: 'editor.prefill.direct-insert', role, slug: seedRow.slug,
      outcome: 'ok', metrics: { promptId: inserted },
    });
    return inserted;
  } else {
    emitPromptSeedEvent({
      event: 'editor.prefill.direct-insert-failed', role, slug: seedRow.slug,
      outcome: 'failed', detail: 'upsert returned null',
    });
  }
  return tryPromoteExistingSeedRow(role, seedRow);
}

async function repairExistingSeedSlugBeforeInsert(
  role: PromptRole,
  seedRow: { slug: string; name: string; body: string },
): Promise<number | null> {
  const lookup = await getPromptBySlug(seedRow.slug);
  if (!lookup.ok || !lookup.value) return null;
  if (lookup.value.Role === role) {
    return promoteExistingPromptId(role, seedRow, lookup.value.Id, 'promoted-existing-slug');
  }
  const adopted = await adoptSeedSlugRole(role, seedRow, lookup.value);
  if (adopted === null) return null;
  return promoteExistingPromptId(role, seedRow, adopted, 'adopted-existing-slug');
}

async function openWithDriftCheck(
  role: PromptRole,
  dbRow: { Id: number; Slug: string; Name: string; Body: string },
): Promise<void> {
  const editable = await loadEditablePrompt(role, dbRow.Id);
  const bodyMatches = editable !== null && editable.text === dbRow.Body;
  const nameMatches = editable !== null && editable.name === dbRow.Name;
  const isClean = bodyMatches && nameMatches;
  emitPromptSeedEvent({
    event: isClean ? 'editor.prefill.db-hit' : 'editor.prefill.drift',
    role, slug: dbRow.Slug, outcome: isClean ? 'ok' : 'failed',
    detail: isClean ? 'confirmed' : ('drift body=' + String(bodyMatches) + ' name=' + String(nameMatches)),
    metrics: { promptId: dbRow.Id },
  });
  if (!isClean) {
    logDiagnosticFromCode('PROMPT_EDIT_E004', {
      role, slug: dbRow.Slug, promptId: dbRow.Id,
      bodyMatches: String(bodyMatches), nameMatches: String(nameMatches),
    });
  }
  await openPromptEditor({ role, promptId: dbRow.Id });
}

async function openStaticFallback(
  role: PromptRole,
  seedRow: { slug: string; name: string; body: string },
  detail: string,
): Promise<void> {
  emitPromptSeedEvent({
    event: 'editor.prefill.static-fallback', role, slug: seedRow.slug,
    outcome: 'skipped', detail,
  });
  const snap = await buildRoleDiagnosticSnapshot(role);
  reportEditorFailure(
    'PROMPT_EDIT_E005',
    { ...snap, site: 'openStaticFallback', reason: 'default prompt repair failed: ' + detail },
    '❌ Default prompt repair failed. Use More > Re-seed defaults, then edit again.',
  );
}

async function handleOpenDefaultError(
  role: PromptRole,
  seedRow: { slug: string; name: string; body: string } | undefined,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  if (seedRow) {
    emitPromptSeedEvent({
      event: 'editor.prefill.static-fallback', role, slug: seedRow.slug,
      outcome: 'skipped', detail: 'threw:' + message,
    });
    const snap = await buildRoleDiagnosticSnapshot(role);
    reportEditorFailure(
      'PROMPT_EDIT_E005',
      { ...snap, site: 'handleOpenDefaultError', reason: 'openDefaultPromptEditor threw: ' + message },
      '❌ Default prompt lookup failed. Use More > Re-seed defaults, then edit again.',
      err,
    );
    return;
  }
  emitPromptSeedEvent({ event: 'editor.prefill.missing', role, outcome: 'failed', detail: message });
  reportEditorFailure(
    'PROMPT_EDIT_E006',
    { role },
    '❌ No default prompt row exists for ' + role + '. Add one via the gear menu.',
    err,
  );
}

/**
 * Open the editor pre-loaded with the default row for `role`. Convenience
 * entry used by the Plan / Next chip "Edit default" gear items so the caller
 * does not have to look up the default id first.
 */
export async function openDefaultPromptEditor(role: PromptRole): Promise<void> {
  const seedRow = PLAN_NEXT_SEED_ROWS.find((r) => r.role === role && r.isDefault);
  try {
    await runPreflightSeed(role);
    let result = await getDefaultPromptForRole(role);
    if (result.ok && !result.value && seedRow) {
      const repairedId = await selfHealMissingDefault(role, seedRow);
      result = await getDefaultPromptForRole(role);
      if (result.ok && !result.value && repairedId !== null) {
        await openPromptEditor({ role, promptId: repairedId });
        return;
      }
    }
    if (result.ok && result.value) {
      await openWithDriftCheck(role, result.value);
      return;
    }
    if (seedRow) {
      const detail = result.ok ? 'still missing' : (result.error ?? 'query failed');
      await openStaticFallback(role, seedRow, detail);
      return;
    }
    emitPromptSeedEvent({ event: 'editor.prefill.missing', role, outcome: 'failed', detail: 'no-seed-row' });
    reportEditorFailure(
      'PROMPT_EDIT_E006',
      { role },
      '❌ No default prompt found for ' + role,
    );
  } catch (err) {
    await handleOpenDefaultError(role, seedRow, err);
  }
}


/**
 * Directly insert `seedRow` for `role` and promote it to `IsDefault=1`.
 * Returns the new row id on success, or `null` if the write fails. Used by
 * `openDefaultPromptEditor` as the primary self-heal path so the editor
 * always opens on a real DB row that `saveRoleScopedPrompt` can UPDATE
 * (rather than a prefill that inserts a duplicate non-default row).
 */
async function tryInsertAndPromoteSeed(
  role: PromptRole,
  seedRow: { slug: string; name: string; body: string },
): Promise<number | null> {
  try {
    const inserted = await upsertPrompt({
      slug: seedRow.slug,
      name: seedRow.name,
      body: seedRow.body,
      role,
    });
    if (!inserted.ok || typeof inserted.value !== 'number' || inserted.value <= 0) {
      const reason = inserted.ok ? 'no id returned' : (inserted.error ?? 'upsert failed');
      logDiagnosticFromCode('DB_WRITE_E002', { role, slug: seedRow.slug, reason });
      return null;
    }
    const promoted = await setDefaultPromptForRole(inserted.value, role);
    if (!promoted.ok) {
      logDiagnosticFromCode('DB_WRITE_E003', {
        role, promptId: inserted.value, reason: promoted.error ?? 'setDefault failed',
      });
      // Row exists but is not flagged default. Still safe to edit by id;
      // caller can retry promotion later. Return the id so the user can save.
    }
    return inserted.value;
  } catch (err) {
    logDiagnosticFromCode('DB_WRITE_E002', {
      role, slug: seedRow.slug,
      reason: 'tryInsertAndPromoteSeed threw: ' + (err instanceof Error ? err.message : String(err)),
    }, err);
    return null;
  }
}

async function tryPromoteExistingSeedRow(
  role: PromptRole,
  seedRow: { slug: string; name: string; body: string },
): Promise<number | null> {
  const roleRow = await findSeedRowInRole(role, seedRow.slug);
  if (roleRow) {
    return promoteExistingPromptId(role, seedRow, roleRow.Id, 'promoted-existing');
  }
  return tryAdoptSeedSlugRow(role, seedRow);
}

async function findSeedRowInRole(role: PromptRole, slug: string): Promise<PromptRow | null> {
  const listed = await listPromptsByRole(role);
  if (!listed.ok || !listed.value) {
    logDiagnosticFromCode('DB_READ_E001', { role, reason: listed.error ?? 'list failed' });
    return null;
  }
  return listed.value.find((item: PromptRow) => item.Slug === slug) ?? null;
}

async function promoteExistingPromptId(
  role: PromptRole,
  seedRow: { slug: string; name: string; body: string },
  promptId: number,
  detail: string,
): Promise<number> {
  const promoted = await setDefaultPromptForRole(promptId, role);
  if (!promoted.ok) {
    logDiagnosticFromCode('DB_WRITE_E003', {
      role, promptId, reason: promoted.error ?? 'setDefault failed',
    });
  }
  emitPromptSeedEvent({
    event: 'editor.prefill.direct-insert', role, slug: seedRow.slug,
    outcome: promoted.ok ? 'ok' : 'failed', metrics: { promptId },
    detail: promoted.ok ? detail : (promoted.error ?? 'setDefault failed'),
  });
  return promptId;
}

async function tryAdoptSeedSlugRow(
  role: PromptRole,
  seedRow: { slug: string; name: string; body: string },
): Promise<number | null> {
  const lookup = await getPromptBySlug(seedRow.slug);
  if (!lookup.ok) {
    logDiagnosticFromCode('DB_READ_E001', { role, slug: seedRow.slug, reason: lookup.error ?? 'slug lookup failed' });
  }
  if (!lookup.ok || !lookup.value) {
    return null;
  }
  const adopted = await adoptSeedSlugRole(role, seedRow, lookup.value);
  if (adopted === null) {
    return null;
  }
  return promoteExistingPromptId(role, seedRow, adopted, 'adopted-existing-slug');
}

async function adoptSeedSlugRole(
  role: PromptRole,
  seedRow: { slug: string; name: string; body: string },
  row: PromptRow,
): Promise<number | null> {
  const saved = await upsertPrompt({
    id: row.Id, slug: seedRow.slug, name: row.Name || seedRow.name,
    body: row.Body || seedRow.body, role, previousBody: row.Body,
    previousReplaceKey: row.ReplaceKey, replaceKey: row.ReplaceKey,
    replaceValues: row.ReplaceValues,
  });
  if (saved.ok && typeof saved.value === 'number') {
    return saved.value;
  }
  logDiagnosticFromCode('DB_WRITE_E002', { role, slug: seedRow.slug, reason: saved.error ?? 'adopt slug failed' });
  return null;
}

async function loadEditablePrompt(role: PromptRole, id: number): Promise<EditablePrompt | null> {
  const listed = await listPromptsByRole(role);
  if (!listed.ok || !listed.value) {
    logDiagnosticFromCode('DB_READ_E001', { role, reason: listed.error ?? 'list failed' });
    return null;
  }
  const row = listed.value.find((r: PromptRow) => r.Id === id);
  if (!row) {
    logDiagnosticFromCode('PROMPT_EDIT_E007', { role, promptId: id });
    return null;
  }
  return {
    id: String(row.Id),
    slug: row.Slug,
    name: row.Name,
    text: row.Body,
    role: row.Role,
    replaceKey: row.ReplaceKey,
    replaceValues: row.ReplaceValues,
  };
}

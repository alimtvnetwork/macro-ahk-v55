/**
 * Prompt Injection — Prompt creation/edit modal, paste-into-editor logic
 *
 * Phase 5D split from ui/prompt-manager.ts.
 * See: spec/04-macro-controller/ts-migration-v2/05-module-splitting.md
 */
import { CssFragment } from '../types';
import { log } from '../logger';
import { logDiagnosticFromCode } from '../error-utils';
import { cPanelBg, cPanelBgAlt, cPanelFg, cPanelFgDim, cPrimary, cPrimaryLight, cPrimaryBorderA } from '../shared-state';
import { getByXPath } from '../xpath-utils';
import { pasteIntoEditor, showPasteToast, showUndoToast } from './prompt-utils';
import type { TaskNextDeps } from './task-next-ui';
import type { EditablePrompt, PromptContext } from './prompt-loader';
import { getPromptsConfig, sendToExtension, clearLoadedPrompts, invalidatePromptCache, forceLoadFromDb, rerenderPromptsDropdown } from './prompt-loader';
import { extractParamTokens } from '../db/prompt-token-guard';
import type { PromptRole } from '../types/prompt-role';
import { upsertPrompt } from '../db/prompt-db';
import { validateRuleZero } from '../db/rule-zero-validator';
import { downloadAiGuideline } from './prompt-ai-guideline';
import { ensurePromptModalTheme } from './prompt-modal-theme';
import { getSeedBodyForSlug } from '../seed/plan-next-prompts';
import { renderDiffPane } from './prompt-diff';

const CSS_BTN_HOVER_BG = '#2d3348';
const CSS_BTN_REST_BG = '#252a36';
const CSS_MODAL_SECONDARY_BTN_BASE = 'padding:8px 14px;background:';

/** Adapter: getByXPath returns Node|null, pasteIntoEditor needs Element|null */
function getByXPathAsElement(xpath: string): Element | null {
  const node = getByXPath(xpath);
  return node instanceof Element ? node : null;
}

// CQ16: Extracted from openPromptCreationModal closure
function getSelectedCategory(catSelect: HTMLSelectElement, catCustomInput: HTMLInputElement): string {
  if (catSelect.value === '__custom__') return catCustomInput.value.trim();
  return catSelect.value;
}

// CQ16: Extracted file handler context
interface FileHandlerRefs {
  contentArea: HTMLTextAreaElement;
  charCount: HTMLElement;
  titleInput: HTMLInputElement;
  dropZone: HTMLElement;
}

// CQ16: Extracted from openPromptCreationModal closure
function handleFile(file: File, refs: FileHandlerRefs): void {
  if (!file) return;
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  if (!['md', 'txt', 'prompt'].includes(ext)) { showPasteToast('❌ Unsupported file type: .' + ext, true); return; }
  if (file.size > 50 * 1024) { showPasteToast('❌ File too large (max 50KB)', true); return; }
  const reader = new FileReader();
  reader.onload = function(e: ProgressEvent<FileReader>) {
    const content = e.target?.result as string;
    refs.contentArea.value = content;
    refs.charCount.textContent = content.length + ' chars';
    if (!refs.titleInput.value.trim()) {
      refs.titleInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    }
    refs.dropZone.style.borderColor = '#16a34a';
    refs.dropZone.innerHTML = '✅ Loaded: <b>' + file.name + '</b> (' + content.length + ' chars)';
    setTimeout(function() { refs.dropZone.style.borderColor = CssFragment.BorderPrimary; }, 2000);
    log('File loaded into prompt editor: ' + file.name, 'success');
  };
  reader.readAsText(file);
}

// CQ16: Extracted from openPromptCreationModal closure
function onEscHandler(overlay: HTMLElement): (e: KeyboardEvent) => void {
  const handler = function(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handler);
    }
  };
  return handler;
}

/**
 * Options for `openPromptCreationModal`. Plan-23 step 5 adds
 * `requiredTokens` so the editor renders a visible chip strip of the
 * tokens that MUST remain in the body and disables Save while any of
 * them are missing (prevents runtime drift caught by `assertParamTokensUnchanged`).
 */
export interface PromptModalOptions {
  requiredTokens?: string[];
  roleLabel?: string;
  role?: PromptRole;
  /**
   * Read-only seeded template body to display above the editor in add-new
   * mode so the user can compare the canonical default against any edits
   * they make before saving. Only rendered when provided AND when the modal
   * is opened in add-new mode (no editPrompt).
   */
  templatePreview?: { body: string; slug?: string };
}

interface PromptSaveInput {
  name: string;
  text: string;
  category: string;
  tags: string[];
  excludeFromExport: boolean;
  isEdit: boolean;
  editPrompt: EditablePrompt | null;
  role?: PromptRole;
}

interface PromptSaveSuccess {
  isOk: true;
}

interface PromptSaveFailure {
  isOk: false;
  errorMessage: string;
  /**
   * Structured diagnostics so `handleSaveResponse` can render a specific,
   * actionable toast (which rule fired, which button was clicked, what to
   * fix next) instead of a generic "Save failed" message.
   */
  failure?: {
    rule: 'rule-zero' | 'token-drift' | 'upstream';
    code?: string;
    expectedN?: number | null;
    actualN?: number | null;
    missingTokens?: string[];
    fix?: string;
  };
}

type PromptSaveResult = PromptSaveSuccess | PromptSaveFailure;

/**
 * Build a multi-line, actionable error toast body for save-time rejections.
 * Renders as (in order): headline with the specific rule, the button the
 * user just clicked, the role scope, structured detail (declared vs actual
 * step count, or missing tokens), and the next required fix. Newlines are
 * preserved via `white-space:pre-line` on the toast text node.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- structured error formatter; branches map 1:1 to failure rules
function formatSaveErrorMessage(
  input: {
    role?: PromptRole | undefined;
    isEdit: boolean;
    fallbackMessage: string;
    failure?: PromptSaveFailure['failure'] | undefined;
  },
): string {
  const buttonLabel = input.isEdit ? '💾 Update' : '💾 Save';
  const roleLabel = input.role === 'plan' ? 'Plan'
    : input.role === 'next' ? 'Next'
    : input.role === 'generic' ? 'Generic' : 'prompt';
  const f = input.failure;
  if (f && f.rule === 'rule-zero') {
    const expected = f.expectedN ?? null;
    const actual = f.actualN ?? null;
    const detail = expected !== null && actual !== null
      ? 'declared Steps=' + expected + ', body has ' + actual + ' numbered step(s)'
      : (f.code ? 'code=' + f.code : input.fallbackMessage);
    const fix = f.fix ?? (expected !== null
      ? 'Write EXACTLY ' + expected + ' top-level numbered steps under a "Steps:" heading, then click ' + buttonLabel + ' again.'
      : 'Adjust the declared step count or the numbered steps so they match, then click ' + buttonLabel + ' again.');
    return '❌ Save blocked: Rule 0 (step count is law)\n'
      + 'Button: ' + buttonLabel + '   Role: ' + roleLabel + '\n'
      + 'Detail: ' + detail + '\n'
      + 'Fix: ' + fix;
  }
  if (f && f.rule === 'token-drift') {
    const tokens = (f.missingTokens ?? []).map(function(t) { return '{{' + t + '}}'; }).join(', ');
    const fix = f.fix ?? ('Paste ' + (tokens || 'the required token(s)') + ' back into the body, then click ' + buttonLabel + '.');
    return '❌ Save blocked: required token(s) missing\n'
      + 'Button: ' + buttonLabel + '   Role: ' + roleLabel + '\n'
      + 'Detail: ' + (tokens || 'missing tokens') + '\n'
      + 'Fix: ' + fix;
  }
  return '❌ ' + buttonLabel + ' failed (' + roleLabel + '): ' + input.fallbackMessage;
}

/**
 * Open the prompt creation/edit modal.
 * @param editPrompt — existing prompt object for editing (has .id)
 * @param prefillData — pre-fill data for new prompt (no .id, not edit mode)
 * @param options — required tokens + role label for the drift-guarded editor (Plan-23 step 5)
 */
export function openPromptCreationModal(
  _ctx: PromptContext,
  _taskNextDeps: TaskNextDeps,
  editPrompt: EditablePrompt | null,
  prefillData?: { name?: string; text?: string; category?: string; tags?: string[] },
  options?: PromptModalOptions,
): void {
  ensurePromptModalTheme();
  const existing = document.getElementById('marco-prompt-modal');
  if (existing) existing.remove();

  const isEdit = !!(editPrompt && editPrompt.id);
  const baseInitial = isEdit ? editPrompt : (prefillData || {});
  // Role governance (issue: category empty when editing Plan/Next chips).
  // For role-scoped prompts the role IS the category, so force the combo
  // to the role name and mark it as locked. The `_buildCategorySelect`
  // helper reads `__lockedCategory` to disable the picker and add the
  // option even when no other entry has surfaced that category yet.
  const initialData: Record<string, unknown> = { ...(baseInitial as Record<string, unknown>) };
  const roleForCategory = options?.role;
  if (roleForCategory === 'plan' || roleForCategory === 'next') {
    initialData.category = roleForCategory;
    initialData.__lockedCategory = roleForCategory;
  }
  const overlay = document.createElement('div');
  overlay.id = 'marco-prompt-modal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:1000010;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:' + cPanelBg + CssFragment.BorderSolid + cPrimary + ';border-radius:12px;width:520px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.8);';

  // Header
  const headerEl = document.createElement('div');
  headerEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(124,58,237,0.3);';
  const titleEl = document.createElement('span');
  const roleSuffix = options?.roleLabel ? ' — ' + options.roleLabel : '';
  titleEl.textContent = (isEdit ? '✏️ Edit Prompt' : '➕ Add New Prompt') + roleSuffix;
  titleEl.style.cssText = 'font-size:15px;font-weight:600;color:' + cPanelFg + ';';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;padding:0 4px;';
  closeBtn.onclick = function() { overlay.remove(); };
  headerEl.appendChild(titleEl);
  headerEl.appendChild(closeBtn);
  modal.appendChild(headerEl);

  // Template preview (add-new mode only, when a seeded body is provided)
  if (!isEdit && options?.templatePreview && options.templatePreview.body) {
    modal.appendChild(_buildTemplatePreview(options.templatePreview, options.roleLabel ?? 'Default'));
  }

  // Body
  const bodyResult = _buildPromptModalBody(initialData);
  modal.appendChild(bodyResult.body);

  // Footer
  const footer = _buildPromptModalFooter(isEdit, editPrompt, overlay, bodyResult, options);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.onclick = function(e: Event) { if (e.target === overlay) overlay.remove(); };
  document.addEventListener('keydown', onEscHandler(overlay));
  bodyResult.titleInput.focus();
}

// ── Template Preview (add-new mode) ──
function _buildTemplatePreview(preview: { body: string; slug?: string }, roleLabel: string): HTMLElement {
  const wrap = document.createElement('details');
  wrap.open = true;
  wrap.style.cssText = 'margin:12px 20px 0;border:1px dashed ' + cPrimaryBorderA + ';border-radius:8px;background:' + cPanelBgAlt + ';';

  const summary = document.createElement('summary');
  const slugSuffix = preview.slug ? ' · ' + preview.slug : '';
  summary.textContent = '📄 Seeded template preview — ' + roleLabel + slugSuffix + ' (read-only)';
  summary.style.cssText = 'cursor:pointer;padding:8px 12px;font-size:12px;font-weight:600;color:' + cPrimaryLight + ';user-select:none;';
  wrap.appendChild(summary);

  const hint = document.createElement('div');
  hint.textContent = 'This is the exact canonical body that will be inserted below. Edit the textarea to customize before saving.';
  hint.style.cssText = 'padding:0 12px 6px;font-size:11px;color:' + cPanelFgDim + ';';
  wrap.appendChild(hint);

  const pre = document.createElement('pre');
  pre.textContent = preview.body;
  pre.style.cssText = 'margin:0;padding:10px 12px 12px;max-height:180px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.45;color:' + cPanelFg + ';white-space:pre-wrap;word-break:break-word;';
  wrap.appendChild(pre);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:0 12px 10px;';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = '📋 Copy template';
  copyBtn.style.cssText = CSS_MODAL_SECONDARY_BTN_BASE + CSS_BTN_REST_BG + ';color:' + cPanelFg + ';border:1px solid ' + cPrimaryBorderA + ';border-radius:6px;font-size:11px;cursor:pointer;';
  copyBtn.onmouseenter = function() { copyBtn.style.background = CSS_BTN_HOVER_BG; };
  copyBtn.onmouseleave = function() { copyBtn.style.background = CSS_BTN_REST_BG; };
  copyBtn.onclick = function() {
    try {
      void navigator.clipboard.writeText(preview.body);
      const prev = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied';
      setTimeout(function() { copyBtn.textContent = prev; }, 1200);
    } catch (err) {
      log('Prompt template copy failed: ' + String(err));
    }
  };
  actions.appendChild(copyBtn);
  wrap.appendChild(actions);

  return wrap;
}

// ── Prompt Modal Body ──
interface PromptBodyResult {
  body: HTMLElement;
  titleInput: HTMLInputElement;
  contentArea: HTMLTextAreaElement;
  catSelect: HTMLSelectElement;
  catCustomInput: HTMLInputElement;
  tagsInput: HTMLInputElement;
  excludeFromExportInput: HTMLInputElement;
}

function _buildPromptModalBody(initialData: Record<string, unknown>): PromptBodyResult {
  const body = document.createElement('div');
  body.style.cssText = 'padding:16px 20px;overflow-y:auto;flex:1;';

  const { titleInput, contentArea, charCount } = _buildTitleAndContent(body, initialData);

  const catResult = _buildCategorySelect(initialData);
  body.appendChild(catResult.catWrap);

  const tagsResult = _buildTagsInput(initialData);
  body.appendChild(tagsResult.tagsWrap);

  _buildFileDropZone(body, contentArea, charCount, titleInput);
  _buildVariableReference(body);

  const exportToggle = _buildExcludeFromExportToggle(initialData);
  body.appendChild(exportToggle.wrap);

  return { body, titleInput, contentArea, catSelect: catResult.catSelect, catCustomInput: catResult.catCustomInput, tagsInput: tagsResult.tagsInput, excludeFromExportInput: exportToggle.input };
}

/**
 * v4.12.0 (Issue 64) — checkbox toggle that, when on, sets `excludeFromExport`
 * on the prompt so `exportPromptsToJson` skips it. Persists alongside the rest
 * of the prompt payload via SAVE_PROMPT (info.json is regenerated by the
 * standalone-scripts/prompts aggregator from this field).
 */
function _buildExcludeFromExportToggle(initialData: Record<string, unknown>): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:11px;color:' + cPrimaryLight + ';margin:4px 0 12px 0;cursor:pointer;user-select:none;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!initialData.excludeFromExport;
  input.style.cssText = 'accent-color:' + cPrimary + ';cursor:pointer;';
  const text = document.createElement('span');
  text.textContent = 'Exclude from JSON export';
  text.title = 'When enabled, this prompt is skipped by the 📥 IO → Export Prompts download.';
  wrap.appendChild(input);
  wrap.appendChild(text);
  return { wrap, input };
}

function _buildTitleAndContent(body: HTMLElement, initialData: Record<string, unknown>): { titleInput: HTMLInputElement; contentArea: HTMLTextAreaElement; charCount: HTMLElement } {
  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'Prompt Title';
  titleLabel.style.cssText = CssFragment.LabelBlock + cPrimaryLight + CssFragment.LabelSuffix;
  body.appendChild(titleLabel);
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.placeholder = 'e.g. Code Review Prompt';
  titleInput.value = (initialData.name as string) || '';
  titleInput.style.cssText = 'width:100%;padding:8px 12px;background:' + cPanelBg + CssFragment.BorderSolid + cPrimaryBorderA + CssFragment.BorderRadiusColor + cPanelFg + ';font-size:13px;margin-bottom:12px;outline:none;box-sizing:border-box;';
  titleInput.onfocus = function() { (this as HTMLElement).style.borderColor = cPrimary; };
  titleInput.onblur = function() { (this as HTMLElement).style.borderColor = CssFragment.BorderPrimaryStrong; };
  body.appendChild(titleInput);

  const contentLabel = document.createElement('label');
  contentLabel.textContent = 'Prompt Content (Markdown supported)';
  contentLabel.style.cssText = CssFragment.LabelBlock + cPrimaryLight + CssFragment.LabelSuffix;
  body.appendChild(contentLabel);
  const contentArea = document.createElement('textarea');
  contentArea.placeholder = 'Enter your prompt text here…\n\nSupports {{date}}, {{time}} variables.';
  contentArea.value = (initialData.text as string) || '';
  contentArea.style.cssText = 'width:100%;height:200px;padding:10px 12px;background:' + cPanelBg + CssFragment.BorderSolid + cPrimaryBorderA + CssFragment.BorderRadiusColor + cPanelFg + ';font-size:12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical;outline:none;box-sizing:border-box;line-height:1.5;';
  contentArea.onfocus = function() { (this as HTMLElement).style.borderColor = cPrimary; };
  contentArea.onblur = function() { (this as HTMLElement).style.borderColor = CssFragment.BorderPrimaryStrong; };
  body.appendChild(contentArea);

  const charCount = document.createElement('div');
  charCount.style.cssText = 'text-align:right;font-size:10px;color:' + cPanelFgDim + ';margin-top:2px;margin-bottom:8px;';
  charCount.textContent = '0 chars';
  contentArea.oninput = function() { charCount.textContent = contentArea.value.length + ' chars'; };
  if (initialData.text) charCount.textContent = contentArea.value.length + ' chars';
  body.appendChild(charCount);

  return { titleInput, contentArea, charCount };
}

function _buildFileDropZone(body: HTMLElement, contentArea: HTMLTextAreaElement, charCount: HTMLElement, titleInput: HTMLInputElement): void {
  const dropZone = document.createElement('div');
  dropZone.style.cssText = 'border:2px dashed ' + cPrimaryBorderA + ';border-radius:8px;padding:16px;text-align:center;color:' + cPanelFgDim + ';font-size:11px;margin-bottom:12px;transition:all .2s;cursor:pointer;';
  dropZone.innerHTML = '📁 Drop <b>.md</b>, <b>.txt</b>, or <b>.prompt</b> file here<br><span style="font-size:10px;color:#4b5563;">or click to browse</span>';
  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = '.md,.txt,.prompt'; fileInput.style.display = 'none';
  dropZone.onclick = function() { fileInput.click(); };
  const fileRefs: FileHandlerRefs = { contentArea, charCount, titleInput, dropZone };
  fileInput.onchange = function() { handleFile(fileInput.files![0], fileRefs); };
  dropZone.addEventListener('dragover', function(e: Event) { e.preventDefault(); e.stopPropagation(); (this as HTMLElement).style.borderColor = cPrimary; (this as HTMLElement).style.background = 'rgba(124,58,237,0.1)'; });
  dropZone.addEventListener('dragleave', function(e: Event) { e.preventDefault(); (this as HTMLElement).style.borderColor = CssFragment.BorderPrimary; (this as HTMLElement).style.background = 'transparent'; });
  dropZone.addEventListener('drop', function(e: DragEvent) {
    e.preventDefault(); e.stopPropagation();
    (this as HTMLElement).style.borderColor = CssFragment.BorderPrimary; (this as HTMLElement).style.background = 'transparent';
    if (e.dataTransfer && e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0], fileRefs);
  });
  body.appendChild(dropZone);
  body.appendChild(fileInput);
}

function _buildVariableReference(body: HTMLElement): void {
  const varToggle = document.createElement('div');
  varToggle.style.cssText = 'cursor:pointer;font-size:11px;color:' + cPrimaryLight + ';margin-bottom:4px;user-select:none;';
  varToggle.textContent = '▸ Template Variables';
  const varList = document.createElement('div');
  varList.style.cssText = 'display:none;padding:6px 10px;background:rgba(124,58,237,0.08);border-radius:6px;font-size:10px;color:#9ca3af;margin-bottom:12px;line-height:1.8;';
  varList.innerHTML = '<code style="color:#c4b5fd;">{{date}}</code> — current date<br><code style="color:#c4b5fd;">{{time}}</code> — current time<br><code style="color:#c4b5fd;">{{date:FORMAT}}</code> — e.g. dd-MMM-YYYY<br><code style="color:#c4b5fd;">{{time:FORMAT}}</code> — e.g. 12 hr clock';
  varToggle.onclick = function() {
    const isOpen = varList.style.display !== 'none';
    varList.style.display = isOpen ? 'none' : 'block';
    varToggle.textContent = (isOpen ? '▸' : '▾') + ' Template Variables';
  };
  body.appendChild(varToggle);
  body.appendChild(varList);
}

// ── Tags Input ──
function _buildTagsInput(initialData: Record<string, unknown>): { tagsWrap: HTMLElement; tagsInput: HTMLInputElement } {
  const tagsLabel = document.createElement('label');
  tagsLabel.textContent = 'Tags (comma separated)';
  tagsLabel.style.cssText = CssFragment.LabelBlock + cPrimaryLight + CssFragment.LabelSuffix;

  const tagsWrap = document.createElement('div');
  tagsWrap.style.cssText = 'margin-bottom:12px;';
  tagsWrap.appendChild(tagsLabel);

  const tagsInput = document.createElement('input');
  tagsInput.type = 'text';
  tagsInput.placeholder = 'e.g. ui, backend, logic';
  tagsInput.value = Array.isArray(initialData.tags) ? initialData.tags.join(', ') : '';
  tagsInput.style.cssText = 'width:100%;padding:8px 12px;background:' + cPanelBg + CssFragment.BorderSolid + cPrimaryBorderA + CssFragment.BorderRadiusColor + cPanelFg + ';font-size:13px;outline:none;box-sizing:border-box;';
  tagsInput.onfocus = function() { (this as HTMLElement).style.borderColor = cPrimary; };
  tagsInput.onblur = function() { (this as HTMLElement).style.borderColor = CssFragment.BorderPrimaryStrong; };
  
  tagsWrap.appendChild(tagsInput);
  return { tagsWrap, tagsInput };
}

// ── Category Select ──
 
function collectExistingCategories(): string[] {
  const promptsCfg = getPromptsConfig();
  const existingEntries = promptsCfg.entries || [];
  const existingCats: string[] = [];
  const catSeen: Record<string, boolean> = {};
  for (const entry of existingEntries) {
    const ec = (entry.category || '').trim();
    if (ec && !catSeen[ec.toLowerCase()]) { existingCats.push(ec); catSeen[ec.toLowerCase()] = true; }
  }
  return existingCats;
}

function _buildCategorySelect(initialData: Record<string, unknown>): { catWrap: HTMLElement; catSelect: HTMLSelectElement; catCustomInput: HTMLInputElement } {
  const catLabel = document.createElement('label');
  catLabel.textContent = 'Category (optional)';
  catLabel.style.cssText = CssFragment.LabelBlock + cPrimaryLight + CssFragment.LabelSuffix;

  const existingCats = collectExistingCategories();

  const catWrap = document.createElement('div');
  catWrap.style.cssText = 'position:relative;margin-bottom:12px;';
  catWrap.appendChild(catLabel);

  const catSelect = document.createElement('select');
  catSelect.style.cssText = 'width:100%;padding:8px 12px;background:' + cPanelBg + CssFragment.BorderSolid + cPrimaryBorderA + CssFragment.BorderRadiusColor + cPanelFg + ';font-size:13px;outline:none;box-sizing:border-box;appearance:auto;cursor:pointer;';
  catSelect.onfocus = function() { (this as HTMLElement).style.borderColor = cPrimary; };
  catSelect.onblur = function() { (this as HTMLElement).style.borderColor = CssFragment.BorderPrimaryStrong; };

  const noneOpt = document.createElement('option');
  noneOpt.value = ''; noneOpt.textContent = '— No category —';
  catSelect.appendChild(noneOpt);
  for (const cat of existingCats) {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    catSelect.appendChild(opt);
  }
  const customOpt = document.createElement('option');
  customOpt.value = '__custom__'; customOpt.textContent = '✏️ Custom category…';
  catSelect.appendChild(customOpt);

  const catCustomInput = document.createElement('input');
  catCustomInput.type = 'text';
  catCustomInput.placeholder = 'Type custom category name…';
  catCustomInput.style.cssText = 'display:none;width:100%;padding:8px 12px;background:' + cPanelBg + CssFragment.BorderSolid + cPrimaryBorderA + CssFragment.BorderRadiusColor + cPanelFg + ';font-size:13px;outline:none;box-sizing:border-box;margin-top:6px;';
  catCustomInput.onfocus = function() { (this as HTMLElement).style.borderColor = cPrimary; };
  catCustomInput.onblur = function() { (this as HTMLElement).style.borderColor = CssFragment.BorderPrimaryStrong; };

  catSelect.onchange = function() {
    catCustomInput.style.display = catSelect.value === '__custom__' ? 'block' : 'none';
    if (catSelect.value !== '__custom__') catCustomInput.value = '';
    if (catSelect.value === '__custom__') catCustomInput.focus();
  };

  const initialCat = ((initialData.category as string) || '').trim();
  const lockedCategory = ((initialData.__lockedCategory as string) || '').trim();
  if (initialCat) {
    const matchIdx = existingCats.findIndex(function(c) { return c.toLowerCase() === initialCat.toLowerCase(); });
    if (matchIdx !== -1) { catSelect.value = existingCats[matchIdx]; }
    else {
      // Ensure the initial category (e.g. locked 'plan'/'next' for role-scoped
      // prompts) is a real option even when no other prompt has surfaced it
      // yet. Without this the select would silently fall back to '— No
      // category —' and the user would see an empty combo when editing the
      // Plan/Next chip prompts.
      const injected = document.createElement('option');
      injected.value = initialCat; injected.textContent = initialCat;
      catSelect.insertBefore(injected, catSelect.lastChild);
      catSelect.value = initialCat;
    }
  }

  // Role governance: lock the picker to the role name for plan/next editors.
  // The role IS the category and is authoritative in the DB, so we prevent
  // accidental drift by disabling the select and the custom input.
  if (lockedCategory) {
    catSelect.disabled = true;
    catSelect.title = 'Category is locked to the role (' + lockedCategory + ') for role-scoped prompts.';
    catCustomInput.disabled = true;
    catLabel.textContent = 'Category (locked to ' + lockedCategory + ')';
  }

  catWrap.appendChild(catSelect);
  catWrap.appendChild(catCustomInput);
  return { catWrap, catSelect, catCustomInput };
}

function buildSlug(role: PromptRole, name: string, editPrompt: EditablePrompt | null): string {
  if (editPrompt && typeof editPrompt.slug === 'string' && editPrompt.slug.trim().length > 0) {
    return editPrompt.slug.trim();
  }
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return role + '-' + (base || 'prompt') + '-' + Date.now();
}

function parseDbPromptId(editPrompt: EditablePrompt | null): number | undefined {
  if (!editPrompt || typeof editPrompt.id !== 'string') return undefined;
  const id = Number(editPrompt.id);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function buildLegacyPromptPayload(input: PromptSaveInput): Record<string, unknown> {
  const promptPayload: Record<string, unknown> = { name: input.name, text: input.text, source: 'user' };
  if (input.category) promptPayload.category = input.category;
  if (input.tags.length > 0) promptPayload.tags = input.tags;
  if (input.isEdit && input.editPrompt && input.editPrompt.id) promptPayload.id = input.editPrompt.id;
  promptPayload.excludeFromExport = input.excludeFromExport;
  return promptPayload;
}

function saveGenericPrompt(input: PromptSaveInput): Promise<PromptSaveResult> {
  return sendToExtension('SAVE_PROMPT', { prompt: buildLegacyPromptPayload(input) }).then(function(resp: Record<string, unknown>) {
    if (resp && resp.isOk) return { isOk: true };
    return { isOk: false, errorMessage: (resp && resp.errorMessage as string) || 'Save failed, extension may not be connected' };
  });
}

export function saveRoleScopedPrompt(input: PromptSaveInput, role: PromptRole): Promise<PromptSaveResult> {
  // Rule-0 gate: for BOTH Plan and Next roles, block any save whose declared
  // step count (a literal integer in `Steps:`/`EXACTLY N steps`/`# N steps`)
  // does not match the number of top-level numbered steps in the body.
  // Template bodies still carrying `{{n}}` are exempt (deferred to inject-time).
  // See: standalone-scripts/macro-controller/src/db/rule-zero-validator.ts
  // Extended to `next` in v4.183.0 to close the asymmetric-validator gap.
  if (role === 'plan' || role === 'next') {
    const check = validateRuleZero(input.text);
    if (!check.ok) {
      const slug = buildSlug(role, input.name, input.editPrompt);
      logDiagnosticFromCode(
        'PROMPT_VALIDATE_E001',
        {
          role,
          slug,
          expected: check.expectedN ?? 'unknown',
          actual: check.actualN ?? 'unknown',
          ruleId: 'rule-zero:' + check.code,
        },
        new Error('rule-zero:' + check.code),
      );
      return Promise.resolve({
        isOk: false,
        errorMessage: check.reason,
        failure: {
          rule: 'rule-zero',
          code: check.code,
          expectedN: check.expectedN,
          actualN: check.actualN,
        },
      });
    }
  }

  const promptId = parseDbPromptId(input.editPrompt);
  return upsertPrompt({
    id: promptId,
    slug: buildSlug(role, input.name, input.editPrompt),
    name: input.name,
    body: input.text,
    role: role,
    previousBody: input.isEdit && input.editPrompt ? input.editPrompt.text : undefined,
    previousReplaceKey: input.editPrompt?.replaceKey,
    replaceKey: input.editPrompt?.replaceKey,
    replaceValues: input.editPrompt?.replaceValues,
  }).then(function(result) {
    if (result.ok) return { isOk: true };
    return {
      isOk: false,
      errorMessage: result.error ?? 'Role-scoped prompt save failed',
      failure: { rule: 'upstream' as const, code: 'upsert-failed' },
    };
  });
}

function savePromptFromEditor(input: PromptSaveInput): Promise<PromptSaveResult> {
  const role = input.role ?? input.editPrompt?.role;
  if (role === 'plan' || role === 'next') {
    return saveRoleScopedPrompt(input, role);
  }
  return saveGenericPrompt(input);
}

function refreshAfterPromptSave(): void {
  clearLoadedPrompts();
  invalidatePromptCache();
  forceLoadFromDb().then(function() {
    rerenderPromptsDropdown();
    // v4.402.0: notify any surface that renders role-scoped prompt lists
    // (Next inline chips, empty-state minus buttons, etc.) so they refresh
    // without a full page reload.
    void import('./prompts-changed-event').then(function(mod) {
      mod.dispatchPromptsChanged({ reason: 'editor-save' });
    }).catch(function() { /* best-effort — refresh already happened */ });
  });
}

// ── Prompt Modal Footer ──
 
// eslint-disable-next-line max-lines-per-function
function _buildPromptModalFooter(
  isEdit: boolean,
  editPrompt: EditablePrompt | null,
  overlay: HTMLElement,
  bodyResult: PromptBodyResult,
  options?: PromptModalOptions,
): HTMLElement {
  const { contentArea } = bodyResult;
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:12px 20px;border-top:1px solid rgba(124,58,237,0.3);';

  // Plan-23 step 5: required-tokens chip strip + live drift indicator.
  const requiredTokens = (options?.requiredTokens ?? []).filter((t): t is string => typeof t === 'string' && t.length > 0);
  const tokenStrip = _buildRequiredTokenStrip(requiredTokens);
  if (tokenStrip) footer.appendChild(tokenStrip.root);

  // v4.176.0 — Rule-0 live pre-save indicator. v4.189.0: extended to the Next
  // role. `prompt-injection.ts` already gates BOTH Plan AND Next saves via
  // `validateRuleZero` (see the `role === 'plan' || role === 'next'` branch
  // earlier in this file), but the pre-save UX was Plan-only. Users editing
  // Next-role bodies hit the same rejection at Save-time with no live warning,
  // creating the exact click-Save-then-rejected loop the Plan indicator was
  // designed to prevent. Mounting the indicator for both roles closes that gap.
  const showRuleZero = options?.role === 'plan' || options?.role === 'next';
  const ruleZeroIndicator = showRuleZero ? _buildRuleZeroIndicator() : null;
  if (ruleZeroIndicator) footer.appendChild(ruleZeroIndicator.root);


  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;';

  // Plan-23 step 6: Download AI guideline. Emits a role-scoped Markdown file
  // that lists the required tokens so an external AI editor can preserve the
  // drift-guard contract. Silent-fail impossible: helper toasts on error.
  const guidelineBtn = document.createElement('button');
  guidelineBtn.textContent = '📥 AI guideline';
  guidelineBtn.title = 'Download a Markdown guideline listing tokens the AI must preserve when editing this prompt.';
  guidelineBtn.style.cssText = CSS_MODAL_SECONDARY_BTN_BASE + cPanelBgAlt + CssFragment.BorderSolid + cPrimaryBorderA + ';border-radius:6px;color:#c4b5fd;font-size:12px;cursor:pointer;margin-right:auto;';
  guidelineBtn.onmouseover = function() { (this as HTMLElement).style.background = CSS_BTN_HOVER_BG; };
  guidelineBtn.onmouseout = function() { (this as HTMLElement).style.background = CSS_BTN_REST_BG; };
  guidelineBtn.onclick = function() {
    const guidelineSlug = (isEdit && editPrompt && typeof editPrompt.slug === 'string') ? editPrompt.slug : null;
    const guidelineSeedBody = guidelineSlug ? getSeedBodyForSlug(guidelineSlug) : null;
    const guidelineArg: Parameters<typeof downloadAiGuideline>[0] = {
      roleLabel: options?.roleLabel ?? 'Generic',
      requiredTokens: requiredTokens,
    };
    if (guidelineSeedBody !== null) guidelineArg.seedBody = guidelineSeedBody;
    downloadAiGuideline(guidelineArg);
  };
  buttonRow.appendChild(guidelineBtn);

  // Plan-23 step 4: Reset to default. Only visible in edit mode for a slug
  // shipped by the seeder. Restores the textarea body from the canonical
  // `PLAN_NEXT_SEED_ROWS` entry, refreshes the drift-guard chip strip, and
  // toasts the user. The row is not persisted until the user hits Save, so
  // this is safe to cancel with the ✕ button.
  const editSlug = (isEdit && editPrompt && typeof editPrompt.slug === 'string') ? editPrompt.slug : null;
  const seedBody = editSlug ? getSeedBodyForSlug(editSlug) : null;
  if (seedBody !== null) {
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '↺ Reset to default';
    resetBtn.title = 'Restore this prompt body to the shipped default. Not saved until you click Save.';
    resetBtn.dataset.testid = 'prompt-editor-reset-default';
    resetBtn.style.cssText = CSS_MODAL_SECONDARY_BTN_BASE + cPanelBgAlt + CssFragment.BorderSolid + cPrimaryBorderA + ';border-radius:6px;color:#c4b5fd;font-size:12px;cursor:pointer;';
    resetBtn.onmouseover = function() { (this as HTMLElement).style.background = CSS_BTN_HOVER_BG; };
    resetBtn.onmouseout = function() { (this as HTMLElement).style.background = CSS_BTN_REST_BG; };
    resetBtn.onclick = function() {
      const current = contentArea.value;
      if (current.trim().length > 0 && current !== seedBody) {
        const ok = window.confirm('Reset the prompt body to the shipped default? Unsaved edits in this editor will be discarded (existing DB row is untouched until you click Save).');
        if (!ok) return;
      }
      contentArea.value = seedBody;
      contentArea.dispatchEvent(new Event('input', { bubbles: true }));
      showPasteToast('↺ Reset to default (unsaved) — click Save to persist', false);
    };
    buttonRow.appendChild(resetBtn);
  }



  // Paste Test button
  const testBtn = document.createElement('button');
  testBtn.textContent = '📋 Paste Test';
  testBtn.style.cssText = CSS_MODAL_SECONDARY_BTN_BASE + cPanelBgAlt + CssFragment.BorderSolid + cPrimaryBorderA + ';border-radius:6px;color:#c4b5fd;font-size:12px;cursor:pointer;';
  testBtn.onmouseover = function() { (this as HTMLElement).style.background = CSS_BTN_HOVER_BG; };
  testBtn.onmouseout = function() { (this as HTMLElement).style.background = CSS_BTN_REST_BG; };
  testBtn.onclick = function() {
    let text = contentArea.value.trim();
    if (!text) { showPasteToast('❌ No content to paste', true); return; }
    const now = new Date();
    text = text.replace(/\{\{date\}\}/gi, now.toLocaleDateString());
    text = text.replace(/\{\{time\}\}/gi, now.toLocaleTimeString());
    const pCfg = getPromptsConfig();
    pasteIntoEditor(text, pCfg, getByXPathAsElement);
  };
  buttonRow.appendChild(testBtn);

  // v4.177.0 — Inline diff pane. In edit mode only, show a unified +/- diff
  // between the currently-saved body (`editPrompt.text`) and the textarea.
  // Hidden by default; toggled by "🔍 Diff vs saved". Recomputed on every
  // keystroke while visible so users see exactly what will be persisted.
  const diffBaseline = (isEdit && editPrompt && typeof editPrompt.text === 'string') ? editPrompt.text : null;
  const diffHost = document.createElement('div');
  diffHost.dataset.testid = 'prompt-editor-diff-host';
  diffHost.style.cssText = 'display:none;';
  footer.appendChild(diffHost);
  // v4.192.0 — Persist the diff-pane open/closed state per role so the choice
  // survives modal open/close. Key namespace: `marco.diffOpen.<role>` where
  // role is 'plan' | 'next' | 'generic'. localStorage may be unavailable
  // (privacy mode, sandboxed frame) so all access is try/catch-wrapped.
  const diffPersistRole: string = (options?.role === 'plan' || options?.role === 'next') ? options.role : 'generic';
  const diffPersistKey = 'marco.diffOpen.' + diffPersistRole;
  const readDiffPref = function (): boolean {
    try { return window.localStorage.getItem(diffPersistKey) === '1'; } catch { return false; }
  };
  const writeDiffPref = function (open: boolean): void {
    try { window.localStorage.setItem(diffPersistKey, open ? '1' : '0'); } catch { /* ignore */ }
  };
  let isDiffOpen = false;
  const rerenderDiff = function (): void {
    if (!isDiffOpen || diffBaseline === null) return;
    diffHost.textContent = '';
    diffHost.appendChild(renderDiffPane(diffBaseline, contentArea.value));
  };
  if (diffBaseline !== null) {
    const diffBtn = document.createElement('button');
    diffBtn.textContent = '🔍 Diff vs saved';
    diffBtn.title = 'Toggle a live unified diff comparing this editor with the currently-saved prompt body. Shortcut: Ctrl+D (Cmd+D on macOS).';
    diffBtn.dataset.testid = 'prompt-editor-diff-toggle';
    diffBtn.style.cssText = CSS_MODAL_SECONDARY_BTN_BASE + cPanelBgAlt + CssFragment.BorderSolid + cPrimaryBorderA + ';border-radius:6px;color:#c4b5fd;font-size:12px;cursor:pointer;';
    const applyDiffOpenState = function (): void {
      diffHost.style.display = isDiffOpen ? 'block' : 'none';
      diffBtn.textContent = isDiffOpen ? '🔍 Hide diff' : '🔍 Diff vs saved';
      rerenderDiff();
    };
    diffBtn.onclick = function () {
      isDiffOpen = !isDiffOpen;
      writeDiffPref(isDiffOpen);
      applyDiffOpenState();
    };
    buttonRow.appendChild(diffBtn);

    // Restore the persisted state for this role on mount.
    if (readDiffPref()) {
      isDiffOpen = true;
      applyDiffOpenState();
    }

    // v4.189.0 — Ctrl+D (or Cmd+D on macOS) toggles the diff pane while the
    // editor is open. Scoped to `overlay` so the shortcut only fires while
    // the modal is mounted, and self-removes when the overlay is detached
    // (the browser will drop the listener with the node, but we also guard
    // with `document.body.contains` as a belt-and-braces cleanup path so a
    // stale handler cannot toggle a fresh, unrelated modal instance).
    const diffKeyHandler = function (e: KeyboardEvent): void {
      if (!document.body.contains(overlay)) {
        document.removeEventListener('keydown', diffKeyHandler);
        return;
      }
      const isDiffShortcut = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey
        && (e.key === 'd' || e.key === 'D');
      if (!isDiffShortcut) return;
      e.preventDefault();
      e.stopPropagation();
      diffBtn.click();
    };
    document.addEventListener('keydown', diffKeyHandler);
  }



  // Save button — drift-guarded via required-tokens chip strip.
  const saveBtn = document.createElement('button');
  saveBtn.textContent = isEdit ? '💾 Update' : '💾 Save';
  saveBtn.style.cssText = 'padding:8px 18px;background:' + cPrimary + ';border:none;border-radius:6px;color:#fff;font-size:12px;font-weight:600;cursor:pointer;';
  saveBtn.onmouseover = function() { if (!(saveBtn as HTMLButtonElement).disabled) (this as HTMLElement).style.background = '#6d28d9'; };
  saveBtn.onmouseout = function() { if (!(saveBtn as HTMLButtonElement).disabled) (this as HTMLElement).style.background = '#7c3aed'; };

  // Wire live drift check: recompute missing tokens on every keystroke.
  const refreshDriftState = function (): void {
    const missing = tokenStrip ? tokenStrip.recomputeMissing(contentArea.value) : [];
    const ruleZero = ruleZeroIndicator ? ruleZeroIndicator.recompute(contentArea.value) : null;
    const ruleZeroBlocks = ruleZero !== null && !ruleZero.ok;
    const blocked = missing.length > 0 || ruleZeroBlocks;
    (saveBtn as HTMLButtonElement).disabled = blocked;
    saveBtn.style.opacity = blocked ? '0.5' : '1';
    saveBtn.style.cursor = blocked ? 'not-allowed' : 'pointer';
    if (missing.length > 0) {
      saveBtn.title = 'Save is disabled — missing required tokens: {{' + missing.join('}}, {{') + '}}';
    } else if (ruleZeroBlocks && ruleZero) {
      saveBtn.title = 'Save is disabled — ' + ruleZero.reason;
    } else {
      saveBtn.title = '';
    }
  };
  const prevInput = contentArea.oninput;
  contentArea.oninput = function (ev: Event) {
    if (typeof prevInput === 'function') prevInput.call(contentArea, ev);
    refreshDriftState();
    rerenderDiff();
  };
  refreshDriftState();


  // eslint-disable-next-line max-lines-per-function -- linear save-response ceremony; split would obscure flow
  function handleSaveResponse(resp: PromptSaveResult, name: string, text: string): void {
    (saveBtn as HTMLButtonElement).disabled = false;
    saveBtn.textContent = isEdit ? '💾 Update' : '💾 Save';
    if (!(resp && resp.isOk)) {
      const fallback = resp.errorMessage || 'Save failed, extension may not be connected';
      const detailedMessage = formatSaveErrorMessage({
        role: options?.role,
        isEdit: isEdit,
        fallbackMessage: fallback,
        failure: resp.failure,
      });
      showPasteToast(detailedMessage, true);
      logDiagnosticFromCode(
        'PROMPT_VALIDATE_E003',
        {
          role: options?.role ?? 'generic',
          slug: (editPrompt && typeof editPrompt.slug === 'string') ? editPrompt.slug : 'unknown',
          ruleId: resp.failure ? (resp.failure.rule + ':' + (resp.failure.code ?? '')) : 'upstream',
          reason: fallback,
        },
        new Error(fallback),
      );
      return;
    }
    const role = options?.role;
    const canUndo = isEdit
      && (role === 'plan' || role === 'next')
      && editPrompt !== null
      && typeof editPrompt.text === 'string'
      && editPrompt.text.length > 0
      && editPrompt.text !== text
      && typeof editPrompt.slug === 'string'
      && editPrompt.slug.length > 0;
    if (canUndo) {
      const previousName = editPrompt!.name;
      const previousBody = editPrompt!.text;
      const previousSlug = editPrompt!.slug as string;
      const previousId = parseDbPromptId(editPrompt);
      showUndoToast('✓ Prompt saved: ' + name, function(): Promise<void> {
        const undoPayload: Parameters<typeof upsertPrompt>[0] = {
          slug: previousSlug, name: previousName, body: previousBody,
          role: role, previousBody: text,
        };
        if (previousId !== undefined) undoPayload.id = previousId;
        return upsertPrompt(undoPayload).then(function(r) {
          if (!r.ok) {
            showPasteToast('❌ Undo failed: ' + (r.error ?? 'upsert failed'), true);
            logDiagnosticFromCode(
              'PROMPT_UNDO_E001',
              { slug: previousSlug, reason: r.error ?? 'upsert failed' },
              new Error(r.error ?? 'upsert failed'),
            );
            return;
          }
          showPasteToast('↺ Reverted to previous version', false);
          refreshAfterPromptSave();
        });
      });
    } else {
      showPasteToast('✓ Prompt saved: ' + name, false);
    }
    log('Prompt saved: ' + name, 'success');
    overlay.remove();
    refreshAfterPromptSave();
  }

  saveBtn.onclick = function() {
    const { titleInput, contentArea, catSelect, catCustomInput, tagsInput, excludeFromExportInput } = bodyResult;
    const name = titleInput.value.trim();
    const text = contentArea.value.trim();
    if (!name) { showPasteToast('❌ Title is required', true); titleInput.focus(); return; }
    if (!text) { showPasteToast('❌ Content is required', true); contentArea.focus(); return; }
    if (text.length > 50 * 1024) { showPasteToast('❌ Content exceeds 50KB limit', true); return; }

    if (tokenStrip) {
      const missing = tokenStrip.recomputeMissing(text);
      if (missing.length > 0) {
        const detailedMessage = formatSaveErrorMessage({
          role: options?.role,
          isEdit: isEdit,
          fallbackMessage: 'Missing required tokens: {{' + missing.join('}}, {{') + '}}',
          failure: { rule: 'token-drift', code: 'missing-required-token', missingTokens: missing },
        });
        showPasteToast(detailedMessage, true);
        logDiagnosticFromCode(
          'PROMPT_VALIDATE_E002',
          {
            role: options?.role ?? 'generic',
            slug: (editPrompt && typeof editPrompt.slug === 'string') ? editPrompt.slug : 'unknown',
            missingTokens: missing.join(','),
            missingCount: missing.length,
            ruleId: 'token-drift',
          },
          new Error('token drift: ' + missing.join(',')),
        );
        contentArea.focus();
        return;
      }
    }

    (saveBtn as HTMLButtonElement).disabled = true;
    saveBtn.textContent = '⏳ Saving…';

    const category = getSelectedCategory(catSelect, catCustomInput);
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
    const saveInput: PromptSaveInput = {
      name: name, text: text, category: category, tags: tags,
      excludeFromExport: !!excludeFromExportInput.checked,
      isEdit: isEdit, editPrompt: editPrompt,
    };
    if (options?.role) saveInput.role = options.role;
    savePromptFromEditor(saveInput).then(function(resp: PromptSaveResult) {
      handleSaveResponse(resp, name, text);
    });
  };

  buttonRow.appendChild(saveBtn);
  footer.appendChild(buttonRow);

  return footer;
}

/**
 * Plan-23 step 5: build the required-tokens chip strip and expose a
 * `recomputeMissing(body)` callback the footer uses to toggle Save.
 * Returns `null` when the caller passed no required tokens (Generic role,
 * Save-from-chatbox flow) so the editor keeps its original single-row footer.
 */
function _buildRequiredTokenStrip(requiredTokens: string[]): {
  root: HTMLElement;
  recomputeMissing: (body: string) => string[];
} | null {
  if (requiredTokens.length === 0) return null;

  const root = document.createElement('div');
  root.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 10px;background:rgba(124,58,237,0.08);border-radius:6px;font-size:11px;color:' + cPrimaryLight + ';';
  const label = document.createElement('span');
  label.textContent = '🔒 Required tokens:';
  label.style.cssText = 'font-weight:600;';
  root.appendChild(label);

  const chips = new Map<string, HTMLElement>();
  for (const token of requiredTokens) {
    const chip = document.createElement('span');
    chip.textContent = '{{' + token + '}}';
    chip.dataset.token = token;
    chip.style.cssText = 'padding:2px 8px;border:1px solid ' + cPrimaryBorderA + ';border-radius:999px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;';
    root.appendChild(chip);
    chips.set(token, chip);
  }
  const note = document.createElement('span');
  note.style.cssText = 'margin-left:auto;font-size:10px;color:' + cPanelFgDim + ';';
  note.textContent = 'These tokens are substituted at paste time — do not delete or rename them.';
  root.appendChild(note);

  const recomputeMissing = function (body: string): string[] {
    const present = new Set(extractParamTokens(body || ''));
    const missing: string[] = [];
    for (const [token, chip] of chips) {
      const ok = present.has(token);
      chip.style.background = ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
      chip.style.borderColor = ok ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.7)';
      chip.style.color = ok ? '#86efac' : '#fca5a5';
      if (!ok) missing.push(token);
    }
    return missing;
  };

  return { root, recomputeMissing };
}

/**
 * v4.176.0 — Rule-0 live pre-save indicator.
 *
 * Runs `validateRuleZero` on the current textarea body and paints a coloured
 * badge under the required-tokens chip strip so the user sees the "step count
 * is law" contract state before hitting Save. `recompute(body)` returns the
 * latest `RuleZeroCheck` so the footer can gate the Save button.
 *
 * Never throws. Never a silent no-op: every state transition updates the
 * badge text/colour and the returned code so callers can log context.
 */
interface RuleZeroPaintText { text: string; good: boolean; neutral: boolean }

function _ruleZeroPaintText(check: import('../db/rule-zero-validator').RuleZeroCheck): RuleZeroPaintText {
  switch (check.code) {
    case 'template':
      return { text: 'template — {{n}} deferred to inject-time', good: true, neutral: true };
    case 'no-declaration':
      return { text: 'no declared Steps: — nothing to enforce', good: true, neutral: true };
    case 'match':
      return { text: '✓ declared ' + String(check.expectedN) + ' = counted ' + String(check.actualN), good: true, neutral: false };
    case 'no-steps':
      return { text: '✗ declared ' + String(check.expectedN) + ' but body has 0 numbered steps', good: false, neutral: false };
    case 'mismatch':
    default:
      return { text: '✗ declared ' + String(check.expectedN) + ' ≠ counted ' + String(check.actualN), good: false, neutral: false };
  }
}

function _ruleZeroApplyStyle(badge: HTMLElement, paintText: RuleZeroPaintText): void {
  badge.textContent = paintText.text;
  if (paintText.neutral) {
    badge.style.background = 'rgba(148,163,184,0.15)';
    badge.style.borderColor = 'rgba(148,163,184,0.5)';
    badge.style.color = '#cbd5e1';
  } else if (paintText.good) {
    badge.style.background = 'rgba(34,197,94,0.15)';
    badge.style.borderColor = 'rgba(34,197,94,0.6)';
    badge.style.color = '#86efac';
  } else {
    badge.style.background = 'rgba(239,68,68,0.15)';
    badge.style.borderColor = 'rgba(239,68,68,0.7)';
    badge.style.color = '#fca5a5';
  }
}

function _buildRuleZeroIndicator(): {
  root: HTMLElement;
  recompute: (body: string) => import('../db/rule-zero-validator').RuleZeroCheck;
} {
  const root = document.createElement('div');
  root.dataset.testid = 'prompt-editor-rule-zero-indicator';
  root.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;background:rgba(124,58,237,0.06);border-radius:6px;font-size:11px;color:' + cPrimaryLight + ';';

  const label = document.createElement('span');
  label.textContent = '📐 Rule 0 (step count is law):';
  label.style.cssText = 'font-weight:600;';
  root.appendChild(label);

  const badge = document.createElement('span');
  badge.dataset.testid = 'prompt-editor-rule-zero-badge';
  badge.style.cssText = 'padding:2px 8px;border-radius:999px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;border:1px solid ' + cPrimaryBorderA + ';';
  root.appendChild(badge);

  const note = document.createElement('span');
  note.style.cssText = 'margin-left:auto;font-size:10px;color:' + cPanelFgDim + ';';
  note.textContent = 'Save is blocked while declared and counted step totals disagree.';
  root.appendChild(note);

  const recompute = function (body: string): import('../db/rule-zero-validator').RuleZeroCheck {
    const check = validateRuleZero(body || '');
    _ruleZeroApplyStyle(badge, _ruleZeroPaintText(check));
    return check;
  };

  return { root, recompute };
}



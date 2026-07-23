/**
 * MacroLoop Controller - Task Next Settings Modal
 * Plan-17 step 12: Extracted from task-next-ui.ts to keep the file below the
 * 500 LOC cap. Behavior is unchanged; imports and DOM structure preserved.
 */

import { cPanelBg, cPanelFg, cPrimary, cPrimaryLight } from '../shared-state';
import { Label } from '../types';
import { showPasteToast } from './prompt-utils';
import { taskNextState, saveTaskNextSettings, type TaskNextDeps } from './task-next-ui';

// eslint-disable-next-line max-lines-per-function
export function openTaskNextSettingsModal(deps: TaskNextDeps) {
  const existing = document.getElementById('marco-tasknext-settings');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'marco-tasknext-settings';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:1000010;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:' + cPanelBg + ';border:1px solid ' + cPrimary + ';border-radius:12px;width:400px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,0.8);';

  const title = document.createElement('div');
  title.textContent = '⚙ Task Next Settings';
  title.style.cssText = 'font-size:14px;font-weight:700;color:' + cPanelFg + ';margin-bottom:16px;';
  modal.appendChild(title);

  const fields = [
    { key: 'preClickDelayMs', label: 'Pre-click delay (ms)', type: 'number' },
    { key: 'postClickDelayMs', label: 'Post-click delay (ms)', type: 'number' },
    { key: 'retryCount', label: 'Retry count', type: 'number' },
    { key: 'retryDelayMs', label: 'Retry delay (ms)', type: 'number' },
    { key: 'buttonXPath', label: 'Button XPath', type: 'text' },
    { key: 'promptSlug', label: 'Prompt slug', type: 'text' },
  ];

  const inputs: Record<string, HTMLInputElement> = {};
  for (const field of fields) {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:10px;';
    const lbl = document.createElement('label');
    lbl.textContent = field.label;
    lbl.style.cssText = 'display:block;font-size:10px;color:' + cPrimaryLight + ';margin-bottom:3px;';
    row.appendChild(lbl);
    const inp = document.createElement('input');
    inp.type = field.type;
    if (field.type === 'checkbox') {
      inp.checked = taskNextState.settings[field.key] === true;
    } else {
      inp.value = String(taskNextState.settings[field.key]);
    }
    inp.style.cssText = 'width:100%;padding:6px 8px;background:rgba(0,0,0,0.3);border:1px solid rgba(124,58,237,0.3);border-radius:6px;color:' + cPanelFg + ';font-size:11px;box-sizing:border-box;';
    row.appendChild(inp);
    modal.appendChild(row);
    inputs[field.key] = inp;
  }

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:6px 16px;border:1px solid rgba(124,58,237,0.3);border-radius:6px;background:transparent;color:' + cPanelFg + ';cursor:pointer;font-size:11px;';
  cancelBtn.onclick = function() { overlay.remove(); };
  btnRow.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.cssText = 'padding:6px 16px;border:none;border-radius:6px;background:' + cPrimary + ';color:#fff;cursor:pointer;font-size:11px;font-weight:600;';
  saveBtn.onclick = function() {
    taskNextState.settings.preClickDelayMs = parseInt(inputs.preClickDelayMs.value) || 500;
    taskNextState.settings.postClickDelayMs = parseInt(inputs.postClickDelayMs.value) || 2000;
    taskNextState.settings.retryCount = parseInt(inputs.retryCount.value) || 3;
    taskNextState.settings.retryDelayMs = parseInt(inputs.retryDelayMs.value) || 1000;
    taskNextState.settings.buttonXPath = inputs.buttonXPath.value || taskNextState.settings.buttonXPath;
    taskNextState.settings.promptSlug = inputs.promptSlug.value || Label.NextTasks;
    taskNextState.settings.requireStartForMultiRun = true;
    saveTaskNextSettings(deps);
    overlay.remove();
    showPasteToast('✅ Task Next settings saved', false);
  };
  btnRow.appendChild(saveBtn);
  modal.appendChild(btnRow);

  overlay.appendChild(modal);
  overlay.onclick = function(e) {
    if (e.target === overlay) {
      overlay.remove();
    }
  };
  document.body.appendChild(overlay);
}

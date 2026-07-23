/**
 * Prompt Dropdown Render helpers
 *
 * Plan-17 Step 25: extracted from ui/prompt-dropdown.ts to shrink that file
 * below the 500 LOC guideline cap. Hosts pure DOM-render helpers that group
 * entries into collapsible folder trees.
 *
 * Accepts a `renderItem` callback so we never import back into prompt-dropdown
 * (would recreate a cycle).
 */

import type { PromptEntry as LoaderPromptEntry, ResolvedPromptsConfig } from '../types';
import type { PromptContext } from './prompt-loader';
import type { TaskNextDeps } from './task-next-ui';
import { cPrimaryLight } from '../shared-state';

export type ItemRenderer = (
  idx: number,
  p: LoaderPromptEntry,
  container: HTMLElement,
  promptsCfg: ResolvedPromptsConfig,
  promptCtx: PromptContext,
  taskNextDeps: TaskNextDeps,
) => HTMLElement;

interface FolderGroups {
  folders: Record<string, LoaderPromptEntry[]>;
  rootItems: LoaderPromptEntry[];
}

function groupEntriesByFolder(entries: LoaderPromptEntry[]): FolderGroups {
  const folders: Record<string, LoaderPromptEntry[]> = {};
  const rootItems: LoaderPromptEntry[] = [];
  entries.forEach(p => {
    const cat = p.category || '';
    if (cat.includes('/')) {
      const folderName = cat.split('/')[0];
      if (!folders[folderName]) folders[folderName] = [];
      folders[folderName].push(p);
    } else {
      rootItems.push(p);
    }
  });
  return { folders, rootItems };
}

function buildFolderNode(
  folderName: string,
  bucket: LoaderPromptEntry[],
  container: HTMLElement,
  promptsCfg: ResolvedPromptsConfig,
  promptCtx: PromptContext,
  taskNextDeps: TaskNextDeps,
  renderItem: ItemRenderer,
): HTMLElement {
  const folderWrap = document.createElement('div');
  folderWrap.style.cssText = 'border-bottom:1px solid rgba(124,58,237,0.1);';

  const folderHeader = document.createElement('div');
  folderHeader.style.cssText = 'padding:6px 10px;font-size:10px;font-weight:700;color:' + cPrimaryLight + ';cursor:pointer;display:flex;align-items:center;gap:6px;background:rgba(124,58,237,0.03);';
  // Plan-17 step 14: XSS-safe DOM build (folderName originates from user data).
  const folderIcon = document.createElement('span');
  folderIcon.textContent = '📁';
  const folderLabel = document.createElement('span');
  folderLabel.textContent = folderName;
  const folderCount = document.createElement('span');
  folderCount.style.cssText = 'font-size:8px;opacity:0.5;margin-left:auto;';
  folderCount.textContent = '(' + bucket.length + ')';
  folderHeader.append(folderIcon, folderLabel, folderCount);

  const folderBody = document.createElement('div');
  folderBody.style.display = 'none';
  folderBody.style.paddingLeft = '8px';
  folderBody.style.borderLeft = '1px solid rgba(124,58,237,0.2)';
  folderBody.style.margin = '2px 0 2px 10px';

  folderHeader.onclick = (e) => {
    e.stopPropagation();
    const isOpen = folderBody.style.display !== 'none';
    folderBody.style.display = isOpen ? 'none' : 'block';
    const icon = folderHeader.querySelector('span');
    if (icon) icon.textContent = isOpen ? '📁' : '📂';
  };

  bucket.forEach((p, idx) => {
    folderBody.appendChild(renderItem(idx, p, container, promptsCfg, promptCtx, taskNextDeps));
  });

  folderWrap.appendChild(folderHeader);
  folderWrap.appendChild(folderBody);
  return folderWrap;
}

/** Render prompts grouped into a collapsible folder tree, followed by root items. */
export function renderFolderTree(
  container: HTMLElement,
  entries: LoaderPromptEntry[],
  promptsCfg: unknown,
  promptCtx: PromptContext,
  taskNextDeps: TaskNextDeps,
  renderItem: ItemRenderer,
): void {
  const { folders, rootItems } = groupEntriesByFolder(entries);
  const resolvedCfg = promptsCfg as ResolvedPromptsConfig;

  Object.keys(folders).sort().forEach(folderName => {
    container.appendChild(
      buildFolderNode(folderName, folders[folderName], container, resolvedCfg, promptCtx, taskNextDeps, renderItem),
    );
  });

  rootItems.forEach((p, idx) => {
    container.appendChild(renderItem(idx, p, container, resolvedCfg, promptCtx, taskNextDeps));
  });
}

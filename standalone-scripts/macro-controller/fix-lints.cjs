const fs = require('fs');

const files = {
  'src/ui/task-splitter-ui.ts': [
    ['console.error();', 'logError(\'TaskSplitter\', \'enqueue failed\', caught);'],
    ['state.collapsed = !state.collapsed; persist(); notify();', 'state.collapsed = !state.collapsed;\n    persist();\n    notify();'],
    ['const nLbl = document.createElement(\'span\'); nLbl.textContent = \'Steps\'; nLbl.style.opacity = \'0.8\';', 'const nLbl = document.createElement(\'span\');\n  nLbl.textContent = \'Steps\';\n  nLbl.style.opacity = \'0.8\';'],
    ['nInput.type = \'number\'; nInput.min = String(STEP_MIN); nInput.max = String(STEP_MAX);', 'nInput.type = \'number\';\n  nInput.min = String(STEP_MIN);\n  nInput.max = String(STEP_MAX);'],
    ['persist(); notify();', 'persist();\n    notify();'],
    ['const dLbl = document.createElement(\'span\'); dLbl.textContent = \'Delay\'; dLbl.style.opacity = \'0.8\'; dLbl.style.marginLeft = \'6px\';', 'const dLbl = document.createElement(\'span\');\n  dLbl.textContent = \'Delay\';\n  dLbl.style.opacity = \'0.8\';\n  dLbl.style.marginLeft = \'6px\';'],
    ['const o = document.createElement(\'option\'); o.value = String(s); o.textContent = s + \'s\'; dSel.appendChild(o);', 'const o = document.createElement(\'option\');\n    o.value = String(s);\n    o.textContent = s + \'s\';\n    dSel.appendChild(o);'],
    ['state.delaySec = parseInt(dSel.value, 10) || DELAY_DEFAULT; persist();', 'state.delaySec = parseInt(dSel.value, 10) || DELAY_DEFAULT;\n    persist();'],
    ['row1.appendChild(nLbl); row1.appendChild(nInput);', 'row1.appendChild(nLbl);\n  row1.appendChild(nInput);'],
    ['row1.appendChild(dLbl); row1.appendChild(dSel);', 'row1.appendChild(dLbl);\n  row1.appendChild(dSel);'],
    ['const sLbl = document.createElement(\'span\'); sLbl.textContent = \'Split\'; sLbl.style.opacity = \'0.8\';', 'const sLbl = document.createElement(\'span\');\n  sLbl.textContent = \'Split\';\n  sLbl.style.opacity = \'0.8\';'],
    ['state.splitPromptSlug = sSel.value; persist();', 'state.splitPromptSlug = sSel.value;\n    persist();'],
    ['row2.appendChild(sLbl); row2.appendChild(sSel);', 'row2.appendChild(sLbl);\n  row2.appendChild(sSel);'],
    ['const pLbl = document.createElement(\'span\'); pLbl.textContent = \'Step\'; pLbl.style.opacity = \'0.8\';', 'const pLbl = document.createElement(\'span\');\n  pLbl.textContent = \'Step\';\n  pLbl.style.opacity = \'0.8\';'],
    ['state.perStepPromptSlug = pSel.value; persist();', 'state.perStepPromptSlug = pSel.value;\n    persist();'],
    ['row3.appendChild(pLbl); row3.appendChild(pSel);', 'row3.appendChild(pLbl);\n  row3.appendChild(pSel);']
  ],
  'src/ui/tools-sections-builder.ts': [
    ['e.preventDefault(); executeJs();', 'e.preventDefault();\n      executeJs();'],
    ['e.preventDefault(); navigateLoopJsHistory(\'up\');', 'e.preventDefault();\n      navigateLoopJsHistory(\'up\');'],
    ['e.preventDefault(); navigateLoopJsHistory(\'down\');', 'e.preventDefault();\n      navigateLoopJsHistory(\'down\');'],
    ['e.preventDefault(); e.stopPropagation();', 'e.preventDefault();\n    e.stopPropagation();'],
    ['e.preventDefault();\n    e.stopPropagation(); downloadLogs();', 'e.preventDefault();\n    e.stopPropagation();\n    downloadLogs();'],
    ['e.preventDefault();\n    e.stopPropagation();\n    clearAllLogs();', 'e.preventDefault();\n    e.stopPropagation();\n    clearAllLogs();'],
    ['e.preventDefault();\n    e.stopPropagation();\n    const text = _formatAllRecentErrors();', 'e.preventDefault();\n    e.stopPropagation();\n    const text = _formatAllRecentErrors();'],
    ['e.preventDefault();\n    e.stopPropagation();\n    recentErrors.length = 0;', 'e.preventDefault();\n    e.stopPropagation();\n    recentErrors.length = 0;']
  ],
  'src/ui/ws-dropdown-builder.ts': [
    ['e.preventDefault(); e.stopPropagation();', 'e.preventDefault();\n    e.stopPropagation();'],
    ['e.preventDefault();\n    e.stopPropagation(); renderBulkRenameDialog();', 'e.preventDefault();\n    e.stopPropagation();\n    renderBulkRenameDialog();'],
    ['e.preventDefault();\n    e.stopPropagation();\n    handleFocusCurrent', 'e.preventDefault();\n    e.stopPropagation();\n    handleFocusCurrent'],
    ['e.preventDefault();\n    e.stopPropagation();\n    if (getRenameHistory().length === 0) {', 'e.preventDefault();\n    e.stopPropagation();\n    if (getRenameHistory().length === 0) {']
  ]
};

for (const [file, replacements] of Object.entries(files)) {
  let content = fs.readFileSync(file, 'utf8');
  for (const [oldStr, newStr] of replacements) {
    content = content.split(oldStr).join(newStr);
  }
  fs.writeFileSync(file, content);
}
console.log('Done');

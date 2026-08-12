const fs = require('fs');
let content = fs.readFileSync('standalone-scripts/macro-controller/src/ui/repeat-loop-ui.ts', 'utf8');

// 1. Add imports
content = content.replace(
  "import { RepeatPhaseType, CssDisplayType } from \"../types/enums\";",
  `import { RepeatPhaseType, CssDisplayType } from "../types/enums";
import { buildMorePopover } from './plan-more-popover';
import {
  enhancePopoverA11y,
  isPopoverOpen,
  positionPopoverFixed,
  setPopoverVisibility,
  wirePopoverButton,
  createOutsidePopoverCloser,
  registerPointerPopoverCloser
} from './next-inline-ui';`
);

// 2. Remove buildMorePresetsPopover completely
content = content.replace(/function buildMorePresetsPopover[\s\S]*?return wrap;\n\}\n/m, "");

// 3. Update buildCountPresets to use buildMorePopover
const oldOverflowLogic = `
  if (overflow.length > 0) {
    frag.appendChild(buildMorePresetsPopover(overflow));
  }
`;
const newOverflowLogic = `
  if (overflow.length > 0) {
    const wrap = document.createElement('span');
    wrap.style.cssText = 'position:relative;display:inline-block;';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'More ▾';
    trigger.title = 'Show more repeat presets (' + overflow.join(', ') + ')';
    trigger.dataset.testid = 'repeat-more-trigger';
    trigger.style.cssText = 'padding:2px 6px;background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.4);border-radius:4px;color:' + cPanelFg + ';cursor:pointer;font-size:10px;';

    wrap.appendChild(trigger);
    
    buildMorePopover({
      role: 'repeat',
      roleLabel: 'Repeat presets',
      accent: 'rgba(124,58,237,0.4)',
      anchor: wrap,
      trigger,
      initialValues: overflow,
      buildChip: (n) => makePresetButton(n, true),
      appendExtra: (p) => p.appendChild(buildMorePopoverSchemeDetails())
    }, {
      enhancePopoverA11y,
      isPopoverOpen,
      positionPopoverFixed,
      setPopoverVisibility,
      wirePopoverButton,
      createOutsidePopoverCloser,
      registerPointerPopoverCloser
    });

    frag.appendChild(wrap);
  }
`;
content = content.replace(oldOverflowLogic, newOverflowLogic);

fs.writeFileSync('standalone-scripts/macro-controller/src/ui/repeat-loop-ui.ts', content);

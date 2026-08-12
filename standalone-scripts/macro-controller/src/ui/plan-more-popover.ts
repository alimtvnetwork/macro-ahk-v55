import {
  cPanelFg,
  cPanelFgDim,
  STYLE_DISPLAY_FLEX,
  STYLE_DISPLAY_NONE,
  ATTR_ARIA_EXPANDED,
  MENU_ROLE,
  ATTR_ARIA_HASPOPUP,
  ATTR_ARIA_LABEL,
  ATTR_ARIA_CONTROLS,
  ATTR_ROLE,
  CSS_CHIP_TRANSITION,
  cLogDefault
} from '../shared-state';

import type { PopoverA11y } from './next-inline-ui';

export interface PopoverDependencies {
  enhancePopoverA11y: (panel: HTMLElement, trigger: HTMLElement, onClose: () => void, menuName?: string) => PopoverA11y;
  isPopoverOpen: (panel: HTMLElement) => boolean;
  positionPopoverFixed: (panel: HTMLElement, button: HTMLElement) => void;
  setPopoverVisibility: (panel: HTMLElement, button: HTMLElement, a11y: PopoverA11y, open: boolean) => void;
  wirePopoverButton: (button: HTMLButtonElement, panel: HTMLElement, setOpen: (open: boolean) => void) => void;
  createOutsidePopoverCloser: (container: HTMLElement, panel: HTMLElement, button: HTMLElement, setOpen: (open: boolean) => void) => (event: Event) => void;
  registerPointerPopoverCloser: (handler: (ev: Event) => void) => void;
}

export interface MorePopoverHandle {
  panel: HTMLElement;
  setOpen: (open: boolean) => void;
  a11y: PopoverA11y;
}

export interface MorePopoverConfig {
  role: 'plan' | 'repeat' | 'next';
  roleLabel: string;
  accent: string;
  anchor: HTMLElement;
  trigger: HTMLButtonElement;
  initialValues: readonly number[];
  buildChip: (n: number) => HTMLElement;
  appendExtra?: (panel: HTMLElement) => void;
  scheduleDbRefresh?: (rePopulate: (values: readonly number[]) => void) => void;
}

function createDropupPanel(role: string, roleLabel: string, accent: string): HTMLElement {
  const panel = document.createElement('div');
  panel.id = 'marco-' + role + '-dropup-' + Math.random().toString(36).slice(2, 9);
  panel.setAttribute('role', 'menu');
  panel.setAttribute('aria-label', roleLabel + ' menu');
  panel.style.cssText = 'position:fixed;display:none;flex-direction:column;gap:4px;padding:7px;background:hsl(var(--background));border:1px solid ' + accent + ';border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,0.5);z-index:2147483646;min-width:226px;max-width:300px;';
  panel.dataset['role'] = role + '-dropup';

  return panel;
}

function wireTriggerAria(trigger: HTMLButtonElement, panelId: string): void {
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', panelId);
}

function populateDropup(
  panel: HTMLElement, 
  values: readonly number[], 
  buildChip: (n: number) => HTMLElement, 
  appendExtra?: (panel: HTMLElement) => void
): void {
  while (panel.firstChild) {
    panel.removeChild(panel.firstChild);
  }

  const chipGrid = document.createElement('div');
  chipGrid.style.cssText = 'display:grid;grid-template-columns:repeat(6,auto);gap:4px;margin-bottom:6px;';
  for (const n of values) {
    const b = buildChip(n);
    b.addEventListener('click', function () {
      panel.style.display = 'none'; 
    });
    chipGrid.appendChild(b);
  }

  panel.appendChild(chipGrid);

  if (appendExtra) {
    appendExtra(panel);
  }
}

export function buildMorePopover(config: MorePopoverConfig, deps: PopoverDependencies): MorePopoverHandle {
  const panel = createDropupPanel(config.role, config.roleLabel, config.accent);
  // eslint-disable-next-line prefer-const
  let a11y: PopoverA11y;

  const setOpen = (open: boolean): void => {
    deps.setPopoverVisibility(panel, config.trigger, a11y, open);
  };

  a11y = deps.enhancePopoverA11y(panel, config.trigger, () => setOpen(false), config.roleLabel + ' menu');
  
  const rePopulate = (values: readonly number[]): void => {
    populateDropup(panel, values, config.buildChip, config.appendExtra);
    if (deps.isPopoverOpen(panel)) {
      deps.positionPopoverFixed(panel, config.trigger);
    }

    a11y.syncItems();
  };

  rePopulate(config.initialValues);
  
  wireTriggerAria(config.trigger, panel.id);
  deps.wirePopoverButton(config.trigger as HTMLButtonElement, panel, setOpen);
  
  const closer = deps.createOutsidePopoverCloser(document.body, panel, config.trigger, setOpen);
  deps.registerPointerPopoverCloser(closer);
  
  if (config.scheduleDbRefresh) {
    config.scheduleDbRefresh(rePopulate);
  }
  
  config.anchor.appendChild(panel);
  registerPointerPopoverCloser(createOutsidePopoverCloser(config.anchor, panel, config.trigger, setOpen));

  return { panel, setOpen, a11y };
}

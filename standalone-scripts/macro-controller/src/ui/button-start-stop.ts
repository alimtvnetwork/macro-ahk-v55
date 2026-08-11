import { markUserGesture } from '../user-gesture-guard';
import { state } from '../shared-state';
import { IDS, cBtnStartGrad, cBtnStartGlow, tFont } from '../shared-state';
import { createCountdownCtx, updateStartStopBtn } from './countdown';
import { nsWrite } from '../api-namespace';
import type { PanelBuilderDeps } from './panel-builder';
import { CssFragmentType } from '../types';

export function buildStartStopButton(deps: PanelBuilderDeps, btnStyle: string): { wrap: HTMLElement; btn: HTMLElement } {
  const startStopWrap = document.createElement('div');
  startStopWrap.style.cssText = 'display:inline-flex;align-items:center;position:relative;min-width:0;';

  const startStopBtn = document.createElement('button');
  startStopBtn.id = IDS.START_BTN;
  startStopBtn.textContent = '▶';
  startStopBtn.title = 'Start loop';
  startStopBtn.style.cssText = btnStyle + CssFragmentType.Background + cBtnStartGrad + ';color:#fff;border-radius:8px;min-width:36px;width:36px;font-size:14px;text-align:center;padding:6px 0;box-shadow:' + cBtnStartGlow + CssFragmentType.Border1pxSolidRgba + ';position:relative;';
  
  startStopBtn.onmouseenter = function() { 
    startStopBtn.style.filter = 'brightness(1.12)'; 
    startStopBtn.style.boxShadow = '0 2px 8px rgba(0,200,83,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; 
  };

  startStopBtn.onmouseleave = function() { 
    startStopBtn.style.filter = ''; 
    startStopBtn.style.boxShadow = cBtnStartGlow; 
  };
  
  startStopBtn.onclick = function() {
    const isRunning = state.running;
    if (isRunning) {
      deps.stopLoop();

      return;
    }
    
    markUserGesture('panel-controls/start-stop-btn');
    deps.startLoop(state.direction);
  };

  const countdownBadge = document.createElement('span');
  countdownBadge.id = 'loop-countdown-badge';
  countdownBadge.style.cssText = 'display:none;align-items:center;justify-content:center;font-size:9px;font-family:' + tFont + ';font-weight:700;color:#fbbf24;background:rgba(0,0,0,0.6);padding:2px 6px;height:34px;border-radius:8px;border:1px solid rgba(251,191,36,0.3);margin-left:3px;min-width:28px;text-align:center;pointer-events:none;';
  countdownBadge.textContent = '';

  startStopWrap.appendChild(startStopBtn);
  startStopWrap.appendChild(countdownBadge);

  const cdCtx = createCountdownCtx(startStopBtn, countdownBadge, function(d: string) { 
    markUserGesture('panel-controls/countdown-resume'); 
    deps.startLoop(d); 
  }, deps.stopLoop);
  
  nsWrite('_internal.updateStartStopBtn', function(running: boolean) { 
    updateStartStopBtn(cdCtx, running); 
  });
  
  const isRunningState = !!state.running;
  updateStartStopBtn(cdCtx, isRunningState);

  return { wrap: startStopWrap, btn: startStopBtn };
}

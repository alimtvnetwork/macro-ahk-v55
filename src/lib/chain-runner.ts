/**
 * Chain Runner — Spec 21
 *
 * Executes an automation chain step-by-step with pause/resume/cancel.
 * Emits state updates via a callback so the UI can track progress.
 */

import type {
  AutomationChain, ChainStep, ChainExecutionState,
  ChainRunnerStatus, StepStatus, FlattenedStep,
} from "./automation-types";
import { flattenSteps } from "./automation-types";
import { evaluateCondition } from "./condition-evaluators";
import {
  executeInjectPrompt, executeClickButton, executeWait,
  executeWaitForElement, executeWaitForText, executeRunScript,
  executeSetKv, executeNotify,
} from "./step-executors";

export type StateCallback = (state: ChainExecutionState) => void;

export class ChainRunner {
  private state: ChainExecutionState;
  private abortController: AbortController | null = null;
  private paused = false;
  private pauseResolve: (() => void) | null = null;
  private onStateChange: StateCallback;

  constructor(chain: AutomationChain, onStateChange: StateCallback) {
    this.onStateChange = onStateChange;
    const flatSteps = flattenSteps(chain.steps);
    this.state = {
      chainId: chain.id,
      chainName: chain.name,
      status: "idle",
      flatSteps,
      stepStatuses: flatSteps.map(() => "pending" as StepStatus),
      currentStepIndex: -1,
    };
  }

  getState(): ChainExecutionState {
    return { ...this.state };
  }

  private emit() {
    this.onStateChange({ ...this.state });
  }

  private setStatus(status: ChainRunnerStatus) {
    this.state.status = status;
    this.emit();
  }

  private setStepStatus(index: number, status: StepStatus) {
    this.state.stepStatuses[index] = status;
    this.state.currentStepIndex = index;
    this.emit();
  }

  /* ---------------------------------------------------------------- */
  /*  Public controls                                                  */
  /* ---------------------------------------------------------------- */

  async run(): Promise<void> {
    if ((this.state.status as ChainRunnerStatus) === "running") return;

    this.abortController = new AbortController();
    this.state.startedAt = new Date().toISOString();
    this.setStatus("running");

    try {
      await this.executeSteps(this.state.flatSteps, 0);
      if (this.state.status === "running") {
        this.state.completedAt = new Date().toISOString();
        this.setStatus("completed");
      }
    } catch (err) {
      if (this.state.status !== "cancelled") {
        this.state.error = err instanceof Error ? err.message : String(err);
        this.state.completedAt = new Date().toISOString();
        this.setStatus("error");
      }
    }
  }

  pause() {
    if (this.state.status !== "running") return;
    this.paused = true;
    this.setStatus("paused");
  }

  resume() {
    if (this.state.status !== "paused") return;
    this.paused = false;
    this.setStatus("running");
    this.pauseResolve?.();
    this.pauseResolve = null;
  }

  cancel() {
    this.abortController?.abort();
    this.paused = false;
    this.pauseResolve?.();
    this.pauseResolve = null;

    // Mark remaining steps as skipped
    for (let i = 0; i < this.state.stepStatuses.length; i++) {
      if (this.state.stepStatuses[i] === "pending" || this.state.stepStatuses[i] === "running") {
        this.state.stepStatuses[i] = "skipped";
      }
    }
    this.state.completedAt = new Date().toISOString();
    this.setStatus("cancelled");
  }

  /* ---------------------------------------------------------------- */
  /*  Internal execution                                               */
  /* ---------------------------------------------------------------- */

  private async waitIfPaused(): Promise<void> {
    if (!this.paused) return;
    return new Promise<void>((resolve) => { this.pauseResolve = resolve; });
  }

  private async executeSteps(flatSteps: FlattenedStep[], startIndex: number): Promise<void> {
    // We process top-level steps from the chain's original step array.
    // flatSteps is used for status tracking; actual execution walks chain.steps.
    // This method is called with the full flat list; we iterate by finding
    // top-level entries.
    let flatIdx = startIndex;

    while (flatIdx < flatSteps.length) {
      if (this.abortController?.signal.aborted) return;
      await this.waitIfPaused();

      const { step, depth } = flatSteps[flatIdx];

      // Skip sub-steps of conditions (they're executed inside executeCondition)
      if (depth > 0 && flatIdx > startIndex) {
        flatIdx++;
        continue;
      }

      this.setStepStatus(flatIdx, "running");

      try {
        if (step.type === "condition") {
          await this.executeCondition(step, flatIdx);
        } else {
          await this.executeSingleStep(step);
        }
        this.setStepStatus(flatIdx, "done");
      } catch (err) {
        this.setStepStatus(flatIdx, "error");
        throw err;
      }

      // Skip past any sub-steps of a condition in the flat array
      if (step.type === "condition") {
        flatIdx += step.then.length + step.else.length;
      }

      flatIdx++;
    }
  }

  private async executeBranchSteps(branch: ChainStep[], startIdx: number): Promise<void> {
    for (let i = 0; i < branch.length; i++) {
      if (this.abortController?.signal.aborted) return;
      await this.waitIfPaused();
      this.setStepStatus(startIdx + i, "running");
      try {
        await this.executeSingleStep(branch[i]);
        this.setStepStatus(startIdx + i, "done");
      } catch (err) {
        this.setStepStatus(startIdx + i, "error");
        throw err;
      }
    }
  }

  private skipBranchSteps(count: number, startIdx: number): void {
    for (let i = 0; i < count; i++) {
      this.setStepStatus(startIdx + i, "skipped");
    }
  }

  private async executeCondition(step: Extract<ChainStep, { type: "condition" }>, conditionFlatIdx: number): Promise<void> {
    const isTrue = await evaluateCondition(step.check);
    const subIdx = conditionFlatIdx + 1;
    const elseStartIdx = subIdx + step.then.length;

    if (isTrue) {
      await this.executeBranchSteps(step.then, subIdx);
      this.skipBranchSteps(step.else.length, elseStartIdx);
      return;
    }
    
    this.skipBranchSteps(step.then.length, subIdx);
    await this.executeBranchSteps(step.else, elseStartIdx);
  }

  private async executeSingleStep(step: ChainStep): Promise<void> {
    const signal = this.abortController?.signal;

    switch (step.type) {
      case "inject_prompt": return executeInjectPrompt(step);
      case "click_button": return executeClickButton(step);
      case "wait": return executeWait(step, signal);
      case "wait_for_element": return executeWaitForElement(step, signal);
      case "wait_for_text": return executeWaitForText(step, signal);
      case "run_script": return executeRunScript(step);
      case "set_kv": return executeSetKv(step);
      case "notify": return executeNotify(step);
      default: throw new Error(`Unknown step type: ${(step as ChainStep).type}`);
    }
  }
}

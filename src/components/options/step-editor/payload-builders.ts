import { ServiceResult } from '../../../utils/result-wrapper';
/**
 * Pure payload builders for StepEditorDialog. Each function takes the
 * per-kind form state (plus the shared label) and returns a discriminated
 * union that the dialog forwards to `onSubmit` or surfaces via toast.
 *
 * Extracted from StepEditorDialog.tsx to keep the component's
 * `handleSubmit` under the cognitive-complexity threshold.
 */

import { StepKindId } from "@/background/recorder/step-library/schema";
import { UrlMatchType, UrlTabClickFailureModeType, SelectorKindType } from "../../../types/enums";
import { logError } from "@/components/options/options-logger";

export interface SubmitInput {
    StepKindId: StepKindId;
    LabelType: string | null;
    PayloadJson: string | null;
    TargetStepGroupId: number | null;
}

export type BuildResult =
    | { readonly Ok: true;  readonly Input: SubmitInput }
    | { readonly Ok: false; readonly ErrorMessage: string; readonly ErrorDescription?: string };

export type UrlMatchDialect = UrlMatchType;
export type UrlTabClickMode = UrlTabClickFailureModeType;
export type SelectorKindOption = SelectorKindType;

export interface UrlTabClickFormState {
    UrlPattern: string;
    UrlMatch: UrlMatchDialect;
    OperationModeType: UrlTabClickMode;
    Selector: string;
    SelectorKind: SelectorKindOption;
    TimeoutMs: string;
    DirectOpen: boolean;
    Url: string;
}

export const URL_TAB_CLICK_DEFAULTS: UrlTabClickFormState = {
  UrlPattern: "",
  UrlMatch: "Glob",
  OperationModeType: "OpenOrFocus",
  Selector: "",
  SelectorKind: "Auto",
  TimeoutMs: "",
  DirectOpen: false,
  Url: "",
};

export function hydrateUrlTabClickForm(payloadJson: string | null): UrlTabClickFormState {
  if (payloadJson === null || payloadJson === "") {
    return { ...URL_TAB_CLICK_DEFAULTS };
  }

  try {
    const parsed = JSON.parse(payloadJson) as Partial<Record<keyof UrlTabClickFormState, unknown>>;

    return {
      UrlPattern:   typeof parsed.UrlPattern === "string" ? parsed.UrlPattern : "",
      UrlMatch:     (parsed.UrlMatch === "Exact" || parsed.UrlMatch === "Prefix" || parsed.UrlMatch === "Glob" || parsed.UrlMatch === "Regex") ? parsed.UrlMatch : "Glob",
      OperationModeType:         (parsed.OperationModeType === "OpenNew" || parsed.OperationModeType === "FocusExisting" || parsed.OperationModeType === "OpenOrFocus") ? parsed.OperationModeType : "OpenOrFocus",
      Selector:     typeof parsed.Selector === "string" ? parsed.Selector : "",
      SelectorKind: (parsed.SelectorKind === "XPath" || parsed.SelectorKind === "Css" || parsed.SelectorKind === "Auto") ? parsed.SelectorKind : "Auto",
      TimeoutMs:    typeof parsed.TimeoutMs === "number" ? String(parsed.TimeoutMs) : "",
      DirectOpen:   parsed.DirectOpen === true,
      Url:          typeof parsed.Url === "string" ? parsed.Url : "",
    };
  } catch (err) { /* swallowed */
    return { ...URL_TAB_CLICK_DEFAULTS };
  }
}

function normaliseLabel(label: string): string | null {
  const trimmed = label.trim();

  return trimmed === "" ? null : trimmed;
}

function parseNonNegativeMs(raw: string, fieldLabel: string): { Ok: false; value: number | undefined } | { Ok: true; message: string } {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { Ok: false, value: undefined }; 
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value) || value < 0) {
    return { Ok: true, message: `${fieldLabel} must be a non-negative number.` };
  }

  return { Ok: false, value };
}

export function buildHotkeyPayload(
  label: string,
  chords: readonly string[],
  waitMsRaw: string,
): BuildResult {
  if (chords.length === 0) {
    return { Ok: false, ErrorMessage: "Add at least one key combination for the Hotkey step." };
  }

  const parsedWait = parseNonNegativeMs(waitMsRaw, "Wait (ms)");

  if (parsedWait.Ok) {
    return { Ok: false, ErrorMessage: parsedWait.message }; 
  }

  const payload = parsedWait.value === undefined
    ? { Keys: [...chords] }
    : { Keys: [...chords], WaitMs: parsedWait.value };

  return {
    Ok: true,
    Input: {
      StepKindId: StepKindId.Hotkey,
      LabelType: normaliseLabel(label),
      PayloadJson: JSON.stringify(payload),
      TargetStepGroupId: null,
    },
  };
}

function validateUrlTabClickForm(form: UrlTabClickFormState): BuildResult | null {
  if (form.UrlPattern.trim() === "") {
    return { Ok: false, ErrorMessage: "URL pattern is required." };
  }

  if (form.DirectOpen && form.OperationModeType !== "OpenNew") {
    return { Ok: false, ErrorMessage: "DirectOpen requires OperationModeType = 'OpenNew'." };
  }

  if (form.DirectOpen && form.Url.trim() === "") {
    return { Ok: false, ErrorMessage: "DirectOpen requires a literal URL." };
  }

  if (form.UrlMatch === "Regex") {
    try {
      new RegExp(form.UrlPattern); 
    } catch (err) {
      const description = err instanceof Error ? err.message : String(err);

      return { Ok: false, ErrorMessage: "Invalid regex pattern", ErrorDescription: description };
    }
  }

  return null;
}

function buildUrlTabClickPayloadObject(form: UrlTabClickFormState, timeoutMs: number | undefined): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    UrlPattern: form.UrlPattern.trim(),
    UrlMatch:   form.UrlMatch,
    OperationModeType:       form.OperationModeType,
  };

  if (form.Selector.trim() !== "") {
    payload.Selector = form.Selector.trim(); 
  }

  if (form.SelectorKind !== "Auto") {
    payload.SelectorKind = form.SelectorKind; 
  }

  if (timeoutMs !== undefined) {
    payload.TimeoutMs = timeoutMs; 
  }

  if (form.DirectOpen) {
    payload.DirectOpen = true; 
  }

  if (form.Url.trim() !== "") {
    payload.Url = form.Url.trim(); 
  }

  return payload;
}

export function buildUrlTabClickPayload(label: string, form: UrlTabClickFormState): BuildResult {
  const validation = validateUrlTabClickForm(form);

  if (validation !== null) {
    return validation; 
  }

  const parsedTimeout = parseNonNegativeMs(form.TimeoutMs, "Timeout (ms)");

  if (parsedTimeout.Ok) {
    return { Ok: false, ErrorMessage: parsedTimeout.message }; 
  }

  const payload = buildUrlTabClickPayloadObject(form, parsedTimeout.value);

  return {
    Ok: true,
    Input: {
      StepKindId: StepKindId.UrlTabClick,
      LabelType: normaliseLabel(label),
      PayloadJson: JSON.stringify(payload),
      TargetStepGroupId: null,
    },
  };
}

function validateGenericPayload(kind: StepKindId, payloadJson: string, targetGroupId: number | null): BuildResult | null {
  const trimmed = payloadJson.trim();

  if (trimmed !== "" && kind !== StepKindId.RunGroup) {
    try {
      JSON.parse(trimmed); 
    } catch (err) {
      const description = err instanceof Error ? err.message : String(err);

      return { Ok: false, ErrorMessage: "Payload is not valid JSON", ErrorDescription: description };
    }
  }

  if (kind === StepKindId.RunGroup && targetGroupId === null) {
    return { Ok: false, ErrorMessage: "Select a target group for the RunGroup step." };
  }

  return null;
}

export function buildGenericPayload(
  kind: StepKindId,
  label: string,
  payloadJson: string,
  targetGroupId: number | null,
): BuildResult {
  const invalid = validateGenericPayload(kind, payloadJson, targetGroupId);

  if (invalid !== null) {
    return invalid; 
  }

  const trimmed = payloadJson.trim();

  return {
    Ok: true,
    Input: {
      StepKindId: kind,
      LabelType: normaliseLabel(label),
      PayloadJson: trimmed === "" ? null : trimmed,
      TargetStepGroupId: kind === StepKindId.RunGroup ? targetGroupId : null,
    },
  };
}

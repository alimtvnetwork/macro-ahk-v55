/**
 * Marco Extension — XPath Recorder Handler
 *
 * Handles TOGGLE_XPATH_RECORDER, GET_RECORDED_XPATHS,
 * CLEAR_RECORDED_XPATHS, TEST_XPATH messages.
 *
 * TOGGLE_XPATH_RECORDER is a thin alias for the canonical recorder toggle
 * (the same path as the Ctrl/Cmd+Shift+R shortcut): the recorderReducer in
 * `../recorder/recorder-store` is the single source of truth. The previous
 * in-memory isRecording state machine was retired (D5) — it could never
 * observe sessions started by the shortcut, toolbar, or UI.
 *
 * @see ../shortcut-command-handler — canonical toggle
 * @see ../recorder/recorder-store — canonical state machine
 * @see spec/05-chrome-extension/07-advanced-features.md §XPath Recorder
 * @see spec/05-chrome-extension/05-content-script-adaptation.md — Content script adaptation
 */

import type { MessageRequest, OkResponse } from "../../shared/messages";
import type { RecordedXPath } from "../../shared/xpath-types";
import { loadSession } from "../recorder/recorder-session-storage";
import { toggleRecordingFromShortcut } from "../shortcut-command-handler";

/* ------------------------------------------------------------------ */
/*  Module State                                                       */
/* ------------------------------------------------------------------ */

let recordedXPaths: RecordedXPath[] = [];

/** Resets XPath handler state (for testing). */
export function resetXPathState(): void {
  recordedXPaths = [];
}

/* ------------------------------------------------------------------ */
/*  TOGGLE_XPATH_RECORDER                                              */
/* ------------------------------------------------------------------ */

/**
 * Legacy toggle — aliases to the canonical recorder toggle so every entry
 * point (shortcut, toolbar, UI, this message) drives one state machine.
 */
export async function handleToggleXPathRecorder(
  _message: MessageRequest,
  _sender: chrome.runtime.MessageSender,
): Promise<{ isRecording: boolean }> {
  await toggleRecordingFromShortcut();
  const session = await loadSession();

  return { isRecording: session !== null && session.Phase !== "Idle" };
}

/* ------------------------------------------------------------------ */
/*  GET_RECORDED_XPATHS                                                */
/* ------------------------------------------------------------------ */

/** Returns all recorded XPaths from the current session. */
export async function handleGetRecordedXPaths(
  _message: MessageRequest,
  _sender: chrome.runtime.MessageSender,
): Promise<{ recorded: RecordedXPath[]; isRecording: boolean }> {
  const session = await loadSession();

  return {
    recorded: recordedXPaths,
    isRecording: session !== null && session.Phase !== "Idle",
  };
}

/* ------------------------------------------------------------------ */
/*  CLEAR_RECORDED_XPATHS                                              */
/* ------------------------------------------------------------------ */

/** Clears all recorded XPaths. */
export async function handleClearRecordedXPaths(
  _message: MessageRequest,
  _sender: chrome.runtime.MessageSender,
): Promise<OkResponse> {
  recordedXPaths = [];

  return { isOk: true };
}
/* ------------------------------------------------------------------ */
/*  Re-export TEST_XPATH from split file                               */
/* ------------------------------------------------------------------ */

export { handleTestXPath } from "./xpath-test-handler";

/* ------------------------------------------------------------------ */
/*  Incoming XPath Records (from content script)                       */
/* ------------------------------------------------------------------ */

/** Adds a recorded XPath entry from the content script. */
export function addRecordedXPath(entry: RecordedXPath): void {
  recordedXPaths.push(entry);
}

/**
 * Marco Extension — Hotkey Step Executor
 *
 * AutoHotkey-style chord macro replayer for `StepKindId.Hotkey`. Each
 * payload contains an ordered list of chords (e.g. `"Ctrl+S"`,
 * `"Tab"`, `"Enter"`) plus an optional `WaitMs` to pause after the
 * final chord.
 *
 * The replayer dispatches synthetic `KeyboardEvent`s on the document
 * (or a target element when `Selector` is given) — keydown then keyup
 * for each chord, with modifiers held for the duration of the keydown.
 *
 * Pure function over the parsed payload — DOM dispatch is wrapped so
 * tests can substitute a recorder.
 *
 * @see ./schema.ts                 — StepKindId.Hotkey definition
 * @see ../recorder-store.ts        — Hotkey step capture
 */

export interface HotkeyPayload {
    /** Ordered list of chord strings, e.g. ["Ctrl+S", "Tab", "Enter"]. */
    readonly Keys: readonly string[];
    /** Optional pause (ms) after the final chord. Default 0. */
    readonly WaitMs?: number;
    /** Optional CSS selector to focus before dispatch. */
    readonly Selector?: string;
}

export interface ParsedChord {
    readonly Key: string;
    readonly Code: string;
    readonly CtrlKey: boolean;
    readonly AltKey: boolean;
    readonly ShiftKey: boolean;
    readonly MetaKey: boolean;
}

const MODIFIERS = new Set(["ctrl", "control", "alt", "shift", "meta", "cmd", "command", "super", "win"]);

function parseModifier(part: string): Partial<ParsedChord> | null {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") return { CtrlKey: true };
    if (lower === "alt") return { AltKey: true };
    if (lower === "shift") return { ShiftKey: true };
    if (["meta", "cmd", "command", "super", "win"].includes(lower)) return { MetaKey: true };
    return MODIFIERS.has(lower) ? {} : null;
}

function assignModifier(chord: ParsedChord, modifier: Partial<ParsedChord>): ParsedChord {
    return { ...chord, ...modifier };
}

/** Parse a chord string ("Ctrl+Shift+S") into its keyboard-event parts. */
export function parseChord(chord: string): ParsedChord {
    const trimmed = chord.trim();
    if (trimmed === "") {
        throw new Error(`parseChord: empty chord string`);
    }
    const parts = trimmed.split("+").map((p) => p.trim()).filter((p) => p !== "");
    const parsed = parseChordParts(chord, parts);
    return {
        ...parsed,
        Code: keyToCode(parsed.Key),
    };
}

function parseChordParts(chord: string, parts: readonly string[]): ParsedChord {
    let parsed = emptyParsedChord();
    for (const part of parts) {
        const modifier = parseModifier(part);
        if (modifier !== null) {
            parsed = assignModifier(parsed, modifier);
        } else {
            parsed = assignChordKey(chord, parsed, part);
        }
    }
    return requireChordKey(chord, parsed);
}

function emptyParsedChord(): ParsedChord {
    return { Key: "", Code: "", CtrlKey: false, AltKey: false, ShiftKey: false, MetaKey: false };
}

function assignChordKey(chord: string, parsed: ParsedChord, part: string): ParsedChord {
    if (parsed.Key !== "") {
        throw new Error(`parseChord: chord "${chord}" has multiple non-modifier keys ("${parsed.Key}" and "${part}")`);
    }
    return { ...parsed, Key: part };
}

function requireChordKey(chord: string, parsed: ParsedChord): ParsedChord {
    if (parsed.Key === "") {
        throw new Error(`parseChord: chord "${chord}" has no non-modifier key`);
    }
    return parsed;
}

function keyToCode(key: string): string {
    if (key.length === 1) {
        const upper = key.toUpperCase();
        if (upper >= "A" && upper <= "Z") return `Key${upper}`;
        if (upper >= "0" && upper <= "9") return `Digit${upper}`;
    }
    const map: Record<string, string> = {
        Enter: "Enter", Tab: "Tab", Escape: "Escape", Esc: "Escape",
        Space: "Space", Backspace: "Backspace", Delete: "Delete",
        ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight",
        Up: "ArrowUp", Down: "ArrowDown", Left: "ArrowLeft", Right: "ArrowRight",
        Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
    };
    return map[key] ?? key;
}

/** Validate + normalise a payload. Throws with a precise reason on failure. */
export function parseHotkeyPayload(json: string | null): HotkeyPayload {
    if (json === null || json.trim() === "") {
        throw new Error("Hotkey step has empty PayloadJson — expected { Keys: [...] }");
    }
    let raw: unknown;
    try { raw = JSON.parse(json); } catch (err) {
        throw new Error(`Hotkey step has invalid PayloadJson: ${(err as Error).message}`);
    }
    if (typeof raw !== "object" || raw === null) {
        throw new Error("Hotkey PayloadJson must be a JSON object");
    }
    const payloadRecord = raw as Record<string, unknown>;
    const keys = payloadRecord.Keys;
    if (!Array.isArray(keys) || keys.length === 0) {
        throw new Error("Hotkey PayloadJson.Keys must be a non-empty array of chord strings");
    }
    for (const k of keys) {
        if (typeof k !== "string") {
            throw new Error(`Hotkey PayloadJson.Keys entries must be strings, got ${typeof k}`);
        }
    }
    const waitMs = payloadRecord.WaitMs;
    if (waitMs !== undefined && (typeof waitMs !== "number" || !Number.isFinite(waitMs) || waitMs < 0)) {
        throw new Error("Hotkey PayloadJson.WaitMs must be a non-negative number when present");
    }
    const selector = payloadRecord.Selector;
    if (selector !== undefined && typeof selector !== "string") {
        throw new Error("Hotkey PayloadJson.Selector must be a string when present");
    }
    return {
        Keys: keys as readonly string[],
        WaitMs: typeof waitMs === "number" ? waitMs : undefined,
        Selector: typeof selector === "string" ? selector : undefined,
    };
}

/* ------------------------------------------------------------------ */
/*  DOM dispatch                                                       */
/* ------------------------------------------------------------------ */

export interface HotkeyDispatchEnv {
    readonly document: Pick<Document, "querySelector" | "dispatchEvent">;
    readonly setTimeout: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
    readonly clearTimeout: (timerId: ReturnType<typeof setTimeout>) => void;
}

/** Dispatch one parsed chord as a keydown+keyup pair. */
export function dispatchChord(env: HotkeyDispatchEnv, chord: ParsedChord, target?: Element | null): void {
    const init: KeyboardEventInit = {
        key: chord.Key,
        code: chord.Code,
        ctrlKey: chord.CtrlKey,
        altKey: chord.AltKey,
        shiftKey: chord.ShiftKey,
        metaKey: chord.MetaKey,
        bubbles: true,
        cancelable: true,
    };
    const down = new KeyboardEvent("keydown", init);
    const up = new KeyboardEvent("keyup", init);
    const sink = target ?? (env.document as unknown as EventTarget);
    sink.dispatchEvent(down);
    sink.dispatchEvent(up);
}

function waitForHotkeyDelay(env: HotkeyDispatchEnv, ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
        let timerId: ReturnType<typeof setTimeout> | null = null;
        const finish = (): void => {
            if (timerId !== null) {
                env.clearTimeout(timerId);
                timerId = null;
            }
            resolve();
        };
        timerId = env.setTimeout(finish, ms);
    });
}

/**
 * Execute a Hotkey step end-to-end. Each chord is dispatched with a
 * 16ms gap; the final WaitMs (default 0) gates the promise so the
 * replayer waits before continuing — this is what gives Hotkey its
 * AutoHotkey-style "send-then-wait" semantics.
 */
export async function executeHotkeyStep(
    payload: HotkeyPayload,
    env?: Partial<HotkeyDispatchEnv>,
): Promise<void> {
    const dispatchEnv: HotkeyDispatchEnv = {
        document: env?.document ?? (typeof document === "undefined" ? null as unknown as Document : document),
        setTimeout: env?.setTimeout ?? ((cb, ms) => setTimeout(cb, ms)),
        clearTimeout: env?.clearTimeout ?? ((timerId) => clearTimeout(timerId)),
    };
    if (dispatchEnv.document === null) {
        throw new Error("executeHotkeyStep: no document available — cannot dispatch keyboard events");
    }
    const target = payload.Selector !== undefined && payload.Selector !== ""
        ? dispatchEnv.document.querySelector(payload.Selector)
        : null;
    if (payload.Selector !== undefined && payload.Selector !== "" && target === null) {
        throw new Error(`Hotkey step: target selector "${payload.Selector}" did not match any element`);
    }
    for (let i = 0; i < payload.Keys.length; i++) {
        const chord = parseChord(payload.Keys[i]);
        dispatchChord(dispatchEnv, chord, target);
        if (i < payload.Keys.length - 1) {
            await waitForHotkeyDelay(dispatchEnv, 16);
        }
    }
    const wait = payload.WaitMs ?? 0;
    if (wait > 0) {
        await waitForHotkeyDelay(dispatchEnv, wait);
    }
}

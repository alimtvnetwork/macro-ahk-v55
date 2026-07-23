/**
 * Hotkey-kind subform for StepEditorDialog. Extracted to shrink the
 * host component and keep its render function within the
 * max-lines-per-function budget.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HotkeyChordCapture } from "@/components/recorder/HotkeyChordCapture";

export interface HotkeyFieldsProps {
    readonly chords: readonly string[];
    readonly waitMs: string;
    readonly onChordsChange: (chords: readonly string[]) => void;
    readonly onWaitMsChange: (value: string) => void;
}

export function HotkeyFields(props: HotkeyFieldsProps): JSX.Element {
    const { chords, waitMs, onChordsChange, onWaitMsChange } = props;
    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <Label htmlFor="hotkey-capture">Key combinations</Label>
                <HotkeyChordCapture
                    id="hotkey-capture"
                    value={chords}
                    onChange={onChordsChange}
                />
                <p className="text-[11px] text-muted-foreground">
                    Each chord is dispatched in order during playback (AutoHotkey-style).
                    Backspace removes the last chord; Esc stops listening.
                </p>
            </div>
            <div className="space-y-1">
                <Label htmlFor="hotkey-wait">Wait after (ms, optional)</Label>
                <Input
                    id="hotkey-wait"
                    type="number"
                    min={0}
                    value={waitMs}
                    placeholder="e.g. 500"
                    onChange={(event) => onWaitMsChange(event.target.value)}
                />
            </div>
        </div>
    );
}

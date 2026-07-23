/**
 * Two-column footer for {@link KeywordEventCard} that lets a user append a
 * new Key or Wait step. Extracted in Plan 25 Step 14 so the parent stays
 * under the line/complexity ceilings.
 *
 * Owns its own draft state — parent only receives fully-validated adds.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { validateCombo, validateWait } from "@/lib/keyword-event-validation";
import type { KeywordEventStep } from "@/hooks/use-keyword-events";

const CSS_TEXT_DESTRUCTIVE = "text-destructive";
const CSS_INPUT_INVALID = "border-destructive focus-visible:ring-destructive";

export interface KeywordEventAddStepControlsProps {
    readonly eventId: string;
    readonly onAddStep: (step: Omit<KeywordEventStep, "Id">) => void;
}

// eslint-disable-next-line max-lines-per-function -- JSX-heavy leaf; Plan 25 Step 14
export function KeywordEventAddStepControls(props: KeywordEventAddStepControlsProps): JSX.Element {
    const { eventId, onAddStep } = props;
    const [keyCombo, setKeyCombo] = useState("");
    const [waitMs, setWaitMs] = useState("500");

    const comboValidation = validateCombo(keyCombo);
    const waitValidation = validateWait(waitMs);
    const comboShowError = keyCombo.length > 0 && !comboValidation.Valid;

    return (
        <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                    <Input
                        value={keyCombo}
                        onChange={(inputEvent) => setKeyCombo(inputEvent.target.value)}
                        placeholder="Enter / Ctrl+Tab"
                        className={cn("h-8 text-xs", comboShowError && CSS_INPUT_INVALID)}
                        aria-label="Key combo"
                        aria-invalid={comboShowError ? true : undefined}
                        data-testid={`keyword-event-key-input-${eventId}`}
                    />
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 shrink-0"
                        disabled={!comboValidation.Valid}
                        onClick={() => {
                            if (!comboValidation.Valid) { return; }
                            onAddStep({ Kind: "Key", Combo: keyCombo.trim() } as Omit<KeywordEventStep, "Id">);
                            setKeyCombo("");
                        }}
                        data-testid={`keyword-event-key-add-${eventId}`}
                        title={comboValidation.Valid ? "Add key step" : comboValidation.Message}
                    >
                        <Plus className="h-3 w-3 mr-1" /> Key
                    </Button>
                </div>
                {comboShowError && (
                    <p className={cn("text-[10px]", CSS_TEXT_DESTRUCTIVE)} data-testid={`keyword-event-key-error-${eventId}`}>
                        {comboValidation.Message}
                    </p>
                )}
            </div>
            <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                    <Input
                        type="number"
                        min={0}
                        value={waitMs}
                        onChange={(inputEvent) => setWaitMs(inputEvent.target.value)}
                        placeholder="ms"
                        className={cn("h-8 text-xs", !waitValidation.Valid && CSS_INPUT_INVALID)}
                        aria-label="Wait duration in milliseconds"
                        aria-invalid={!waitValidation.Valid ? true : undefined}
                        data-testid={`keyword-event-wait-input-${eventId}`}
                    />
                    <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 shrink-0"
                        disabled={!waitValidation.Valid}
                        onClick={() => {
                            if (!waitValidation.Valid) { return; }
                            onAddStep({ Kind: "Wait", DurationMs: waitValidation.Ms } as Omit<KeywordEventStep, "Id">);
                        }}
                        data-testid={`keyword-event-wait-add-${eventId}`}
                        title={waitValidation.Valid ? "Add wait step" : waitValidation.Message}
                    >
                        <Plus className="h-3 w-3 mr-1" /> Wait
                    </Button>
                </div>
                {!waitValidation.Valid && (
                    <p className={cn("text-[10px]", CSS_TEXT_DESTRUCTIVE)} data-testid={`keyword-event-wait-error-${eventId}`}>
                        {waitValidation.Message}
                    </p>
                )}
            </div>
        </div>
    );
}

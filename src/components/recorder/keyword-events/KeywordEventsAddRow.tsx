/**
 * Header input row for adding a new keyword event. Extracted from
 * `KeywordEventsPanel.tsx` in Plan 25 Step 15.
 */

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface KeywordEventsAddRowProps {
    readonly value: string;
    readonly onChange: (next: string) => void;
    readonly onAdd: () => void;
}

export function KeywordEventsAddRow(props: KeywordEventsAddRowProps): JSX.Element {
    const { value, onChange, onAdd } = props;
    return (
        <div className="flex items-center gap-2">
            <Input
                value={value}
                onChange={(inputEvent) => onChange(inputEvent.target.value)}
                placeholder="New keyword (e.g. submit-form)"
                onKeyDown={(keyEvent) => {
                    if (keyEvent.key === "Enter") { keyEvent.preventDefault(); onAdd(); }
                }}
                className="h-9"
                data-testid="keyword-events-new-input"
            />
            <Button onClick={onAdd} disabled={!value.trim()} size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
        </div>
    );
}

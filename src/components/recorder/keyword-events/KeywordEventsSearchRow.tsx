/**
 * Search input row for filtering keyword events. Extracted from
 * `KeywordEventsPanel.tsx` in Plan 25 Step 15.
 */

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface KeywordEventsSearchRowProps {
    readonly value: string;
    readonly onChange: (next: string) => void;
}

export function KeywordEventsSearchRow(props: KeywordEventsSearchRowProps): JSX.Element {
    const { value, onChange } = props;
    const isFiltering = value.trim().length > 0;
    return (
        <div className="relative" data-testid="keyword-events-search-row">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={value}
                onChange={(inputEvent) => onChange(inputEvent.target.value)}
                placeholder="Search by keyword, description, or tag…"
                aria-label="Search keyword events"
                className="h-8 pl-7 pr-7 text-xs"
                data-testid="keyword-events-search-input"
            />
            {isFiltering && (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    data-testid="keyword-events-search-clear"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </div>
    );
}

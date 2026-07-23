/**
 * Token Seeder Status Indicator
 *
 * Compact row for the System Status panel that surfaces JWT seed
 * failures on inaccessible tabs and shows a live countdown until the
 * next retry attempt across all blocked tabs.
 *
 * Hides itself when no tabs are currently throttled. Clicking the row
 * toggles an inline expandable details drawer that lists every blocked
 * tab, its tabId, origin URL, classified failure reason, and how many
 * times Chrome has rejected the seed attempt.
 *
 * Plan 25 · Step 9: state + polling + memoised derivations moved to
 * `useTokenSeederDiagnostics`; per-tab drawer moved to
 * `TokenSeederDetailsList`. This file keeps only the trigger + drawer
 * composition.
 */

import { useState, type JSX } from "react";
import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ShieldOff, Timer, ChevronDown } from "lucide-react";
import { TokenSeederDetailsList } from "./TokenSeederDetailsList";
import {
    CATEGORY_LABELS,
    formatRemaining,
    formatRetryTimestamp,
    useTokenSeederDiagnostics,
    type TokenSeederDiagnosticsBag,
} from "./use-token-seeder-diagnostics";

function buildTooltip(bag: TokenSeederDiagnosticsBag): string {
    const { targets, nextRetryMs, nextRetryAt, categoryCounts } = bag;
    const summary = Array.from(categoryCounts.entries())
        .map(([cat, count]) => `${CATEGORY_LABELS[cat]}: ${count}`)
        .join(" · ");
    const retryLine = nextRetryMs <= 0
        ? "Retrying on next poll."
        : `Next retry at ${formatRetryTimestamp(nextRetryAt)} (in ${formatRemaining(nextRetryMs)}).`;
    return (
        `${targets.length} tab(s) blocked Chrome scripting access.\n` +
        `Categories, ${summary || "Unknown"}.\n` +
        `${retryLine}\n` +
        `Click to view per-tab details.`
    );
}

function TokenSeederTriggerButton(props: {
    readonly bag: TokenSeederDiagnosticsBag;
    readonly open: boolean;
}): JSX.Element {
    const { bag, open } = props;
    const { targets, nextRetryMs } = bag;
    const isReady = nextRetryMs <= 0;
    return (
        <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-left transition-colors hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={buildTooltip(bag)}
            aria-label="Toggle token seeder failure details"
        >
            <div className="flex items-center gap-2 min-w-0">
                <ShieldOff className="h-4 w-4 text-warning shrink-0" />
                <span className="text-sm">Token Seed Blocked</span>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                    {targets.length} tab{targets.length === 1 ? "" : "s"}
                </Badge>
                <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                    <Timer className="h-3 w-3" />
                    {isReady ? "retrying..." : `retry in ${formatRemaining(nextRetryMs)}`}
                </span>
                <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                />
            </div>
        </button>
    );
}

export function TokenSeederStatusIndicator(): JSX.Element | null {
    const bag = useTokenSeederDiagnostics();
    const [open, setOpen] = useState(false);

    if (bag.targets.length === 0) return null;

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
                <TokenSeederTriggerButton bag={bag} open={open} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <TokenSeederDetailsList targets={bag.targets} now={bag.now} />
            </CollapsibleContent>
        </Collapsible>
    );
}

export default TokenSeederStatusIndicator;

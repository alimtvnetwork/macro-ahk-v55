/**
 * Token Seeder details list — per-tab breakdown drawer.
 *
 * Extracted from `TokenSeederStatusIndicator.tsx` (Plan 25 · Step 9).
 * Pure presentation; parent supplies the targets + `now` tick.
 */

import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { formatOrigin, formatRemaining, type InaccessibleSeedTarget } from "./use-token-seeder-diagnostics";

interface Props {
    readonly targets: ReadonlyArray<InaccessibleSeedTarget>;
    readonly now: number;
}

export function TokenSeederDetailsList(props: Props): JSX.Element {
    const { targets, now } = props;
    return (
        <div className="mt-2 rounded-md border border-warning/30 bg-background/40">
            <ul
                className="divide-y divide-border max-h-64 overflow-y-auto"
                aria-label="Blocked tabs"
            >
                {targets.map((t) => (
                    <TokenSeederDetailsRow key={t.tabId} target={t} now={now} />
                ))}
            </ul>
        </div>
    );
}

function TokenSeederDetailsRow(props: { readonly target: InaccessibleSeedTarget; readonly now: number }): JSX.Element {
    const { target: t, now } = props;
    const remaining = Math.max(0, t.cooldownMs - (now - t.lastFailureAt));
    return (
        <li
            className="px-3 py-2 text-xs space-y-1"
            data-tab-id={t.tabId}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-muted-foreground">tab #{t.tabId}</span>
                <Badge variant="outline" className="text-[10px]">
                    {t.attemptCount} attempt{t.attemptCount === 1 ? "" : "s"}
                </Badge>
            </div>
            <div className="truncate text-foreground" title={t.tabUrl || "(unknown)"}>
                {formatOrigin(t.tabUrl)}
            </div>
            <div className="text-warning/90 break-words" title={t.reason}>
                <span className="font-mono text-[10px] uppercase tracking-wide text-warning">
                    {t.code}
                </span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span>{t.reason}</span>
            </div>
            <div className="flex items-center justify-end text-[10px] font-mono text-muted-foreground">
                {remaining <= 0 ? "ready to retry" : `next retry in ${formatRemaining(remaining)}`}
            </div>
        </li>
    );
}

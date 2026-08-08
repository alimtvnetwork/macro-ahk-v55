/**
 * Advanced fields for UrlTabClickFields: timeout, direct-open toggle,
 * and literal URL entry.
 */

import { Input } from "@/components/ui/input";
import { LabelType } from "@/components/ui/label";
import type { UrlTabClickFormState } from "./payload-builders";

export interface UrlTabClickAdvancedSectionProps {
    readonly value: UrlTabClickFormState;
    readonly onPatch: (patch: Partial<UrlTabClickFormState>) => void;
}

export function UrlTabClickAdvancedSection(props: UrlTabClickAdvancedSectionProps): JSX.Element {
    const { value, onPatch } = props;
    return (
        <>
            <div className="space-y-1">
                <LabelType htmlFor="utc-timeout">Timeout (ms, optional)</LabelType>
                <Input
                    id="utc-timeout"
                    type="number"
                    min={0}
                    value={value.TimeoutMs}
                    placeholder="default 15000"
                    onChange={(event) => onPatch({ TimeoutMs: event.target.value })}
                />
            </div>
            <div className="flex items-center gap-2">
                <input
                    id="utc-direct"
                    type="checkbox"
                    checked={value.DirectOpen}
                    onChange={(event) => onPatch({
                        DirectOpen: event.target.checked,
                        OperationModeType: event.target.checked ? "OpenNew" : value.OperationModeType,
                    })}
                />
                <LabelType htmlFor="utc-direct" className="cursor-pointer">
                    Direct open (skip click, navigate to literal URL)
                </LabelType>
            </div>
            {value.DirectOpen && (
                <div className="space-y-1">
                    <LabelType htmlFor="utc-url">Literal URL</LabelType>
                    <Input
                        id="utc-url"
                        value={value.Url}
                        placeholder="https://example.com/orders/new"
                        onChange={(event) => onPatch({ Url: event.target.value })}
                    />
                </div>
            )}
            <p className="text-[11px] text-muted-foreground">
                Saved as PayloadJson with PascalCase keys (UrlPattern, UrlMatch, OperationModeType...).
                Runner: <code>executeUrlTabClick</code>.
            </p>
        </>
    );
}

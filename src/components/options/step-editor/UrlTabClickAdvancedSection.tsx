/**
 * Advanced fields for UrlTabClickFields: timeout, direct-open toggle,
 * and literal URL entry.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
                <Label htmlFor="utc-timeout">Timeout (ms, optional)</Label>
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
                        Mode: event.target.checked ? "OpenNew" : value.Mode,
                    })}
                />
                <Label htmlFor="utc-direct" className="cursor-pointer">
                    Direct open (skip click, navigate to literal URL)
                </Label>
            </div>
            {value.DirectOpen && (
                <div className="space-y-1">
                    <Label htmlFor="utc-url">Literal URL</Label>
                    <Input
                        id="utc-url"
                        value={value.Url}
                        placeholder="https://example.com/orders/new"
                        onChange={(event) => onPatch({ Url: event.target.value })}
                    />
                </div>
            )}
            <p className="text-[11px] text-muted-foreground">
                Saved as PayloadJson with PascalCase keys (UrlPattern, UrlMatch, Mode...).
                Runner: <code>executeUrlTabClick</code>.
            </p>
        </>
    );
}

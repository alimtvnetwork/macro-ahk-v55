/**
 * URL pattern + match dialect row for UrlTabClickFields.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { UrlMatchDialect, UrlTabClickFormState } from "./payload-builders";

export interface UrlTabClickPatternRowProps {
    readonly value: UrlTabClickFormState;
    readonly onPatch: (patch: Partial<UrlTabClickFormState>) => void;
}

export function UrlTabClickPatternRow(props: UrlTabClickPatternRowProps): JSX.Element {
    const { value, onPatch } = props;
    return (
        <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1 col-span-2">
                <Label htmlFor="utc-pattern">URL pattern</Label>
                <Input
                    id="utc-pattern"
                    value={value.UrlPattern}
                    placeholder="https://example.com/orders/*"
                    onChange={(event) => onPatch({ UrlPattern: event.target.value })}
                />
            </div>
            <div className="space-y-1">
                <Label htmlFor="utc-match">Match</Label>
                <Select
                    value={value.UrlMatch}
                    onValueChange={(v) => onPatch({ UrlMatch: v as UrlMatchDialect })}
                >
                    <SelectTrigger id="utc-match"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Exact">Exact</SelectItem>
                        <SelectItem value="Prefix">Prefix</SelectItem>
                        <SelectItem value="Glob">Glob</SelectItem>
                        <SelectItem value="Regex">Regex</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

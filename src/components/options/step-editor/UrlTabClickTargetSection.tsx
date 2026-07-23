/**
 * Mode + selector + selector-kind fields for UrlTabClickFields.
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
import type {
    SelectorKindOption,
    UrlTabClickFormState,
    UrlTabClickMode,
} from "./payload-builders";

export interface UrlTabClickTargetSectionProps {
    readonly value: UrlTabClickFormState;
    readonly onPatch: (patch: Partial<UrlTabClickFormState>) => void;
}

export function UrlTabClickTargetSection(props: UrlTabClickTargetSectionProps): JSX.Element {
    const { value, onPatch } = props;
    return (
        <>
            <div className="space-y-1">
                <Label htmlFor="utc-mode">Mode</Label>
                <Select
                    value={value.Mode}
                    onValueChange={(v) => onPatch({ Mode: v as UrlTabClickMode })}
                >
                    <SelectTrigger id="utc-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="OpenNew">Open new tab</SelectItem>
                        <SelectItem value="FocusExisting">Focus existing tab</SelectItem>
                        <SelectItem value="OpenOrFocus">Focus existing, else open</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-2">
                    <Label htmlFor="utc-selector">Selector (optional)</Label>
                    <Input
                        id="utc-selector"
                        value={value.Selector}
                        placeholder="#open-orders, //a[@data-id]"
                        onChange={(event) => onPatch({ Selector: event.target.value })}
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="utc-sel-kind">Selector kind</Label>
                    <Select
                        value={value.SelectorKind}
                        onValueChange={(v) => onPatch({ SelectorKind: v as SelectorKindOption })}
                    >
                        <SelectTrigger id="utc-sel-kind"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Auto">Auto</SelectItem>
                            <SelectItem value="Css">CSS</SelectItem>
                            <SelectItem value="XPath">XPath</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </>
    );
}

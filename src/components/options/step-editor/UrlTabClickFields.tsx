/**
 * UrlTabClick-kind subform. Composes three subsections
 * (pattern row, target section, advanced section) to stay within the
 * max-lines-per-function budget.
 */

import type { UrlTabClickFormState } from "./payload-builders";
import { UrlTabClickPatternRow } from "./UrlTabClickPatternRow";
import { UrlTabClickTargetSection } from "./UrlTabClickTargetSection";
import { UrlTabClickAdvancedSection } from "./UrlTabClickAdvancedSection";

export interface UrlTabClickFieldsProps {
    readonly value: UrlTabClickFormState;
    readonly onPatch: (patch: Partial<UrlTabClickFormState>) => void;
}

export function UrlTabClickFields(props: UrlTabClickFieldsProps): JSX.Element {
    const { value, onPatch } = props;
    return (
        <div className="space-y-3">
            <UrlTabClickPatternRow value={value} onPatch={onPatch} />
            <UrlTabClickTargetSection value={value} onPatch={onPatch} />
            <UrlTabClickAdvancedSection value={value} onPatch={onPatch} />
        </div>
    );
}

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type {
    StepRow,
    SelectorRow,
    DataSourceRow,
    FieldBindingRow,
    StepLinkSlot,
} from "@/hooks/use-recorder-project-data";

const SELECTOR_KIND_LABEL: Record<number, string> = {
    1: "XPathFull",
    2: "XPathRelative",
    3: "Css",
    4: "Aria",
};

interface SectionHeadingProps { children: React.ReactNode }
export function SectionHeading({ children }: SectionHeadingProps): JSX.Element {
    return (
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {children}
        </h3>
    );
}

interface VariableSectionProps {
    step: StepRow;
    draftName: string;
    setDraftName: (value: string) => void;
    isDirty: boolean;
    isSaving: boolean;
    renameError: string | null;
    onSave: () => void;
}

export function VariableSection(props: VariableSectionProps): JSX.Element {
    const { step, draftName, setDraftName, isDirty, isSaving, renameError, onSave } = props;
    return (
        <section className="space-y-2">
            <SectionHeading>Variable</SectionHeading>
            <div className="flex gap-2">
                <Input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    className="font-mono text-sm h-8"
                />
                <Button size="sm" onClick={onSave} disabled={!isDirty || isSaving}>
                    {isSaving ? "Saving..." : "Rename"}
                </Button>
            </div>
            {renameError && <p className="text-xs text-destructive font-mono">{renameError}</p>}
            <div className="text-[10px] text-muted-foreground font-mono">
                StepId={step.StepId} - OrderIndex={step.OrderIndex} - Captured {step.CapturedAt}
            </div>
        </section>
    );
}

interface DescriptionSectionProps {
    draftDesc: string;
    setDraftDesc: (value: string) => void;
    isDescDirty: boolean;
    descSaving: boolean;
    descError: string | null;
    onSave: () => void;
}

export function DescriptionSection(props: DescriptionSectionProps): JSX.Element {
    const { draftDesc, setDraftDesc, isDescDirty, descSaving, descError, onSave } = props;
    return (
        <section className="space-y-2">
            <SectionHeading>Description</SectionHeading>
            <Textarea
                value={draftDesc}
                onChange={(event) => setDraftDesc(event.target.value)}
                rows={2}
                placeholder="Optional notes about this step..."
                className="text-xs"
            />
            <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={onSave} disabled={!isDescDirty || descSaving}>
                    {descSaving ? "Saving..." : "Save description"}
                </Button>
                {descError && <span className="text-xs text-destructive font-mono">{descError}</span>}
            </div>
        </section>
    );
}

interface TagsSectionProps {
    tags: ReadonlyArray<string>;
    draftTag: string;
    setDraftTag: (value: string) => void;
    tagsError: string | null;
    onAdd: () => void;
    onRemove: (name: string) => void;
}

export function TagsSection(props: TagsSectionProps): JSX.Element {
    const { tags, draftTag, setDraftTag, tagsError, onAdd, onRemove } = props;
    return (
        <section className="space-y-2">
            <SectionHeading>Tags ({tags.length})</SectionHeading>
            <div className="flex flex-wrap gap-1.5">
                {tags.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No tags.</span>
                )}
                {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-[10px] font-mono">
                        {tag}
                        <button type="button" onClick={() => onRemove(tag)} aria-label={`Remove tag ${tag}`} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
            </div>
            <div className="flex gap-2">
                <Input
                    value={draftTag}
                    onChange={(event) => setDraftTag(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onAdd(); } }}
                    placeholder="Add tag..."
                    className="font-mono text-xs h-8"
                />
                <Button size="sm" variant="outline" onClick={onAdd} disabled={draftTag.trim().length === 0}>
                    Add
                </Button>
            </div>
            {tagsError && <p className="text-xs text-destructive font-mono">{tagsError}</p>}
        </section>
    );
}

interface LinkSlotEditorProps {
    label: string;
    initialValue: string;
    onSave: (value: string) => Promise<void>;
}

export function LinkSlotEditor({ label, initialValue, onSave }: LinkSlotEditorProps): JSX.Element {
    const [draft, setDraft] = useState(initialValue);
    const [saving, setSaving] = useState(false);
    useEffect(() => { setDraft(initialValue); }, [initialValue]);
    const isDirty = draft !== initialValue;
    const handleClick = async () => {
        if (!isDirty) return;
        setSaving(true);
        try { await onSave(draft); } finally { setSaving(false); }
    };
    return (
        <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
            <div className="flex gap-1.5">
                <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="project-slug or empty"
                    className="font-mono text-xs h-8"
                />
                <Button size="sm" variant="outline" onClick={handleClick} disabled={!isDirty || saving}>
                    {saving ? "..." : "Save"}
                </Button>
            </div>
        </div>
    );
}

interface LinksSectionProps {
    step: StepRow;
    linkError: string | null;
    onLinkSave: (slot: StepLinkSlot, value: string) => Promise<void>;
}

export function LinksSection({ step, linkError, onLinkSave }: LinksSectionProps): JSX.Element {
    return (
        <section className="space-y-2">
            <SectionHeading>Cross-project links</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <LinkSlotEditor
                    label="On success -> project"
                    initialValue={step.OnSuccessProjectId ?? ""}
                    onSave={(value) => onLinkSave("OnSuccessProjectId", value)}
                />
                <LinkSlotEditor
                    label="On failure -> project"
                    initialValue={step.OnFailureProjectId ?? ""}
                    onSave={(value) => onLinkSave("OnFailureProjectId", value)}
                />
            </div>
            {linkError && <p className="text-xs text-destructive font-mono">{linkError}</p>}
        </section>
    );
}

interface SelectorsSectionProps { selectors: ReadonlyArray<SelectorRow> }

function SelectorItem({ sel }: { sel: SelectorRow }): JSX.Element {
    const wrapClass = `rounded-md border px-2.5 py-2 text-xs space-y-1 ${
        sel.IsPrimary === 1 ? "border-primary/60 bg-primary/5" : "border-border bg-card"
    }`;
    return (
        <li className={wrapClass}>
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                    {SELECTOR_KIND_LABEL[sel.SelectorKindId] ?? `Kind${sel.SelectorKindId}`}
                </Badge>
                {sel.IsPrimary === 1 && (
                    <Badge className="text-[10px] py-0 px-1.5 bg-primary text-primary-foreground">Primary</Badge>
                )}
                {sel.AnchorSelectorId !== null && (
                    <span className="text-[10px] text-muted-foreground font-mono">anchor=#{sel.AnchorSelectorId}</span>
                )}
            </div>
            <code className="block font-mono text-[11px] break-all text-foreground/90">{sel.Expression}</code>
        </li>
    );
}

export function SelectorsSection({ selectors }: SelectorsSectionProps): JSX.Element {
    return (
        <section className="space-y-2">
            <SectionHeading>Selectors ({selectors.length})</SectionHeading>
            {selectors.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No selectors persisted.</p>
            ) : (
                <ul className="space-y-1.5">
                    {selectors.map((sel) => <SelectorItem key={sel.SelectorId} sel={sel} />)}
                </ul>
            )}
        </section>
    );
}

interface FieldBindingSectionProps {
    binding: FieldBindingRow | null;
    boundDs: DataSourceRow | null;
}

export function FieldBindingSection({ binding, boundDs }: FieldBindingSectionProps): JSX.Element {
    return (
        <section className="space-y-2">
            <SectionHeading>Field Binding</SectionHeading>
            {binding === null ? (
                <p className="text-xs text-muted-foreground italic">No data-source column bound to this step.</p>
            ) : (
                <div className="rounded-md border border-border bg-card px-2.5 py-2 text-xs space-y-1">
                    <div className="font-mono">
                        <span className="text-primary">{`{{${binding.ColumnName}}}`}</span>{" "}
                        <span className="text-muted-foreground">-&gt;</span>{" "}
                        <span>{boundDs?.FilePath ?? `DataSourceId=${binding.DataSourceId}`}</span>
                    </div>
                    {boundDs && (
                        <div className="text-[10px] text-muted-foreground">
                            Columns: {boundDs.Columns.join(", ")} - Rows: {boundDs.RowCount}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

/**
 * Marco Extension — Sub-sections of `WebhookSettingsDialog`.
 *
 * v4.213.0 (Plan-24 SS-05 Phase 2): the URL/timeout, Headers, and Events
 * sections were previously inlined inside the dialog's render function.
 * Extracting them here keeps the parent component under
 * `max-lines-per-function` while preserving 1:1 markup.
 */

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import {
    ALL_WEBHOOK_EVENTS,
    type WebhookConfig,
    type WebhookEventKind,
    type WebhookHeader,
} from "@/background/recorder/step-library/result-webhook";

const EVENT_LABELS: Record<WebhookEventKind, string> = {
    GroupRunSucceeded: "Group run succeeded",
    GroupRunFailed: "Group run failed",
    BatchComplete: "Batch run complete",
    RecordingStopped: "Recording stopped",
};

interface EnableUrlTimeoutProps {
    readonly draft: WebhookConfig;
    readonly setDraft: Dispatch<SetStateAction<WebhookConfig>>;
}

export function EnableUrlTimeoutSection({ draft, setDraft }: EnableUrlTimeoutProps) {
    return (
        <section className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
                <Label htmlFor="hook-enabled" className="text-sm font-medium">
                    Send results to webhook
                </Label>
                <Switch
                    id="hook-enabled"
                    checked={draft.Enabled}
                    onCheckedChange={(v) => setDraft((p) => ({ ...p, Enabled: v }))}
                />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="hook-url" className="text-xs text-muted-foreground">
                    Endpoint URL, supports {"{{GroupId}}"}, {"{{GroupName}}"}, {"{{Event}}"} tokens
                </Label>
                <Input
                    id="hook-url"
                    type="url"
                    placeholder="https://example.com/webhooks/marco"
                    value={draft.Url}
                    onChange={(e) => setDraft((p) => ({ ...p, Url: e.target.value }))}
                />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="hook-timeout" className="text-xs text-muted-foreground">
                    Timeout (ms, 1 000 to 60 000)
                </Label>
                <Input
                    id="hook-timeout"
                    type="number"
                    min={1000}
                    max={60000}
                    step={500}
                    value={draft.TimeoutMs}
                    onChange={(e) => setDraft((p) => ({ ...p, TimeoutMs: Number(e.target.value) || 0 }))}
                />
            </div>
        </section>
    );
}

interface HeadersSectionProps {
    readonly headers: ReadonlyArray<WebhookHeader>;
    readonly onAdd: () => void;
    readonly onUpdate: (idx: number, patch: Partial<WebhookHeader>) => void;
    readonly onRemove: (idx: number) => void;
}

export function HeadersSection({ headers, onAdd, onUpdate, onRemove }: HeadersSectionProps) {
    return (
        <section className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Custom headers</Label>
                <Button size="sm" variant="ghost" onClick={onAdd}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add header
                </Button>
            </div>
            {headers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    No custom headers. Add one for bearer tokens, signing keys, etc.
                </p>
            ) : (
                <div className="space-y-2">
                    {headers.map((h, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <Input
                                placeholder="Header name"
                                value={h.Name}
                                onChange={(e) => onUpdate(i, { Name: e.target.value })}
                                className="flex-1"
                            />
                            <Input
                                placeholder="Header value"
                                value={h.Value}
                                onChange={(e) => onUpdate(i, { Value: e.target.value })}
                                className="flex-[2]"
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onRemove(i)}
                                aria-label={`Remove header ${h.Name || i + 1}`}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

interface EventsSectionProps {
    readonly events: ReadonlyArray<WebhookEventKind>;
    readonly eventSet: ReadonlySet<WebhookEventKind>;
    readonly onToggle: (kind: WebhookEventKind, on: boolean) => void;
}

export function EventsSection({ events, eventSet, onToggle }: EventsSectionProps) {
    return (
        <section className="space-y-2 rounded-md border p-3">
            <Label className="text-sm font-medium">Send on these events</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ALL_WEBHOOK_EVENTS.map((kind) => (
                    <label
                        key={kind}
                        className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-sm"
                    >
                        <Checkbox
                            checked={eventSet.has(kind)}
                            onCheckedChange={(v) => onToggle(kind, v === true)}
                        />
                        <span className="truncate">{EVENT_LABELS[kind]}</span>
                    </label>
                ))}
            </div>
            {events.length === 0 && (
                <p className="text-xs text-destructive">
                    No events selected, webhook will never fire.
                </p>
            )}
        </section>
    );
}

interface RepairConfirmProps {
    readonly corruptCount: number;
}

export function RepairCorruptDescription({ corruptCount }: RepairConfirmProps) {
    return (
        <div className="space-y-2 text-sm">
            <p>
                This will scan the locally stored webhook delivery log and
                permanently remove every entry that fails validation
                (missing/wrong fields, unparsable JSON, or wrong shape).
            </p>
            <p>
                <span className="font-semibold text-destructive">{corruptCount}</span>{" "}
                corrupted entr{corruptCount === 1 ? "y" : "ies"} will be removed.
                Valid history is preserved.
            </p>
            <p className="text-xs text-muted-foreground">
                This action cannot be undone.
            </p>
        </div>
    );
}

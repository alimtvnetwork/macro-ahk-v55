/**
 * Presentational sections for InputSourceDialog. Each section is a small
 * focused component under the 15-line function cap where practical; JSX
 * bodies exceed the cap by necessity but cognitive complexity is trivial.
 */

import { Plus, Send, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type {
    FetchInputResult,
    InputSourceConfig,
    InputSourceFailurePolicy,
    InputSourceMethod,
} from "@/background/recorder/step-library/input-source";

import type { InputSourceDraftApi } from "./use-input-source-draft";

interface SectionProps {
    readonly api: InputSourceDraftApi;
}

export function InputSourceBody({ api }: SectionProps) {
    return (
        <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-5">
                <EndpointSection api={api} />
                <HeadersSection api={api} />
                {api.draft.Method === "POST" && <BodySection api={api} />}
                <FailurePolicySection api={api} />
                <TestFetchSection api={api} />
            </div>
        </ScrollArea>
    );
}

function EndpointSection({ api }: SectionProps) {
    const { draft, setDraft } = api;
    return (
        <section className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
                <Label htmlFor="src-enabled" className="text-sm font-medium">
                    Fetch input data at run start
                </Label>
                <Switch
                    id="src-enabled"
                    checked={draft.Enabled}
                    onCheckedChange={(v) => setDraft((p) => ({ ...p, Enabled: v }))}
                />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="src-url" className="text-xs text-muted-foreground">Endpoint URL</Label>
                <Input
                    id="src-url"
                    type="url"
                    placeholder="https://example.com/api/marco-inputs"
                    value={draft.Url}
                    onChange={(e) => setDraft((p) => ({ ...p, Url: e.target.value }))}
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <MethodField draft={draft} setDraft={setDraft} />
                <TimeoutField draft={draft} setDraft={setDraft} />
            </div>
        </section>
    );
}

interface FieldProps {
    readonly draft: InputSourceConfig;
    readonly setDraft: InputSourceDraftApi["setDraft"];
}

function MethodField({ draft, setDraft }: FieldProps) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Method</Label>
            <Select
                value={draft.Method}
                onValueChange={(v) => setDraft((p) => ({ ...p, Method: v as InputSourceMethod }))}
            >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}

function TimeoutField({ draft, setDraft }: FieldProps) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor="src-timeout" className="text-xs text-muted-foreground">Timeout (ms)</Label>
            <Input
                id="src-timeout"
                type="number"
                min={1000}
                max={60000}
                step={500}
                value={draft.TimeoutMs}
                onChange={(e) => setDraft((p) => ({
                    ...p,
                    TimeoutMs: Number.parseInt(e.target.value, 10) || p.TimeoutMs,
                }))}
            />
        </div>
    );
}

function HeadersSection({ api }: SectionProps) {
    const { draft, addHeader } = api;
    return (
        <section className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Custom headers</Label>
                <Button size="sm" variant="outline" onClick={addHeader}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add header
                </Button>
            </div>
            {draft.Headers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    No custom headers. Add one for bearer tokens, signing keys, etc.
                </p>
            ) : (
                <HeaderRows api={api} />
            )}
        </section>
    );
}

function HeaderRows({ api }: SectionProps) {
    const { draft, updateHeader, removeHeader } = api;
    return (
        <div className="space-y-2">
            {draft.Headers.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                    <Input
                        placeholder="Header name"
                        value={h.Name}
                        onChange={(e) => updateHeader(i, { Name: e.target.value })}
                        className="flex-1"
                    />
                    <Input
                        placeholder="Header value"
                        value={h.Value}
                        onChange={(e) => updateHeader(i, { Value: e.target.value })}
                        className="flex-[2]"
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeHeader(i)}
                        aria-label={`Remove header ${h.Name || i + 1}`}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
        </div>
    );
}

function BodySection({ api }: SectionProps) {
    const { draft, setDraft } = api;
    return (
        <section className="space-y-2 rounded-md border p-3">
            <Label htmlFor="src-body" className="text-sm font-medium">Request body (JSON)</Label>
            <Textarea
                id="src-body"
                rows={4}
                placeholder='{"projectId": 1}'
                value={draft.RequestBody}
                onChange={(e) => setDraft((p) => ({ ...p, RequestBody: e.target.value }))}
                className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
                Leave empty to send no body. Content-Type defaults to application/json.
            </p>
        </section>
    );
}

function FailurePolicySection({ api }: SectionProps) {
    const { draft, setDraft } = api;
    return (
        <section className="space-y-2 rounded-md border p-3">
            <Label className="text-sm font-medium">If the endpoint fails</Label>
            <Select
                value={draft.OnFailure}
                onValueChange={(v) => setDraft((p) => ({
                    ...p,
                    OnFailure: v as InputSourceFailurePolicy,
                }))}
            >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="Abort">Abort the run</SelectItem>
                    <SelectItem value="ContinueWithLocal">
                        Continue with locally-saved inputs
                    </SelectItem>
                </SelectContent>
            </Select>
        </section>
    );
}

function TestFetchSection({ api }: SectionProps) {
    const { busy, handleTest, lastResult } = api;
    return (
        <section className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Test fetch</Label>
                <Button size="sm" variant="outline" onClick={handleTest} disabled={busy}>
                    <Send className="mr-1 h-3.5 w-3.5" />
                    {busy ? "Fetching…" : "Send test fetch"}
                </Button>
            </div>
            <TestFetchResultView result={lastResult} previewKeys={api.previewKeys} />
        </section>
    );
}

interface ResultViewProps {
    readonly result: FetchInputResult | null;
    readonly previewKeys: ReadonlyArray<string>;
}

function TestFetchResultView({ result, previewKeys }: ResultViewProps) {
    if (result === null) {
        return (
            <p className="text-xs text-muted-foreground">
                Run a test to verify the endpoint returns a JSON object.
            </p>
        );
    }
    if (result.Ok && !result.Skipped) return <TestFetchSuccess result={result} previewKeys={previewKeys} />;
    if (result.Ok && result.Skipped) {
        return <p className="text-xs text-muted-foreground">Skipped: {result.SkipReason}</p>;
    }
    return (
        <div className="space-y-1 text-xs">
            <Badge variant="destructive">Fail</Badge>
            <p className="text-destructive">{result.Error}</p>
        </div>
    );
}

function TestFetchSuccess({ result, previewKeys }: ResultViewProps) {
    if (result === null || !result.Ok || result.Skipped) return null;
    return (
        <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
                <Badge>OK {result.Status}</Badge>
                <span className="text-muted-foreground">
                    {result.DurationMs} ms · {previewKeys.length} key(s)
                </span>
            </div>
            <pre className="max-h-40 overflow-auto rounded bg-muted/40 p-2 font-mono">
                {JSON.stringify(result.Bag, null, 2)}
            </pre>
        </div>
    );
}

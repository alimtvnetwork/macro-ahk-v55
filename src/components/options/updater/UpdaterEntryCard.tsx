import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelType } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Settings,
  Link,
  ListOrdered,
  Clock,
  CheckCircle,
  AlertCircle,
  Tag,
  Power,
  Globe,
} from "lucide-react";
import {
  UpdaterEntry,
  UpdaterEndpoint,
  UpdaterStep,
  STATUS_UP_TO_DATE,
  STATUS_UPDATE_AVAILABLE,
  intervalLabel,
  INTERVAL_OPTIONS,
  AVAILABLE_CATEGORIES,
  STEP_TYPES,
  RESOURCE_TYPES,
} from "./updater-types";

interface UpdaterEntryCardProps {
  entry: UpdaterEntry;
  isExpanded: boolean;
  isChecking: boolean;
  onToggleExpand: () => void;
  onCheck: () => void;
  onRemove: () => void;
  onToggleEnabled: () => void;
  onUpdateField: (field: keyof UpdaterEntry, value: UpdaterEntry[keyof UpdaterEntry]) => void;
  onAddEndpoint: () => void;
  onRemoveEndpoint: (id: number) => void;
  onUpdateEndpoint: (id: number, field: keyof UpdaterEndpoint, value: UpdaterEndpoint[keyof UpdaterEndpoint]) => void;
  onAddStep: () => void;
  onRemoveStep: (id: number) => void;
  onUpdateStep: (id: number, field: keyof UpdaterStep, value: UpdaterStep[keyof UpdaterStep]) => void;
  toggleCategory: (cats: string[], cat: string) => string[];
}

// eslint-disable-next-line max-lines-per-function
export function UpdaterEntryCard({
  entry: u,
  isExpanded,
  isChecking,
  onToggleExpand,
  onCheck,
  onRemove,
  onToggleEnabled,
  onUpdateField,
  onAddEndpoint,
  onRemoveEndpoint,
  onUpdateEndpoint,
  onAddStep,
  onRemoveStep,
  onUpdateStep,
  toggleCategory,
}: UpdaterEntryCardProps) {
  const statusIconNode = () => {
    switch (u.status) {
      case STATUS_UP_TO_DATE:
        return <CheckCircle className="h-3.5 w-3.5 text-primary" />;
      case STATUS_UPDATE_AVAILABLE:
        return <AlertCircle className="h-3.5 w-3.5 text-accent" />;
      case "error":
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const statusLabelText = () => {
    switch (u.status) {
      case STATUS_UP_TO_DATE: return "Up to date";
      case STATUS_UPDATE_AVAILABLE: return "Update available";
      case "error": return "Error";
      default: return "Unchecked";
    }
  };

  return (
    <div className={`rounded-lg border bg-card transition-all duration-200 ${u.isEnabled ? "border-border hover:border-primary/30" : "border-border/50 opacity-60"}`}>
      {/* Summary row */}
      <div className="flex items-center gap-3 p-3">
        <button onClick={onToggleExpand} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        {statusIconNode()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{u.name}</span>
            {u.isGit && (
              <span className="text-[9px] font-mono bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded">GIT</span>
            )}
            <span className={`text-[10px] font-medium ${
              u.status === STATUS_UP_TO_DATE ? "text-primary" :
                u.status === STATUS_UPDATE_AVAILABLE ? "text-accent" :
                  u.status === "error" ? "text-destructive" :
                    "text-muted-foreground"
            }`}>
              {statusLabelText()}
            </span>
            {!u.isEnabled && (
              <span className="text-[9px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded">DISABLED</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <div className="flex items-center gap-1">
              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground truncate max-w-[250px]">{u.scriptUrl}</span>
            </div>
            {u.currentVersion && (
              <span className="text-[10px] font-mono text-muted-foreground">v{u.currentVersion}</span>
            )}
            {u.latestVersion && u.latestVersion !== u.currentVersion && (
              <span className="text-[10px] font-mono text-primary">→ v{u.latestVersion}</span>
            )}
            <span className="text-[10px] text-muted-foreground">{intervalLabel(u.autoCheckIntervalMinutes)}</span>
          </div>
          {u.categories.length > 0 && (
            <div className="flex gap-1 mt-1">
              {u.categories.map((cat) => (
                <span key={cat} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{cat}</span>
              ))}
            </div>
          )}
          {u.lastCheckedAt && (
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Last checked: {new Date(u.lastCheckedAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon" variant="ghost"
            className="h-7 w-7 hover:bg-primary/10 hover:text-primary transition-all duration-200"
            onClick={onCheck}
            disabled={isChecking || !u.isEnabled}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="icon" variant="ghost"
            className="h-7 w-7 hover:bg-muted transition-all duration-200"
            onClick={onToggleEnabled}
            title={u.isEnabled ? "Disable" : "Enable"}
          >
            <Power className={`h-3.5 w-3.5 ${u.isEnabled ? "text-primary" : "text-muted-foreground"}`} />
          </Button>
          <Button
            size="icon" variant="ghost"
            className="h-7 w-7 text-destructive hover:bg-destructive/10 transition-all duration-200"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/5">
          {/* URLs */}
          <Section icon={<Link className="h-3.5 w-3.5" />} title="URLs">
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Script URL" value={u.scriptUrl} onChange={(v) => onUpdateField("scriptUrl", v)} mono />
              <FieldInput label="Version Info URL" value={u.versionInfoUrl ?? ""} onChange={(v) => onUpdateField("versionInfoUrl", v || undefined)} mono />
              <FieldInput label="Instruction URL" value={u.instructionUrl ?? ""} onChange={(v) => onUpdateField("instructionUrl", v || undefined)} mono />
              <FieldInput label="Changelog URL" value={u.changelogUrl ?? ""} onChange={(v) => onUpdateField("changelogUrl", v || undefined)} mono />
            </div>
            {u.cachedRedirectUrl && (
              <div className="mt-2 text-[10px] text-muted-foreground">
                <span className="font-medium">Cached redirect:</span>{" "}
                <code className="bg-muted/30 px-1.5 py-0.5 rounded font-mono">{u.cachedRedirectUrl}</code>
                {u.cachedRedirectAt && <span className="ml-2">({new Date(u.cachedRedirectAt).toLocaleString()})</span>}
              </div>
            )}
          </Section>

          {/* Advanced Settings */}
          <Section icon={<Settings className="h-3.5 w-3.5" />} title="Advanced Settings" collapsible>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <LabelType className="text-xs">Auto-Check Interval</LabelType>
                <Select value={String(u.autoCheckIntervalMinutes)} onValueChange={(v) => onUpdateField("autoCheckIntervalMinutes", Number(v))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <LabelType className="text-xs">Cache Expiry</LabelType>
                <Select value={String(u.cacheExpiryMinutes)} onValueChange={(v) => onUpdateField("cacheExpiryMinutes", Number(v))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <LabelType className="text-xs">Max Redirect Depth</LabelType>
                <Input type="number" min={0} max={10} value={u.maxRedirectDepth} onChange={(e) => onUpdateField("maxRedirectDepth", Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={u.isGit} onCheckedChange={(v) => onUpdateField("isGit", v)} className="scale-75" />
                Git source
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={u.isRedirectable} onCheckedChange={(v) => onUpdateField("isRedirectable", v)} className="scale-75" />
                Allow redirects
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={u.hasUserConfirmBeforeUpdate} onCheckedChange={(v) => onUpdateField("hasUserConfirmBeforeUpdate", v)} className="scale-75" />
                Confirm before update
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={u.hasChangelogFromVersionInfo} onCheckedChange={(v) => onUpdateField("hasChangelogFromVersionInfo", v)} className="scale-75" />
                Changelog from VersionInfo
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={u.isInstructionRedirect} onCheckedChange={(v) => onUpdateField("isInstructionRedirect", v)} className="scale-75" />
                Instruction redirects
              </label>
            </div>
            {u.isInstructionRedirect && (
              <div className="mt-2 w-48">
                <LabelType className="text-xs">Instruction redirect depth</LabelType>
                <Input type="number" min={0} max={10} value={u.instructionRedirectDepth} onChange={(e) => onUpdateField("instructionRedirectDepth", Number(e.target.value))} className="h-8 text-xs" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <FieldInput label="Current Version" value={u.currentVersion ?? ""} onChange={(v) => onUpdateField("currentVersion", v || undefined)} mono />
              <FieldInput label="Latest Version" value={u.latestVersion ?? ""} onChange={(v) => onUpdateField("latestVersion", v || undefined)} mono />
            </div>
          </Section>

          {/* Categories */}
          <Section icon={<Tag className="h-3.5 w-3.5" />} title="Categories">
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onUpdateField("categories", toggleCategory(u.categories, cat))}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-all duration-200 ${
                    u.categories.includes(cat)
                      ? "bg-primary/15 text-primary border-primary/30 font-medium"
                      : "bg-muted/20 text-muted-foreground border-border hover:border-primary/30"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </Section>

          {/* Endpoints */}
          <Section icon={<Globe className="h-3.5 w-3.5" />} title={`Endpoints (${u.endpoints.length})`} collapsible>
            <div className="space-y-2">
              {u.endpoints.map((ep, i) => (
                <div key={ep.id} className="flex items-start gap-2 rounded-md border border-border/50 p-2 bg-background">
                  <span className="text-[10px] text-muted-foreground font-mono mt-2 w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <Input value={ep.url} onChange={(e) => onUpdateEndpoint(ep.id, "url", e.target.value)} placeholder="https://..." className="h-7 text-xs font-mono" />
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <LabelType className="text-[10px]">Status</LabelType>
                        <Input type="number" value={ep.expectedStatusCode} onChange={(e) => onUpdateEndpoint(ep.id, "expectedStatusCode", Number(e.target.value))} className="h-6 w-16 text-[10px]" />
                      </div>
                      <label className="flex items-center gap-1 text-[10px]">
                        <Switch checked={ep.isRedirectable} onCheckedChange={(v) => onUpdateEndpoint(ep.id, "isRedirectable", v)} className="scale-[0.6]" />
                        Redirects
                      </label>
                      {ep.isRedirectable && (
                        <div className="flex items-center gap-1">
                          <LabelType className="text-[10px]">Depth</LabelType>
                          <Input type="number" min={0} max={10} value={ep.maxRedirectDepth} onChange={(e) => onUpdateEndpoint(ep.id, "maxRedirectDepth", Number(e.target.value))} className="h-6 w-12 text-[10px]" />
                        </div>
                      )}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={() => onRemoveEndpoint(ep.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" className="text-xs gap-1.5 w-full" onClick={onAddEndpoint}>
                <Plus className="h-3 w-3" />
                Add Endpoint
              </Button>
            </div>
          </Section>

          {/* Steps */}
          <Section icon={<ListOrdered className="h-3.5 w-3.5" />} title={`Steps (${u.steps.length})`} collapsible>
            <div className="space-y-2">
              {u.steps.map((step, i) => (
                <div key={step.id} className="rounded-md border border-border/50 p-3 bg-background space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono w-4 shrink-0">{i + 1}</span>
                    <Select value={step.type} onValueChange={(v) => onUpdateStep(step.id, "type", v as UpdaterStep["type"])}>
                      <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STEP_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input value={step.stepId} onChange={(e) => onUpdateStep(step.id, "stepId", e.target.value)} placeholder="step-id" className="h-7 text-xs font-mono flex-1" />
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={() => onRemoveStep(step.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div className="space-y-1">
                      <LabelType className="text-[10px]">Resource Type</LabelType>
                      <Select value={step.resourceType ?? ""} onValueChange={(v) => onUpdateStep(step.id, "resourceType", (v as UpdaterStep["resourceType"]) || undefined)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="" className="text-xs">None</SelectItem>
                          {RESOURCE_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <FieldInput label="Source URL" value={step.sourceUrl ?? ""} onChange={(v) => onUpdateStep(step.id, "sourceUrl", v || undefined)} mono small />
                    <FieldInput label="Destination" value={step.destination ?? ""} onChange={(v) => onUpdateStep(step.id, "destination", v || undefined)} mono small />
                    <FieldInput label="Condition" value={step.condition ?? ""} onChange={(v) => onUpdateStep(step.id, "condition", v || undefined)} small />
                    {step.type === "Execute" && (
                      <FieldInput label="Command" value={step.executionCommand ?? ""} onChange={(v) => onUpdateStep(step.id, "executionCommand", v || undefined)} mono small />
                    )}
                    {step.type === "Validate" && (
                      <FieldInput label="Validation Rule" value={step.validationRule ?? ""} onChange={(v) => onUpdateStep(step.id, "validationRule", v || undefined)} mono small />
                    )}
                    {(step.type === "Download" || step.type === "Update") && (
                      <FieldInput label="Post-Process" value={step.postProcess ?? ""} onChange={(v) => onUpdateStep(step.id, "postProcess", v || undefined)} small />
                    )}
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline" className="text-xs gap-1.5 w-full" onClick={onAddStep}>
                <Plus className="h-3 w-3" />
                Add Step
              </Button>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, children, collapsible = false }: { icon: React.ReactNode; title: string; children: React.ReactNode; collapsible?: boolean }) {
  if (collapsible) {
    return (
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary transition-colors w-full group">
          {icon}
          {title}
          <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto group-data-[state=open]:rotate-90 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          {children}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-2 text-xs font-semibold text-foreground">{icon}{title}</h4>
      {children}
    </div>
  );
}

function FieldInput({ label, value, onChange, mono = false, small = false }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean; small?: boolean }) {
  return (
    <div className="space-y-1">
      <LabelType className={small ? "text-[10px]" : "text-xs"}>{label}</LabelType>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className={`${small ? "h-7" : "h-8"} text-xs ${mono ? "font-mono" : ""}`} />
    </div>
  );
}

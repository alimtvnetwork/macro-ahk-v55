import { useState } from "react";
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
import { Plus, Globe, GitBranch, Shield } from "lucide-react";
import { toast } from "sonner";
import { AVAILABLE_CATEGORIES, INTERVAL_OPTIONS, intervalLabel } from "./updater-types";

export interface AddUpdaterData {
  name: string;
  description: string;
  scriptUrl: string;
  versionInfoUrl: string;
  instructionUrl: string;
  changelogUrl: string;
  isGit: boolean;
  isRedirectable: boolean;
  maxRedirectDepth: number;
  autoCheckIntervalMinutes: number;
  cacheExpiryMinutes: number;
  categories: string[];
  hasUserConfirmBeforeUpdate: boolean;
  hasChangelogFromVersionInfo: boolean;
}

interface AddUpdaterFormProps {
  onAdd: (data: AddUpdaterData) => Promise<void>;
  onCancel: () => void;
}

function BasicFields({ d, set }: { d: AddUpdaterData; set: (v: Partial<AddUpdaterData>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2"><LabelType className="text-xs">Name *</LabelType><Input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. My Script" className="h-8 text-xs" /></div>
      <div className="space-y-2"><LabelType className="text-xs">Description</LabelType><Input value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Optional" className="h-8 text-xs" /></div>
      <div className="space-y-2"><LabelType className="text-xs">Script URL *</LabelType><div className="flex items-center gap-1"><Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><Input value={d.scriptUrl} onChange={(e) => set({ scriptUrl: e.target.value })} placeholder="https://..." className="h-8 text-xs font-mono" /></div></div>
      <div className="space-y-2"><LabelType className="text-xs">Version Info URL (Optional)</LabelType><Input value={d.versionInfoUrl} onChange={(e) => set({ versionInfoUrl: e.target.value })} placeholder="https://.../version.json" className="h-8 text-xs font-mono" /></div>
      <div className="space-y-2"><LabelType className="text-xs">Instruction URL (Optional)</LabelType><Input value={d.instructionUrl} onChange={(e) => set({ instructionUrl: e.target.value })} placeholder="https://.../install.json" className="h-8 text-xs font-mono" /></div>
      <div className="space-y-2"><LabelType className="text-xs">Changelog URL (Optional)</LabelType><Input value={d.changelogUrl} onChange={(e) => set({ changelogUrl: e.target.value })} placeholder="https://.../changelog.md" className="h-8 text-xs font-mono" /></div>
    </div>
  );
}

function SourceConfigFields({ d, set }: { d: AddUpdaterData; set: (v: Partial<AddUpdaterData>) => void }) {
  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2"><GitBranch className="h-3 w-3" /> Source Config</h4>
      <label className="flex items-center gap-2 text-xs"><Switch checked={d.isGit} onCheckedChange={(v) => set({ isGit: v })} className="scale-75 origin-left" /> Is Git Repository</label>
      <label className="flex items-center gap-2 text-xs"><Switch checked={d.isRedirectable} onCheckedChange={(v) => set({ isRedirectable: v })} className="scale-75 origin-left" /> Allow Redirects</label>
      {d.isRedirectable && (
        <div className="pl-6 space-y-1"><LabelType className="text-[10px]">Max Redirect Depth</LabelType><Input type="number" min={0} max={10} value={d.maxRedirectDepth} onChange={(e) => set({ maxRedirectDepth: Number(e.target.value) })} className="h-7 text-xs w-16" /></div>
      )}
    </div>
  );
}

function BehaviorFields({ d, set }: { d: AddUpdaterData; set: (v: Partial<AddUpdaterData>) => void }) {
  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2"><Shield className="h-3 w-3" /> Behavior</h4>
      <label className="flex items-center gap-2 text-xs"><Switch checked={d.hasUserConfirmBeforeUpdate} onCheckedChange={(v) => set({ hasUserConfirmBeforeUpdate: v })} className="scale-75 origin-left" /> Require User Confirmation before Update</label>
      <label className="flex items-center gap-2 text-xs"><Switch checked={d.hasChangelogFromVersionInfo} onCheckedChange={(v) => set({ hasChangelogFromVersionInfo: v })} className="scale-75 origin-left" /> Read Changelog from Version Info</label>
      <div className="space-y-1">
        <LabelType className="text-[10px]">Auto-Check Interval</LabelType>
        <Select value={d.autoCheckIntervalMinutes.toString()} onValueChange={(v) => set({ autoCheckIntervalMinutes: Number(v) })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value.toString()} className="text-xs">{o.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function AddUpdaterForm({ onAdd, onCancel }: AddUpdaterFormProps) {
  const [d, setD] = useState<AddUpdaterData>({
    name: "", description: "", scriptUrl: "", versionInfoUrl: "", instructionUrl: "", changelogUrl: "",
    isGit: false, isRedirectable: true, maxRedirectDepth: 2, autoCheckIntervalMinutes: 1440,
    cacheExpiryMinutes: 10080, categories: [], hasUserConfirmBeforeUpdate: false, hasChangelogFromVersionInfo: true
  });
  const set = (v: Partial<AddUpdaterData>) => setD(prev => ({ ...prev, ...v }));

  const handleAdd = async () => {
    if (!d.name.trim() || !d.scriptUrl.trim()) { toast.error("Name and Script URL are required");

 return; }
    await onAdd({ ...d, name: d.name.trim(), description: d.description.trim(), scriptUrl: d.scriptUrl.trim(), versionInfoUrl: d.versionInfoUrl.trim(), instructionUrl: d.instructionUrl.trim(), changelogUrl: d.changelogUrl.trim() });
  };

  return (
    <div className="bg-background rounded-lg border border-border/50 p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2"><Plus className="h-4 w-4 text-primary" /><h3 className="font-semibold text-sm">Add New Updater</h3></div>
      <BasicFields d={d} set={set} />
      <div className="grid grid-cols-2 gap-4 mt-4 bg-muted/30 p-3 rounded-md">
        <SourceConfigFields d={d} set={set} />
        <BehaviorFields d={d} set={set} />
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/50">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleAdd}>Add Updater</Button>
      </div>
    </div>
  );
}

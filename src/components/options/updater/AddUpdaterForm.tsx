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

export function AddUpdaterForm({ onAdd, onCancel }: AddUpdaterFormProps) {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newScriptUrl, setNewScriptUrl] = useState("");
  const [newVersionUrl, setNewVersionUrl] = useState("");
  const [newInstructionUrl, setNewInstructionUrl] = useState("");
  const [newChangelogUrl, setNewChangelogUrl] = useState("");
  const [newIsGit, setNewIsGit] = useState(false);
  const [newIsRedirectable, setNewIsRedirectable] = useState(true);
  const [newMaxRedirectDepth, setNewMaxRedirectDepth] = useState(2);
  const [newAutoCheck, setNewAutoCheck] = useState(1440);
  const [newCacheExpiry, setNewCacheExpiry] = useState(10080);
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [newHasConfirm, setNewHasConfirm] = useState(false);
  const [newHasChangelogFromVersionInfo, setNewHasChangelogFromVersionInfo] = useState(true);

  const handleAdd = async () => {
    if (!newName.trim() || !newScriptUrl.trim()) {
      toast.error("Name and Script URL are required");
      return;
    }
    
    await onAdd({
      name: newName.trim(),
      description: newDescription.trim(),
      scriptUrl: newScriptUrl.trim(),
      versionInfoUrl: newVersionUrl.trim(),
      instructionUrl: newInstructionUrl.trim(),
      changelogUrl: newChangelogUrl.trim(),
      isGit: newIsGit,
      isRedirectable: newIsRedirectable,
      maxRedirectDepth: newMaxRedirectDepth,
      autoCheckIntervalMinutes: newAutoCheck,
      cacheExpiryMinutes: newCacheExpiry,
      categories: newCategories,
      hasUserConfirmBeforeUpdate: newHasConfirm,
      hasChangelogFromVersionInfo: newHasChangelogFromVersionInfo,
    });
  };

  return (
    <div className="bg-background rounded-lg border border-border/50 p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Plus className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Add New Updater</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <LabelType className="text-xs">Name *</LabelType>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. My Script" className="h-8 text-xs" />
        </div>
        <div className="space-y-2">
          <LabelType className="text-xs">Description</LabelType>
          <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Optional" className="h-8 text-xs" />
        </div>
        <div className="space-y-2">
          <LabelType className="text-xs">Script URL *</LabelType>
          <div className="flex items-center gap-1">
            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input value={newScriptUrl} onChange={(e) => setNewScriptUrl(e.target.value)} placeholder="https://..." className="h-8 text-xs font-mono" />
          </div>
        </div>
        <div className="space-y-2">
          <LabelType className="text-xs">Version Info URL (Optional)</LabelType>
          <Input value={newVersionUrl} onChange={(e) => setNewVersionUrl(e.target.value)} placeholder="https://.../version.json" className="h-8 text-xs font-mono" />
        </div>
        <div className="space-y-2">
          <LabelType className="text-xs">Instruction URL (Optional)</LabelType>
          <Input value={newInstructionUrl} onChange={(e) => setNewInstructionUrl(e.target.value)} placeholder="https://.../install.json" className="h-8 text-xs font-mono" />
        </div>
        <div className="space-y-2">
          <LabelType className="text-xs">Changelog URL (Optional)</LabelType>
          <Input value={newChangelogUrl} onChange={(e) => setNewChangelogUrl(e.target.value)} placeholder="https://.../changelog.md" className="h-8 text-xs font-mono" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 bg-muted/30 p-3 rounded-md">
        <div className="space-y-3">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <GitBranch className="h-3 w-3" />
            Source Config
          </h4>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={newIsGit} onCheckedChange={setNewIsGit} className="scale-75 origin-left" />
            Is Git Repository
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={newIsRedirectable} onCheckedChange={setNewIsRedirectable} className="scale-75 origin-left" />
            Allow Redirects
          </label>
          {newIsRedirectable && (
            <div className="pl-6 space-y-1">
              <LabelType className="text-[10px]">Max Redirect Depth</LabelType>
              <Input type="number" min={0} max={10} value={newMaxRedirectDepth} onChange={(e) => setNewMaxRedirectDepth(Number(e.target.value))} className="h-7 text-xs w-16" />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Shield className="h-3 w-3" />
            Behavior
          </h4>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={newHasConfirm} onCheckedChange={setNewHasConfirm} className="scale-75 origin-left" />
            Require User Confirmation before Update
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={newHasChangelogFromVersionInfo} onCheckedChange={setNewHasChangelogFromVersionInfo} className="scale-75 origin-left" />
            Read Changelog from Version Info
          </label>
          <div className="space-y-1">
            <LabelType className="text-[10px]">Auto-Check Interval</LabelType>
            <Select value={newAutoCheck.toString()} onValueChange={(v) => setNewAutoCheck(Number(v))}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value.toString()} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/50">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleAdd}>Add Updater</Button>
      </div>
    </div>
  );
}

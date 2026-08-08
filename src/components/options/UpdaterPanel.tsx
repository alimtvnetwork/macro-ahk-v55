import { useState, useEffect, useCallback } from "react";
import { sendMessage } from "@/lib/message-client";
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
import { RefreshCw, Plus, Globe, GitBranch, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  UpdaterEntry,
  UpdaterEndpoint,
  UpdaterStep,
  STATUS_UP_TO_DATE,
  STATUS_UPDATE_AVAILABLE,
  mapBackendEntry,
  AVAILABLE_CATEGORIES,
  INTERVAL_OPTIONS,
} from "./updater/updater-types";
import { UpdaterEntryCard } from "./updater/UpdaterEntryCard";

interface Props {
  projectId: string;
}

export function UpdaterPanel({ projectId: _projectId }: Props) {
  const [updaters, setUpdaters] = useState<UpdaterEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUpdaters = useCallback(async () => {
    try {
      const result = await sendMessage<{ updaters: Array<Record<string, unknown>> }>({
        type: "LIST_UPDATERS",
      });
      const mapped: UpdaterEntry[] = (result.updaters ?? []).map((u) => mapBackendEntry(u));
      setUpdaters(mapped);
    } catch (err) {
      console.warn("[UpdaterPanel] Failed to load updaters:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUpdaters(); }, [loadUpdaters]);

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

  const resetAddForm = () => {
    setNewName("");
    setNewDescription("");
    setNewScriptUrl("");
    setNewVersionUrl("");
    setNewInstructionUrl("");
    setNewChangelogUrl("");
    setNewIsGit(false);
    setNewIsRedirectable(true);
    setNewMaxRedirectDepth(2);
    setNewAutoCheck(1440);
    setNewCacheExpiry(10080);
    setNewCategories([]);
    setNewHasConfirm(false);
    setNewHasChangelogFromVersionInfo(true);
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newScriptUrl.trim()) {
      toast.error("Name and Script URL are required");

      return;
    }
    try {
      await sendMessage({
        type: "CREATE_UPDATER",
        data: {
          name: newName.trim(),
          scriptUrl: newScriptUrl.trim(),
          versionInfoUrl: newVersionUrl.trim() || undefined,
          instructionUrl: newInstructionUrl.trim() || undefined,
          changelogUrl: newChangelogUrl.trim() || undefined,
          isGit: newIsGit,
          isRedirectable: newIsRedirectable,
          maxRedirectDepth: newMaxRedirectDepth,
          hasChangelogFromVersionInfo: newHasChangelogFromVersionInfo,
          hasUserConfirmBeforeUpdate: newHasConfirm,
          autoCheckIntervalMinutes: newAutoCheck,
          cacheExpiryMinutes: newCacheExpiry,
        },
      });
      resetAddForm();
      setIsAdding(false);
      toast.success(`Added updater "${newName.trim()}"`);
      await loadUpdaters();
    } catch (err) {
      toast.error("Failed to create updater");
      console.warn("[UpdaterPanel] Create failed:", err);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await sendMessage({ type: "DELETE_UPDATER", updaterId: id });
      if (expandedId === id) setExpandedId(null);
      toast.success("Updater removed");
      await loadUpdaters();
    } catch (err) {
      toast.error("Failed to delete updater");
      console.warn("[UpdaterPanel] Delete failed:", err);
    }
  };

  const handleToggleEnabled = (id: number) => {
    setUpdaters((prev) =>
      prev.map((u) => (u.id === id ? { ...u, isEnabled: !u.isEnabled } : u)),
    );
  };

  const handleCheck = async (id: number) => {
    setCheckingId(id);
    try {
      const result = await sendMessage<{
        hasUpdate: boolean;
        latestVersion: string | null;
        currentVersion: string | null;
        errorMessage?: string;
      }>({ type: "CHECK_FOR_UPDATE", updaterId: id });

      if (result.errorMessage) {
        toast.error(result.errorMessage);
        setUpdaters((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, status: "error" as const, lastCheckedAt: new Date().toISOString() } : u,
          ),
        );
      } else {
        const status = result.hasUpdate ? STATUS_UPDATE_AVAILABLE : STATUS_UP_TO_DATE;
        setUpdaters((prev) =>
          prev.map((u) =>
            u.id === id
              ? {
                  ...u,
                  status,
                  latestVersion: result.latestVersion ?? u.latestVersion,
                  currentVersion: result.currentVersion ?? u.currentVersion,
                  lastCheckedAt: new Date().toISOString(),
                }
              : u,
          ),
        );
        toast.success(result.hasUpdate ? `Update available: v${result.latestVersion}` : "Up to date");
      }
    } catch (err) {
      toast.error("Update check failed");
      console.warn("[UpdaterPanel] Check failed:", err);
      setUpdaters((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, status: "error" as const } : u,
        ),
      );
    } finally {
      setCheckingId(null);
    }
  };

  const handleUpdateField = (id: number, field: keyof UpdaterEntry, value: UpdaterEntry[typeof field]) => {
    setUpdaters((prev) =>
      prev.map((u) => (u.id === id ? { ...u, [field]: value } : u)),
    );
  };

  const handleAddEndpoint = (updaterId: number) => {
    setUpdaters((prev) =>
      prev.map((u) => {
        if (u.id !== updaterId) return u;
        const ep: UpdaterEndpoint = {
          id: Date.now(),
          url: "",
          sortOrder: u.endpoints.length,
          expectedStatusCode: 200,
          isRedirectable: false,
          maxRedirectDepth: 2,
        };

        return { ...u, endpoints: [...u.endpoints, ep] };
      }),
    );
  };

  const handleRemoveEndpoint = (updaterId: number, endpointId: number) => {
    setUpdaters((prev) =>
      prev.map((u) => {
        if (u.id !== updaterId) return u;

        return { ...u, endpoints: u.endpoints.filter((e) => e.id !== endpointId) };
      }),
    );
  };

  const handleUpdateEndpoint = (updaterId: number, endpointId: number, field: keyof UpdaterEndpoint, value: UpdaterEndpoint[keyof UpdaterEndpoint]) => {
    setUpdaters((prev) =>
      prev.map((u) => {
        if (u.id !== updaterId) return u;

        return {
          ...u,
          endpoints: u.endpoints.map((e) =>
            e.id === endpointId ? { ...e, [field]: value } : e,
          ),
        };
      }),
    );
  };

  const handleAddStep = (updaterId: number) => {
    setUpdaters((prev) =>
      prev.map((u) => {
        if (u.id !== updaterId) return u;
        const step: UpdaterStep = {
          id: Date.now(),
          stepId: `step-${u.steps.length + 1}`,
          sortOrder: u.steps.length,
          type: "Download",
        };

        return { ...u, steps: [...u.steps, step] };
      }),
    );
  };

  const handleRemoveStep = (updaterId: number, stepId: number) => {
    setUpdaters((prev) =>
      prev.map((u) => {
        if (u.id !== updaterId) return u;

        return { ...u, steps: u.steps.filter((s) => s.id !== stepId) };
      }),
    );
  };

  const handleUpdateStep = (updaterId: number, stepId: number, field: keyof UpdaterStep, value: UpdaterStep[keyof UpdaterStep]) => {
    setUpdaters((prev) =>
      prev.map((u) => {
        if (u.id !== updaterId) return u;

        return {
          ...u,
          steps: u.steps.map((s) =>
            s.id === stepId ? { ...s, [field]: value } : s,
          ),
        };
      }),
    );
  };

  const toggleCategory = (cats: string[], cat: string) =>
    cats.includes(cat) ? cats.filter((c) => c !== cat) : [...cats, cat];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            Update Sources
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure remote URLs to check for script and project updates.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Source
        </Button>
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/10 anim-fade-in-up">
          <h4 className="text-xs font-semibold text-foreground">New Update Source</h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <LabelType className="text-xs">Name *</LabelType>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Riseup Macro SDK" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <LabelType className="text-xs">Description</LabelType>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Purpose of this source" className="h-8 text-xs" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">URLs</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <LabelType className="text-xs">Script URL *</LabelType>
                <Input value={newScriptUrl} onChange={(e) => setNewScriptUrl(e.target.value)} placeholder="https://..." className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <LabelType className="text-xs">Version Info URL</LabelType>
                <Input value={newVersionUrl} onChange={(e) => setNewVersionUrl(e.target.value)} placeholder="https://..." className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <LabelType className="text-xs">Instruction URL</LabelType>
                <Input value={newInstructionUrl} onChange={(e) => setNewInstructionUrl(e.target.value)} placeholder="https://..." className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <LabelType className="text-xs">Changelog URL</LabelType>
                <Input value={newChangelogUrl} onChange={(e) => setNewChangelogUrl(e.target.value)} placeholder="https://..." className="h-8 text-xs font-mono" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <LabelType className="text-xs">Auto-Check Interval</LabelType>
                <Select value={String(newAutoCheck)} onValueChange={(v) => setNewAutoCheck(Number(v))}>
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
                <Select value={String(newCacheExpiry)} onValueChange={(v) => setNewCacheExpiry(Number(v))}>
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
                <Input type="number" min={0} max={10} value={newMaxRedirectDepth} onChange={(e) => setNewMaxRedirectDepth(Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={newIsGit} onCheckedChange={setNewIsGit} className="scale-75" />
              <GitBranch className="h-3 w-3 text-muted-foreground" />
              Git source
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={newIsRedirectable} onCheckedChange={setNewIsRedirectable} className="scale-75" />
              <Globe className="h-3 w-3 text-muted-foreground" />
              Allow redirects
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={newHasConfirm} onCheckedChange={setNewHasConfirm} className="scale-75" />
              <Shield className="h-3 w-3 text-muted-foreground" />
              Confirm before update
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={newHasChangelogFromVersionInfo} onCheckedChange={setNewHasChangelogFromVersionInfo} className="scale-75" />
              Changelog from VersionInfo
            </label>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNewCategories((c) => toggleCategory(c, cat))}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-all duration-200 ${
                    newCategories.includes(cat)
                      ? "bg-primary/15 text-primary border-primary/30 font-medium"
                      : "bg-muted/20 text-muted-foreground border-border hover:border-primary/30"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={() => { resetAddForm(); setIsAdding(false); }} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} className="text-xs gap-1.5">
              <Plus className="h-3 w-3" />
              Add Source
            </Button>
          </div>
        </div>
      )}

      {/* Updater list */}
      {updaters.length === 0 && !isAdding ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p>No update sources configured</p>
          <p className="mt-1">Add a source to enable remote updates for this project.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {updaters.map((u) => (
            <UpdaterEntryCard
              key={u.id}
              entry={u}
              isExpanded={expandedId === u.id}
              isChecking={checkingId === u.id}
              onToggleExpand={() => setExpandedId(expandedId === u.id ? null : u.id)}
              onCheck={() => void handleCheck(u.id)}
              onRemove={() => handleRemove(u.id)}
              onToggleEnabled={() => handleToggleEnabled(u.id)}
              onUpdateField={(field, value) => handleUpdateField(u.id, field, value)}
              onAddEndpoint={() => handleAddEndpoint(u.id)}
              onRemoveEndpoint={(epId) => handleRemoveEndpoint(u.id, epId)}
              onUpdateEndpoint={(epId, field, value) => handleUpdateEndpoint(u.id, epId, field, value)}
              onAddStep={() => handleAddStep(u.id)}
              onRemoveStep={(stepId) => handleRemoveStep(u.id, stepId)}
              onUpdateStep={(stepId, field, value) => handleUpdateStep(u.id, stepId, field, value)}
              toggleCategory={toggleCategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

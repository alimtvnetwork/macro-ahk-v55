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
import { AddUpdaterForm, AddUpdaterData } from "./updater/AddUpdaterForm";

interface Props {
  projectId: string;
}

// eslint-disable-next-line max-lines-per-function
function useUpdaterPanelState() {
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

  useEffect(() => {
    void loadUpdaters(); 
  }, [loadUpdaters]);

  const handleAdd = async (data: AddUpdaterData) => {
    try {
      await sendMessage({
        type: "CREATE_UPDATER",
        data: {
          name: data.name,
          scriptUrl: data.scriptUrl,
          versionInfoUrl: data.versionInfoUrl || undefined,
          instructionUrl: data.instructionUrl || undefined,
          changelogUrl: data.changelogUrl || undefined,
          isGit: data.isGit,
          isRedirectable: data.isRedirectable,
          maxRedirectDepth: data.maxRedirectDepth,
          hasChangelogFromVersionInfo: data.hasChangelogFromVersionInfo,
          hasUserConfirmBeforeUpdate: data.hasUserConfirmBeforeUpdate,
          autoCheckIntervalMinutes: data.autoCheckIntervalMinutes,
          cacheExpiryMinutes: data.cacheExpiryMinutes,
        },
      });
      setIsAdding(false);
      toast.success(`Added updater "${data.name}"`);
      await loadUpdaters();
    } catch (err) {
      toast.error("Failed to create updater");
      console.warn("[UpdaterPanel] Create failed:", err);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await sendMessage({ type: "DELETE_UPDATER", updaterId: id });
      if (expandedId === id) {
        setExpandedId(null);
      }

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
        if (u.id !== updaterId) {
          return u;
        }

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
        if (u.id !== updaterId) {
          return u;
        }

        return { ...u, endpoints: u.endpoints.filter((e) => e.id !== endpointId) };
      }),
    );
  };

  const handleUpdateEndpoint = (updaterId: number, endpointId: number, field: keyof UpdaterEndpoint, value: UpdaterEndpoint[keyof UpdaterEndpoint]) => {
    setUpdaters((prev) =>
      prev.map((u) => {
        if (u.id !== updaterId) {
          return u;
        }

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
        if (u.id !== updaterId) {
          return u;
        }

        const step: UpdaterStep = {
          id: Date.now(),
          stepId: `step-${u.steps.length + 1}`,
          sortOrder: u.steps.length,
          type: "Download",
          isRedirectable: false,
        };

        return { ...u, steps: [...u.steps, step] };
      }),
    );
  };

  const handleRemoveStep = (updaterId: number, stepId: number) => {
    setUpdaters((prev) =>
      prev.map((u) => {
        if (u.id !== updaterId) {
          return u;
        }

        return { ...u, steps: u.steps.filter((s) => s.id !== stepId) };
      }),
    );
  };

  const handleUpdateStep = (updaterId: number, stepId: number, field: keyof UpdaterStep, value: UpdaterStep[keyof UpdaterStep]) => {
    setUpdaters((prev) =>
      prev.map((u) => {
        if (u.id !== updaterId) {
          return u;
        }

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

  return {
    updaters,
    isAdding, setIsAdding,
    checkingId,
    expandedId, setExpandedId,
    handleAdd, handleRemove, handleToggleEnabled, handleCheck, handleUpdateField,
    handleAddEndpoint, handleRemoveEndpoint, handleUpdateEndpoint,
    handleAddStep, handleRemoveStep, handleUpdateStep,
    toggleCategory,
  };
}

// eslint-disable-next-line max-lines-per-function
export function UpdaterPanel({ projectId: _projectId }: Props) {
  const {
    updaters,
    isAdding, setIsAdding,
    checkingId,
    expandedId, setExpandedId,
    handleAdd, handleRemove, handleToggleEnabled, handleCheck, handleUpdateField,
    handleAddEndpoint, handleRemoveEndpoint, handleUpdateEndpoint,
    handleAddStep, handleRemoveStep, handleUpdateStep,
    toggleCategory,
  } = useUpdaterPanelState();

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
        <div className="anim-fade-in-up">
          <AddUpdaterForm onAdd={handleAdd} onCancel={() => setIsAdding(false)} />
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

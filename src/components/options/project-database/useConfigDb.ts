/**
 * useConfigDb — State and data operations for ConfigDbTab
 *
 * Extracted from ConfigDbTab.tsx to keep the component under max-lines-per-function.
/**
 * useConfigDb — State and data operations for ConfigDbTab
 *
 * Extracted from ConfigDbTab.tsx to keep the component under max-lines-per-function.
 */

import { useState, useEffect, useCallback } from "react";
import { sendMessage } from "@/lib/message-client";
import { toast } from "sonner";

export interface ConfigRow {
  Id: number;
  Section: string;
  Key: string;
  Value: string;
  ValueType: string;
  UpdatedAt: string;
}

async function updateConfigValue(project: string, section: string, key: string, value: string) {
  return await sendMessage<{ isOk: boolean; errorMessage?: string }>({
    type: "PROJECT_CONFIG_UPDATE", project, section, key, value,
  });
}

async function saveBulkUpdates(projectSlug: string, dirtyEntries: [string, string][]) {
  let saved = 0;
  let failed = 0;
  for (const [ek, editedValue] of dirtyEntries) {
    const [section, key] = ek.split("::");
    try {
      const resp = await updateConfigValue(projectSlug, section, key, editedValue);
      if (resp.isOk) {
        saved++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { saved, failed };
}

// eslint-disable-next-line max-lines-per-function -- hook managing config CRUD state
export function useConfigDb(projectSlug: string) {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const editKey = (section: string, key: string) => `${section}::${key}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await sendMessage<{ isOk: boolean; rows?: ConfigRow[]; errorMessage?: string }>({
        type: "PROJECT_CONFIG_READ", project: projectSlug,
      });
      if (resp.isOk && resp.rows) {
        setRows(resp.rows);
        setEdits({}); 
      } else {
        toast.error(resp.errorMessage || "Failed to read config"); 
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    void load(); 
  }, [load]);

  // eslint-disable-next-line max-lines-per-function
  const handleSave = async (row: ConfigRow) => {
    const ek = editKey(row.Section, row.Key);
    const newValue = edits[ek];
    if (newValue === undefined || newValue === row.Value) {
      return;
    }

    setSaving(ek);
    try {
      const resp = await updateConfigValue(projectSlug, row.Section, row.Key, newValue);
      if (resp.isOk) {
        toast.success(`Updated ${row.Section}.${row.Key}`);
        setEdits((prev) => {
          const next = { ...prev };
          delete next[ek];

          return next; 
        });
        void load();
      } else {
        toast.error(resp.errorMessage || "Update failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const handleBulkSave = async () => {
    const dirtyEntries = Object.entries(edits).filter(([ek, editedValue]) => {
      const row = rows.find((r) => editKey(r.Section, r.Key) === ek);

      return row && editedValue !== row.Value;
    });
    if (dirtyEntries.length === 0) {
      return;
    }

    setBulkSaving(true);
    const { saved, failed } = await saveBulkUpdates(projectSlug, dirtyEntries);

    setBulkSaving(false);
    if (failed > 0) {
      toast.warning(`Saved ${saved}, failed ${failed}`); 
    } else {
      toast.success(`Saved ${saved} config value${saved !== 1 ? "s" : ""}`); 
    }

    setEdits({});
    void load();
  };

  const handleReconstruct = async () => {
    setLoading(true);
    try {
      const resp = await sendMessage<{ isOk: boolean; errorMessage?: string }>({
        type: "PROJECT_CONFIG_RECONSTRUCT", project: projectSlug,
      });
      if (resp.isOk) {
        toast.success("Config reconstructed from source");
        void load(); 
      } else {
        toast.error(resp.errorMessage || "Reconstruct failed"); 
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reconstruct failed");
    } finally {
      setLoading(false);
    }
  };

  // Group by section
  const sections = rows.reduce<Record<string, ConfigRow[]>>((acc, row) => {
    (acc[row.Section] ??= []).push(row);

    return acc;
  }, {});

  const pendingCount = Object.keys(edits).length;

  return {
    rows, loading, edits, setEdits, saving, bulkSaving, sections, pendingCount,
    editKey, load, handleSave, handleBulkSave, handleReconstruct,
  };
}

/**
 * Extracted from ProjectDetailView.tsx (PERF-R1) — Activity Log card.
 *
 * Loads per-project activity log entries via the extension message bridge
 * and supports downloading them as a plain-text file.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ListOrdered, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { logError } from "../options-logger";

interface ActivityLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

// eslint-disable-next-line max-lines-per-function
export function ActivityLogSection({ projectId, projectSlug }: { projectId: string; projectSlug: string }) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const response = await import("@/lib/message-client").then((m) =>
          m.sendMessage({ type: "GET_ACTIVITY_LOG", projectId })
        );
        if (Array.isArray(response)) {
          setLogs(response as ActivityLogEntry[]);
        }
      } catch (caught) {
        logError(
          "ProjectDetailView.ActivityLogTab.loadLogs",
          `GET_ACTIVITY_LOG failed for projectId="${projectId}" — showing empty state`,
          caught,
        );
      } finally {
        setLoading(false);
      }
    };
    void loadLogs();
  }, [projectId]);

  const handleDownload = () => {
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `activity-log-${projectSlug}-${ts}.txt`;

    const content = logs.length > 0
      ? logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join("\n")
      : `Activity Log — ${projectSlug}\nExported: ${now.toISOString()}\n\nNo log entries recorded.`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Activity log downloaded as ${filename}`);
  };

  const levelColor = (level: string) => {
    switch (level) {
      case "error": return "text-destructive";
      case "warn": return "text-yellow-500";
      case "debug": return "text-muted-foreground/60";
      default: return "text-foreground";
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-primary" />
          Activity Log
          {logs.length > 0 && (
            <span className="text-[10px] font-mono bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded">{logs.length}</span>
          )}
        </h3>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={handleDownload}>
          <ArrowDown className="h-3.5 w-3.5" />
          Download
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground italic">Loading activity log…</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No activity log entries yet. Logs will appear after scripts run.</p>
      ) : (
        <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-background p-2 space-y-0.5">
          {logs.map((entry, i) => (
            <div key={i} className="flex gap-2 text-[11px] font-mono leading-relaxed">
              <span className="text-muted-foreground shrink-0 w-[140px]">{entry.timestamp}</span>
              <span className={`shrink-0 w-[50px] font-semibold ${levelColor(entry.level)}`}>{entry.level.toUpperCase()}</span>
              <span className="text-foreground break-all">{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

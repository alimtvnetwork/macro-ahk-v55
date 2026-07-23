import { Badge } from "@/components/ui/badge";
import { FolderOpen } from "lucide-react";
import type { ActiveProjectData } from "@/hooks/use-popup-data";
import { EXTENSION_VERSION, DEFAULT_PROJECT_ID } from "@/shared/constants";

interface Props {
  data: ActiveProjectData;
  onSelect: (projectId: string) => Promise<void>;
}

export function ProjectSelector({ data, onSelect }: Props) {
  const activeId = data.activeProject?.id ?? "";
  const selectableProjects = data.allProjects;
  const hasProjects = selectableProjects.length > 0;
  const selectedValue = selectableProjects.some((project) => project.id === activeId) ? activeId : "";
  // v4.34.0: built-in Macro Controller project pins to EXTENSION_VERSION so a
  // stale StoredProject.version (from a pre-update install where the seeder
  // normalize did not run yet) can never disagree with the popup header.
  const isBuiltIn = data.activeProject?.id === DEFAULT_PROJECT_ID;
  const displayVersion = isBuiltIn
    ? EXTENSION_VERSION
    : (data.activeProject?.version ?? "").trim();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">Active Project</span>
        </div>
        {data.activeProject && displayVersion !== "" && (
          <Badge variant="secondary" className="text-[10px]">
            v{displayVersion}
          </Badge>
        )}
      </div>

      {hasProjects ? (
        <select
          value={selectedValue}
          onChange={(e) => void onSelect(e.target.value)}
          className="flex h-8 w-full items-center rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {!selectedValue && (
            <option value="" disabled>Select a project</option>
          )}
          {selectableProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-muted-foreground">No runnable projects configured</p>
      )}
    </div>
  );
}

import { sendMessage } from "@/lib/message-client";
import type { StoredProject } from "@/hooks/use-projects-scripts";
import { logError } from "./options-logger";

type ProjectStorageGet = ((key: string) => Promise<Record<string, unknown>>)
  & ((key: string, callback: (out: Record<string, unknown>) => void) => void);

interface ProjectStorageLocal {
  get: ProjectStorageGet;
}

interface ProjectStorageChangeArea {
  onChanged?: {
    addListener: (h: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => void;
    removeListener: (h: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => void;
  };
}

const PROJECT_ROSTER_POLL_DELAYS_MS = [0, 50, 100, 200, 300] as const;
const PROJECT_ROSTER_TAIL_ATTEMPTS = 60;
const PROJECT_ROSTER_MESSAGE_TIMEOUT_MS = 250;

export function getProjectStorageLocal(): ProjectStorageLocal | undefined {
  return (typeof chrome !== "undefined" ? chrome.storage?.local : undefined) as ProjectStorageLocal | undefined;
}

export function getProjectStorageChangeArea(): ProjectStorageChangeArea | undefined {
  return (typeof chrome !== "undefined" ? chrome.storage : undefined) as ProjectStorageChangeArea | undefined;
}

async function readProjectStorageKey(storage: ProjectStorageLocal): Promise<Record<string, unknown> | null> {
  try {
    const out = await storage.get("marco_projects");
    if (out && typeof out === "object") return out;
  } catch (err) {
    logError("AutoCatch", "Swallowed error", "Automatically caught swallowed error", err); 
}

  return new Promise((resolve) => {
    try {
      storage.get("marco_projects", (out) => resolve(out ?? null));
    } catch (err) {
      resolve(null);
    }
  });
}

export async function readProjectsDirectFromChromeStorage(): Promise<StoredProject[]> {
  const storage = getProjectStorageLocal();
  if (!storage) {
    return [];
  }

  const out = await readProjectStorageKey(storage);
  const raw = (out as { marco_projects?: unknown } | null)?.marco_projects;

  const isArray = Array.isArray(raw);
  if (isArray) {
    return raw as StoredProject[];
  }

  return [];
}

async function readProjectsViaMessage(): Promise<StoredProject[]> {
  return sendMessage<{ projects: StoredProject[] }>({ type: "GET_ALL_PROJECTS" as never } as never)
    .then((r) => r?.projects ?? [])
    .catch((err) => {
      logError("ProjectGroupPanel.loadProjects", "Failed to fetch project list for picker", err);

      return [] as StoredProject[];
    });
}

async function loadProjectRosterSnapshot(): Promise<StoredProject[]> {
  const direct = await readProjectsDirectFromChromeStorage().catch(() => []);
  const hasDirectProjects = direct.length > 0;
  if (hasDirectProjects) {
    return direct;
  }

  return Promise.race([
    readProjectsViaMessage(),
    new Promise<StoredProject[]>((resolve) => window.setTimeout(() => resolve([]), PROJECT_ROSTER_MESSAGE_TIMEOUT_MS)),
  ]);
}

async function loadRosterAfterDelay(
  delayMs: number,
  isCancelled: () => boolean,
  onLoaded: (projects: StoredProject[]) => void,
): Promise<boolean> {
  const shouldCancel = isCancelled();
  if (shouldCancel) {
    return true;
  }
  const hasDelay = delayMs > 0;
  if (hasDelay) {
    await new Promise((r) => setTimeout(r, delayMs));
  }
  const projects = await loadProjectRosterSnapshot();
  const shouldCancelAfterLoad = isCancelled();
  if (shouldCancelAfterLoad) {
    return true;
  }
  const isEmpty = projects.length === 0;
  if (isEmpty) {
    return false;
  }
  onLoaded(projects);

  return true;
}

export async function pollProjectRoster(
  isCancelled: () => boolean,
  onLoaded: (projects: StoredProject[]) => void,
): Promise<void> {
  for (const delayMs of PROJECT_ROSTER_POLL_DELAYS_MS) {
    const isDone = await loadRosterAfterDelay(delayMs, isCancelled, onLoaded);
    if (isDone) {
      return;
    }
  }

  for (let attempt = 0; attempt < PROJECT_ROSTER_TAIL_ATTEMPTS; attempt++) {
    const isDone = await loadRosterAfterDelay(500, isCancelled, onLoaded);
    if (isDone) {
      return;
    }
  }
}

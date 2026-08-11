import { LanguageType } from "../../../types/enums";
import { ProjectFile, FileNode } from "./types";

export function buildTree(files: ProjectFile[]): FileNode[] {
  const root: FileNode = { name: "", path: "", isDir: true, children: [] };

  for (const file of files) {
    const parts = file.filename.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");

      if (isLastPart) {
        current.children.push({
          name: part,
          path,
          isDir: false,
          children: [],
          file,
        });
        continue;
      }
      
      let dir = current.children.find((c) => c.isDir && c.name === part);
      const isDirMissing = !dir;
      if (isDirMissing) {
        dir = { name: part, path, isDir: true, children: [] };
        current.children.push(dir);
      }

      // @ts-ignore - dir is guaranteed to be defined here
      current = dir;
    }
  }

  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      const hasDifferentType = a.isDir !== b.isDir;
      if (hasDifferentType) {
        return a.isDir ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => {
      if (n.isDir) {
        sortNodes(n.children);
      }
    });
  };

  sortNodes(root.children);

  return root.children;
}

export function getLanguage(filename: string): LanguageType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const isJson = ext === "json";
  if (isJson) {
    return "json";
  }
  
  const isMarkdown = ["md", "markdown", "txt", "prompt"].includes(ext);
  if (isMarkdown) {
    return "markdown";
  }

  return "javascript";
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"]);
const PDF_EXTS = new Set(["pdf"]);
const BINARY_EXTS = new Set([
  ...IMAGE_EXTS, ...PDF_EXTS,
  "zip", "tar", "gz", "7z", "rar",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp3", "mp4", "wav", "ogg", "webm",
  "exe", "dll", "so", "dylib",
]);

export function isBinaryFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  return BINARY_EXTS.has(ext);
}

export function isImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  return IMAGE_EXTS.has(ext);
}

export function isPdfFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  return PDF_EXTS.has(ext);
}

export function buildDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

export function formatSize(bytes: number): string {
  const isSmall = bytes < 1024;
  if (isSmall) {
    return `${bytes} B`;
  }
  
  const isMedium = bytes < 1024 * 1024;
  if (isMedium) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function readFileAsBase64(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const hasDataUrlPrefix = result.includes(",");
      const base64 = hasDataUrlPrefix ? result.split(",")[1] : result;
      resolve(base64);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function guessMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    json: "application/json",
    js: "application/javascript",
    ts: "application/typescript",
    md: "text/markdown",
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    csv: "text/csv",
    xml: "application/xml",
    yaml: "text/yaml",
    yml: "text/yaml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    pdf: "application/pdf",
  };

  return map[ext] ?? "application/octet-stream";
}

import { logError } from "@/components/options/options-logger";
import type { SerializableValue } from "@/platform/platform-adapter";

/**
 * API Explorer Types & Helpers
 * See: spec/05-chrome-extension/64-api-explorer-swagger.md
 */

export type EndpointDoc = {
  Type: string;
  DisplayName?: string;
  Category: string;
  Description: string;
  IsMutating: boolean;
  ExampleRequest?: Record<string, SerializableValue>;
  /** Original type field from backend (kept for wire compatibility) */
  type?: string;
  displayName?: string;
  category?: string;
  description?: string;
  isMutating?: boolean;
  exampleRequest?: Record<string, SerializableValue>;
};

export type ApiEndpointsResponse = {
  endpoints?: EndpointDoc[];
  total?: number;
};

export type ApiStatus = {
  service: string;
  version: string;
  connection: string;
  health: string;
  endpointCount: number;
  persistenceMode: string;
};

/** Normalize backend endpoint doc to PascalCase fields */
export function normalizeEndpoint(raw: Record<string, SerializableValue>): EndpointDoc {
  return {
    Type: (raw.Type ?? raw.type ?? "") as string,
    DisplayName: (raw.DisplayName ?? raw.displayName) as string | undefined,
    Category: (raw.Category ?? raw.category ?? "General") as string,
    Description: (raw.Description ?? raw.description ?? "") as string,
    IsMutating: Boolean(raw.IsMutating ?? raw.isMutating ?? false),
    ExampleRequest: (raw.ExampleRequest ?? raw.exampleRequest) as Record<string, SerializableValue> | undefined,
  };
}

/** Convert a message type like GET_PROMPTS to a pseudo-REST path */
export function toEndpointPath(type: string): string {
  const lower = type.toLowerCase().replace(/_/g, "-");

  return `chrome.runtime/message/${lower}`;
}

/** Convert keys of an object to PascalCase for display */
export function toPascalCaseKeys(source: Record<string, SerializableValue>): Record<string, SerializableValue> {
  const result: Record<string, SerializableValue> = {};
  for (const [key, value] of Object.entries(source)) {
    const pascal = key.replace(/(^|_)(\w)/g, (_, _p, c) => c.toUpperCase());
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[pascal] = toPascalCaseKeys(value as Record<string, SerializableValue>);
    } else {
      result[pascal] = value;
    }
  }

  return result;
}

export function toPrettyJson<T>(value: T): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) { /* swallowed */
    return String(value);
  }
}

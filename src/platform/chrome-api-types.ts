/**
 * Marco — Chrome API Ambient Types
 *
 * Minimal ambient declarations for chrome.* APIs used by the
 * PlatformAdapter and background service worker. In the extension
 * build, @types/chrome provides the full definitions; this file
 * prevents TS errors in preview/IDE for files not covered by an
 * explicit `types: ["chrome"]` tsconfig (e.g. src/background/*,
 * which is excluded from tsconfig.app.json).
 */

/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-explicit-any */

export {};

declare global {
    namespace chrome {
        namespace runtime {
            const id: string | undefined;
            function sendMessage(message: any): Promise<any>;
            function getURL(path: string): string;
            function getManifest(): { version: string; name: string; [key: string]: any };
        }
        namespace storage {
            interface StorageArea {
                get(key?: string | string[] | null): Promise<Record<string, any>>;
                set(items: Record<string, any>): Promise<void>;
                remove(key: string | string[]): Promise<void>;
                clear(): Promise<void>;
            }
            const local: StorageArea;
            const sync: StorageArea;
            const session: StorageArea;
            const managed: StorageArea;
        }
        namespace tabs {
            function create(props: { url: string }): void;
            function query(queryInfo: Record<string, any>): Promise<Array<{ id?: number; url?: string }>>;
        }
        namespace scripting {
            type ExecutionWorld = "ISOLATED" | "MAIN";
            interface InjectionTarget { tabId: number; frameIds?: number[]; allFrames?: boolean }
            interface ScriptInjection {
                target: InjectionTarget;
                files?: string[];
                func?: (...args: any[]) => any;
                args?: any[];
                world?: ExecutionWorld;
                injectImmediately?: boolean;
            }
            interface CSSInjection {
                target: InjectionTarget;
                css?: string;
                files?: string[];
                origin?: "AUTHOR" | "USER";
            }
            interface InjectionResult { frameId: number; result: any }
            function executeScript(injection: ScriptInjection): Promise<InjectionResult[]>;
            function insertCSS(injection: CSSInjection): Promise<void>;
            function removeCSS(injection: CSSInjection): Promise<void>;
        }
        namespace userScripts {
            interface RegisteredUserScript {
                id: string;
                matches?: string[];
                excludeMatches?: string[];
                js?: Array<{ code?: string; file?: string }>;
                world?: "USER_SCRIPT" | "MAIN";
                worldId?: string;
                runAt?: "document_start" | "document_end" | "document_idle";
            }
            interface Injection {
                target: { tabId: number; frameIds?: number[]; allFrames?: boolean };
                js?: Array<{ code?: string; file?: string }>;
                world?: "USER_SCRIPT" | "MAIN";
                worldId?: string;
                injectImmediately?: boolean;
            }
            function register(scripts: RegisteredUserScript[]): Promise<void>;
            function update(scripts: RegisteredUserScript[]): Promise<void>;
            function unregister(filter?: { ids?: string[] }): Promise<void>;
            function getScripts(filter?: { ids?: string[] }): Promise<RegisteredUserScript[]>;
            function configureWorld(props: { worldId?: string; csp?: string; messaging?: boolean }): Promise<void>;
            function execute(injection: Injection): Promise<Array<{ frameId: number; result: any }>>;
        }
    }
}

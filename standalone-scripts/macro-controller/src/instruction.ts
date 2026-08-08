import { DomainConstants } from "./constants/domain";
/**
 * Macro Controller — Project Instruction Manifest
 *
 * Defines the load order and asset dependencies for this project.
 * Compiled at build time to dist/instruction.json.
 *
 * Load order: CSS (head) → JSON configs → JavaScript
 *
 * All keys PascalCase per `mem://standards/pascalcase-json-keys`.
 */

import type { ProjectInstruction } from "../../types/instruction/project-instruction";
import { InjectionWorldType } from "../../types/instruction/enums/injection-world";
import { InjectionRunAtType } from "../../types/instruction/enums/injection-run-at";
import { MatchRuleType } from "../../types/instruction/enums/match-type";
import { AssetInjectTargetType } from "../../types/instruction/enums/asset-inject-target";
import { VERSION } from "../../shared-version";
import { LogLevelType } from "./types/enums";

type MacroControllerSettings = {
    IsolateScripts: boolean;
    LogLevel: LogLevelType;
    RetryOnNavigate: boolean;
};

const instruction: ProjectInstruction<MacroControllerSettings> = {
    SchemaVersion: "1.0",
    Name: "macro-controller",
    DisplayName: "Macro Controller",
    Version: VERSION,
    Description: "Macro Controller for workspace and credit management",
    World: InjectionWorldType.Main,
    Dependencies: ["marco-sdk", "xpath"],
    LoadOrder: 2,
    Seed: {
        Id: "default-macro-looping",
        SeedOnInstall: true,
        IsRemovable: false,
        AutoInject: true,
        RunAt: InjectionRunAtType.DocumentIdle,
        CookieBinding: "lovable-session-id.id",
        TargetUrls: [
            { Pattern: "https://lovable.dev/projects/*", MatchRuleType: MatchRuleType.Glob },
            { Pattern: "https://*.lovable.app/*", MatchRuleType: MatchRuleType.Glob },
            { Pattern: "https://*.lovableproject.com/*", MatchRuleType: MatchRuleType.Glob },
        ],
        Cookies: [
            { CookieName: "lovable-session-id.id", Url: DomainConstants.PRIMARY_URL, Role: "session", Description: "Session ID — primary bearer token" },
            { CookieName: "lovable-session-id.refresh", Url: DomainConstants.PRIMARY_URL, Role: "refresh", Description: "Refresh token" },
        ],
        Settings: {
            IsolateScripts: true,
            LogLevel: "info",
            RetryOnNavigate: true,
        },
        ConfigSeedIds: {
            config: "default-macro-looping-config",
            theme: "default-macro-theme",
        },
    },
    Assets: {
        Css: [
            { File: "macro-looping.css", Inject: AssetInjectTargetType.Head },
        ],
        Configs: [
            { File: "macro-looping-config.json", Key: "config", InjectAs: "__MARCO_CONFIG__" },
            { File: "macro-theme.json", Key: "theme", InjectAs: "__MARCO_THEME__" },
        ],
        Scripts: [
            {
                File: "macro-looping.js",
                Order: 1,
                ConfigBinding: "config",
                ThemeBinding: "theme",
                IsIife: true,
            },
        ],
        Templates: [
            { File: "templates.json", InjectAs: "__MARCO_TEMPLATES__" },
        ],
        Prompts: [],
    },
};

export default instruction;

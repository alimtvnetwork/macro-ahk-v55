/**
 * XPath Utilities — Project Instruction Manifest
 *
 * Global utility library. No configs, no CSS, just the JS bundle.
 * Loaded before all dependent projects.
 *
 * All keys PascalCase per `mem://standards/pascalcase-json-keys`.
 */

import type { ProjectInstruction } from "../../types/instruction/project-instruction";
import { InjectionWorldType } from "../../types/instruction/enums/injection-world";
import { InjectionRunAtType } from "../../types/instruction/enums/injection-run-at";
import { MatchRuleType } from "../../types/instruction/enums/match-type";
import type { EmptySettings } from "../../types/instruction/seed/empty-settings";
import { VERSION } from "../../shared-version";

const instruction: ProjectInstruction<EmptySettings> = {
  SchemaVersion: "1.0",
  Name: "xpath",
  DisplayName: "XPath Utilities",
  Version: VERSION,
  Description: "Global XPath utility library (getByXPath, findElement, reactClick)",
  World: InjectionWorldType.Main,
  IsGlobal: true,
  Dependencies: [],
  LoadOrder: 1,
  Seed: {
    Id: "default-xpath-utils",
    SeedOnInstall: true,
    IsRemovable: false,
    AutoInject: true,
    TargetUrls: [
      { Pattern: "https://lovable.dev/projects/*", MatchType: MatchRuleType.Glob },
      { Pattern: "https://*.lovable.app/*", MatchType: MatchRuleType.Glob },
      { Pattern: "https://*.lovableproject.com/*", MatchType: MatchRuleType.Glob },
    ],
    Cookies: [],
    Settings: {},
  },
  Assets: {
    Css: [],
    Configs: [],
    Scripts: [
      { File: "xpath.js", Order: 1, IsIife: true },
    ],
    Templates: [],
    Prompts: [],
  },
};

export default instruction;

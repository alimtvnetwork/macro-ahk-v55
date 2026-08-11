/**
 * Payment Banner Hider — Project Instruction Manifest
 *
 * Auto-injected global script. Hides the Lovable "Payment issue detected"
 * sticky banner on lovable.dev/* pages with a smooth CSS3 fade.
 *
 * All keys PascalCase per `mem://standards/pascalcase-json-keys`.
 */

import type { ProjectInstruction } from "../../types/instruction/project-instruction";
import { InjectionWorldType } from "../../types/instruction/enums/injection-world";
import { InjectionRunAtType } from "../../types/instruction/enums/injection-run-at";
import { MatchRuleType } from "../../types/instruction/enums/match-type";
import { AssetInjectTargetType } from "../../types/instruction/enums/asset-inject-target";
import type { EmptySettings } from "../../types/instruction/seed/empty-settings";
import { VERSION } from "../../shared-version";

const instruction: ProjectInstruction<EmptySettings> = {
  SchemaVersion: "1.0",
  Name: "payment-banner-hider",
  DisplayName: "Payment Banner Hider",
  Version: VERSION,
  Description: "Auto-hides the Lovable 'Payment issue detected.' sticky banner with a smooth CSS3 fade.",
  World: InjectionWorldType.Main,
  IsGlobal: true,
  Dependencies: [],
  LoadOrder: 2,
  Seed: {
    Id: "default-payment-banner-hider",
    SeedOnInstall: true,
    IsRemovable: true,
    AutoInject: true,
    RunAt: InjectionRunAtType.DocumentIdle,
    TargetUrls: [
      { Pattern: "https://lovable.dev/*", MatchRuleType: MatchRuleType.Glob },
    ],
    Cookies: [],
    Settings: {},
  },
  Assets: {
    Css: [
      { File: "payment-banner-hider.css", Inject: AssetInjectTargetType.Head },
    ],
    Configs: [],
    Scripts: [
      { File: "payment-banner-hider.js", Order: 1, IsIife: true },
    ],
    Templates: [],
    Prompts: [],
  },
};

export default instruction;

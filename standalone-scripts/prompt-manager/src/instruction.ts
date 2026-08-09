import { InjectionWorldType } from "../../types/instruction/enums/injection-world";
import { VERSION } from "../../shared-version";

const instruction = {
    SchemaVersion: "1.0",
    Name: "prompt-manager",
    DisplayName: "Prompt Manager",
    Version: VERSION,
    Description: "Python prompt manager integration",
    World: InjectionWorldType.Main,
    IsGlobal: false,
    Dependencies: [],
    LoadOrder: 1,
    Seed: {
        Id: "default-prompt-manager",
        SeedOnInstall: false,
        IsRemovable: false,
        AutoInject: false,
        TargetUrls: [],
        Cookies: [],
        Settings: {},
    },
    Assets: {
        Css: [],
        Configs: [],
        Scripts: [
            { File: "prompt-manager.js", Order: 1, IsIife: true },
        ],
        Templates: [],
        Prompts: [],
    },
};

export default instruction;

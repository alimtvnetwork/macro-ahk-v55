const instruction = {
    SchemaVersion: "1.0",
    Name: "prompt-manager",
    DisplayName: "Prompt Manager",
    Version: "1.0",
    Description: "Python prompt manager integration",
    World: "MAIN",
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

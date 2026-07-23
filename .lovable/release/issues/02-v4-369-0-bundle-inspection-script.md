# Bundle inspection script shape mismatch

- Previous version and new version: `4.368.0` to `4.369.0`
- Step that failed: 7, Verify generated prompt bundle
- Command run and full error output: `node` snippet reading `chrome-extension/prompts/macro-prompts.json` and calling `data.find(...)`. Error: `TypeError: data.find is not a function` because the bundle shape is `{ "prompts": [...] }`.
- Files involved: `chrome-extension/prompts/macro-prompts.json`
- Resolution or workaround: resolved. Re-ran inspection against `data.prompts` and confirmed the bundle contains the `Release` prompt entry.
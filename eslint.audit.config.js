// Audit-only ESLint config for spec/33-missing-coding-guideline P0 items.
// Layers the 10 proposed P0 rules on top of the base eslint.config.js so we can
// measure exact violation counts without breaking main CI (which still enforces
// the ratcheted baseline via `scripts/audit-p0-rules.mjs`).
//
// Run: `npx eslint --config eslint.audit.config.js standalone-scripts/**/*.ts --format json`
// Or:  `node scripts/audit-p0-rules.mjs` (aggregates + writes public/p0-rules-audit.json)
//
// This file is NOT wired into the default lint script. Promotion of any rule
// from this config to eslint.config.js happens per-P0-item, only after the
// underlying debt is cleaned (see spec/33-missing-coding-guideline/14-*).

import base from "./eslint.config.js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...base,
  {
    files: ["standalone-scripts/**/*.ts"],
    ignores: [
      "standalone-scripts/**/__tests__/**",
      "standalone-scripts/**/tests/**",
      "standalone-scripts/**/dist/**",
    ],
    rules: {
      // P0-01: innerHTML sink ban (baseline 187 in 99-baselines.json)
      // P0-02: `new Function()` ban (baseline 1: ui/js-executor.ts:111)
      // P0-06: raw localStorage literal-key ban (baseline 15; 2 auth-critical)
      // P1-03: banned identifier `msg` (partial; base config already denies via id-denylist)
      "no-restricted-syntax": [
        "error",
        // Keep base namespace-Logger ban (audit config replaces the array; re-declare):
        {
          selector: "CallExpression[callee.property.name='error'][callee.object.name='console'], CallExpression[callee.property.name='error'][callee.object.property.name='console']",
          message: "P0-04: Use Logger.error / logError / logBgError instead of console.error.",
        },
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message: "P0-01: Direct .innerHTML assignment is forbidden. Use escapeHtml + typed template builder or DocumentFragment.",
        },
        {
          selector: "NewExpression[callee.name='Function']",
          message: "P0-02: `new Function()` is forbidden. Use an explicit dispatch table.",
        },
        {
          selector: "CallExpression[callee.object.name='localStorage'][arguments.0.type='Literal']",
          message: "P0-06: Raw localStorage string keys are forbidden. Use StorageKey enum from types/storage-keys.ts.",
        },
        {
          selector: "TSAsExpression > TSAsExpression[typeAnnotation.type='TSUnknownKeyword']",
          message: "P0-10: `as unknown as` double-cast is forbidden outside types/**. Add a runtime guard or extend the target type.",
        },
      ],

      // P0-04 (companion): reject silent catch blocks
      "no-empty": ["error", { allowEmptyCatch: false }],

      // P0-08: promote complexity gates from warn to error at the tighter thresholds
      "sonarjs/cognitive-complexity": ["error", 20],
      "max-lines-per-function": ["error", { max: 120, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Barrel policy (P2-05 companion; 3 sites baseline)
    files: ["standalone-scripts/**/index.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportAllDeclaration",
          message: "P2-05: `export *` barrels are forbidden. List named exports explicitly.",
        },
      ],
    },
  },
);

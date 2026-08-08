const fs = require('fs');

// 1. Fix seed-plan-next.ts
let f = 'standalone-scripts/macro-controller/src/seed/seed-plan-next.ts';
let content = fs.readFileSync(f, 'utf8');
content = content.replace(
    /export async function seedPlanNextPrompts\(\): Promise<ServiceResult<SeedResult>> \{\s*try \{\s*const startedAt = Date\.now\(\);/s,
    "export async function seedPlanNextPrompts(): Promise<ServiceResult<SeedResult>> {\n    const startedAt = Date.now();\n    try {"
);
fs.writeFileSync(f, content);
console.log('Fixed seed-plan-next.ts startedAt scope');

// 2. Fix seed-plan-next.test.ts
f = 'standalone-scripts/macro-controller/src/seed/__tests__/seed-plan-next.test.ts';
content = fs.readFileSync(f, 'utf8');
content = content.replace(/r\.telemetry/g, 'r.data?.telemetry');
fs.writeFileSync(f, content);
console.log('Fixed seed-plan-next.test.ts telemetry access');

// 3. Fix seed-plan-next-edges.test.ts
f = 'standalone-scripts/macro-controller/src/seed/__tests__/seed-plan-next-edges.test.ts';
content = fs.readFileSync(f, 'utf8');
content = content.replace(/r\.telemetry/g, 'r.data?.telemetry');
fs.writeFileSync(f, content);
console.log('Fixed seed-plan-next-edges.test.ts telemetry access');

// 4. Fix plan-task-ui-positive.test.ts
f = 'standalone-scripts/macro-controller/src/ui/__tests__/plan-task-ui-positive.test.ts';
content = fs.readFileSync(f, 'utf8');
if (!content.includes('import { DbResult }')) {
    content = "import { DbResult } from '../../db/db-result';\n" + content;
    fs.writeFileSync(f, content);
    console.log('Fixed plan-task-ui-positive.test.ts missing import');
}

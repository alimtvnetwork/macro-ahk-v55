const fs = require('fs');
let f = 'standalone-scripts/macro-controller/src/seed/seed-plan-next.ts';
let content = fs.readFileSync(f, 'utf8');

const regex = /if \(\!getPromptsConfig\) \{\s*return ServiceResult\.wrap\(new DbResult\(false, undefined, 'startup dependency missing \(getPromptsConfig\)'\)\);\s*\}/;

content = content.replace(regex, "");

fs.writeFileSync(f, content);
console.log('Fixed seed-plan-next.ts getPromptsConfig check');

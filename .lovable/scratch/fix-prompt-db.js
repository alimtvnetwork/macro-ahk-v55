const fs = require('fs');

let content = fs.readFileSync('standalone-scripts/macro-controller/src/db/prompt-db.ts', 'utf8');

// 1. Convert plain returns to DbResult instances
content = content.replace(/\{ ok: true, value: (.*?) \}/g, 'new DbResult(true, $1)');
content = content.replace(/\{ ok: true \}/g, 'new DbResult(true, undefined)');
content = content.replace(/\{ ok: false, error: (.*?) \}/g, 'new DbResult(false, undefined, $1)');

// 2. Remove the DbResult interface entirely
content = content.replace(/export interface DbResult<T> \{\s+ok: boolean;\s+value\?: T;\s+error\?: string;\s+\}/, '');

// 3. Import DbResult and ServiceResult
// Add it after the prompt-defaults import
content = content.replace(
    /from '\.\/prompt-defaults';/,
    "from './prompt-defaults';\nimport { DbResult } from './db-result';\nexport { DbResult };"
);

fs.writeFileSync('standalone-scripts/macro-controller/src/db/prompt-db.ts', content);
console.log('Fixed prompt-db.ts');

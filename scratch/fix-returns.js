const fs = require('fs');
let code = fs.readFileSync('standalone-scripts/macro-controller/src/db/prompt-db.ts', 'utf8');

code = code.replace(/return \{ ok: true, value: (.*?) \};/g, 'return new DbResult(true, $1);');
code = code.replace(/return \{ ok: true \};/g, 'return new DbResult(true, undefined);');
code = code.replace(/return \{ ok: false, error: (.*?) \};/g, 'return new DbResult(false, undefined, $1);');

fs.writeFileSync('standalone-scripts/macro-controller/src/db/prompt-db.ts', code);
console.log('Fixed plain object returns to use new DbResult');

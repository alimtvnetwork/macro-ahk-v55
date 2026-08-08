const fs = require('fs');
const file = 'standalone-scripts/macro-controller/src/db/prompt-db.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/resp\.error\?\.message \?\? '(.*?)'/g, "resp.error?.message || '$1'");
content = content.replace(/new Error\(resp\.errorMessage\)/g, "new Error(resp.errorMessage || 'unknown error')");
fs.writeFileSync(file, content);

const file2 = 'standalone-scripts/macro-controller/src/db/sql-bridge.ts';
let content2 = fs.readFileSync(file2, 'utf8');
content2 = content2.replace(/new Error\(resp\.errorMessage\)/g, "new Error(resp.errorMessage || 'unknown error')");
fs.writeFileSync(file2, content2);

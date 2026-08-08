const fs = require('fs');
const file = 'standalone-scripts/macro-controller/src/db/__tests__/prompt-db-crud-boundary.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/error: '/g, "errorMessage: '");
fs.writeFileSync(file, content);

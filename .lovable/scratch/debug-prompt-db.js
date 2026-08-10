const fs = require('fs');
const file = 'standalone-scripts/macro-controller/src/db/__tests__/prompt-db.test.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/expect\(r\.ok\)\.toBe\(true\);/g, "if (!r.ok) console.error('UPSERT ERROR:', r.error); expect(r.ok).toBe(true);");
fs.writeFileSync(file, content);

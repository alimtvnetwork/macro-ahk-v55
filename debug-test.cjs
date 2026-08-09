const fs = require('fs');
let content = fs.readFileSync('standalone-scripts/macro-controller/src/credit-balance-update/credit-balance-fetcher.ts', 'utf8');
content = content.replace(/const status = response.status;/, 'const status = response.status;\nconsole.log("RESPONSE IN HANDLENONOK:", response);\nconsole.log("RESPONSE KEYS:", Object.keys(response));\n');
fs.writeFileSync('standalone-scripts/macro-controller/src/credit-balance-update/credit-balance-fetcher.ts', content);

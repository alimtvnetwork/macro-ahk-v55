const fs = require('fs');
const file = 'standalone-scripts/macro-controller/src/credit-balance-update/credit-balance-fetcher.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/return ServiceResult\.wrapFetch\(await fetch\(url, \{ \.\.\.init, signal: controller\.signal \}\)\);/g, "return await fetch(url, { ...init, signal: controller.signal });");
fs.writeFileSync(file, content);

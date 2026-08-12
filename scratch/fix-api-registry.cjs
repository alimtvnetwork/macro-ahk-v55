const fs = require('fs');
const file = 'standalone-scripts/marco-sdk/src/api-registry.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/"(GET|POST|PUT|DELETE|PATCH)"\s+as\s+const/g, 'HttpMethodType.$1');
fs.writeFileSync(file, content);

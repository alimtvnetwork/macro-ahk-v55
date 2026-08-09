const fs = require('fs');
let content = fs.readFileSync('standalone-scripts/macro-controller/src/credit-balance.ts', 'utf8');
content = content.replace(/const isMissingOk\s*=\s*!(.*?);\s*if\s*\(isMissingOk\)/g, 'if (!)');
console.log(content.substring(content.indexOf('window.marco!.api!.workspace.resolveByProject') - 50, content.indexOf('window.marco!.api!.workspace.resolveByProject') + 150));

const fs = require('fs');
let f = 'standalone-scripts/macro-controller/src/ui/__tests__/plan-task-ui-positive.test.ts';
let content = fs.readFileSync(f, 'utf8');

// The file might contain multiple spaces or newlines. We can just replace the whole block.
content = content.replace(
    /getDefaultMock\.mockResolvedValueOnce\(\{\s*ok:\s*true,\s*value:\s*\{\s*Body:\s*'Iterate \{\{steps\}\} times \(\{\{steps\}\}!\)',\s*ReplaceKey:\s*'steps'\s*\},?\s*\}\);/g,
    "getDefaultMock.mockResolvedValueOnce(new DbResult(true, { Body: 'Iterate {{steps}} times ({{steps}}!)', ReplaceKey: 'steps' }));"
);

content = content.replace(
    /getDefaultMock\.mockResolvedValue\(\{\s*ok:\s*true,\s*value:\s*\{\s*Body:\s*'N=\{\{n\}\}',\s*ReplaceKey:\s*'n'\s*\},?\s*\}\);/g,
    "getDefaultMock.mockResolvedValue(new DbResult(true, { Body: 'N={{n}}', ReplaceKey: 'n' }));"
);

// P1 also has one! Let's check P1 in the file. P1 might not use a mock, wait...
// Why did P1 fail?!
// Ah! `P1: preset click pastes the DB Body with {{n}} substituted`
// Let's check if P1 uses getDefaultMock!

fs.writeFileSync(f, content);
console.log('Fixed plan-task-ui-positive mock values');

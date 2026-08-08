const fs = require('fs');
let f = 'standalone-scripts/macro-controller/src/ui/__tests__/plan-task-ui-positive.test.ts';
let content = fs.readFileSync(f, 'utf8');

// Use a simpler string replacement for each P block.

content = content.replace(
    /getDefaultMock\.mockResolvedValueOnce\(\{\s*ok:\s*true,\s*value:\s*\{\s*Body:\s*'Plan \{\{n\}\} steps: solve X in \{\{n\}\} passes\.',\s*ReplaceKey:\s*'n'\s*\},?\s*\}\);/g,
    "getDefaultMock.mockResolvedValueOnce(new DbResult(true, { Body: 'Plan {{n}} steps: solve X in {{n}} passes.', ReplaceKey: 'n' }));"
);

content = content.replace(
    /getDefaultMock\.mockResolvedValueOnce\(\{\s*ok:\s*true,\s*value:\s*\{\s*Body:\s*'x \{\{n\}\}',\s*ReplaceKey:\s*'n'\s*\},?\s*\}\);/g,
    "getDefaultMock.mockResolvedValueOnce(new DbResult(true, { Body: 'x {{n}}', ReplaceKey: 'n' }));"
);

content = content.replace(
    /getDefaultMock\.mockResolvedValue\(\{\s*ok:\s*true,\s*value:\s*\{\s*Body:\s*'## N=\{\{n\}\}',\s*ReplaceKey:\s*'n'\s*\},?\s*\}\);/g,
    "getDefaultMock.mockResolvedValue(new DbResult(true, { Body: '## N={{n}}', ReplaceKey: 'n' }));"
);

content = content.replace(
    /getDefaultMock\.mockResolvedValueOnce\(\{\s*ok:\s*true,\s*value:\s*\{\s*Body:\s*'Iterate \{\{steps\}\} times \(\{\{steps\}\}!\)',\s*ReplaceKey:\s*'steps'\s*\},?\s*\}\);/g,
    "getDefaultMock.mockResolvedValueOnce(new DbResult(true, { Body: 'Iterate {{steps}} times ({{steps}}!)', ReplaceKey: 'steps' }));"
);

content = content.replace(
    /getDefaultMock\.mockResolvedValue\(\{\s*ok:\s*true,\s*value:\s*\{\s*Body:\s*'N=\{\{n\}\}',\s*ReplaceKey:\s*'n'\s*\},?\s*\}\);/g,
    "getDefaultMock.mockResolvedValue(new DbResult(true, { Body: 'N={{n}}', ReplaceKey: 'n' }));"
);

fs.writeFileSync(f, content);
console.log('Fixed ALL plan-task-ui-positive mock values');

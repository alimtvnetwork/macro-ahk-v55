const fs = require('fs');
let f = 'standalone-scripts/macro-controller/src/ui/__tests__/plan-task-ui-positive.test.ts';
let content = fs.readFileSync(f, 'utf8');

content = content.replace(
    /getDefaultMock\.mockResolvedValueOnce\(\{\s*ok:\s*true,\s*value:\s*(\{[^}]+\}),\s*\}\);/,
    "getDefaultMock.mockResolvedValueOnce(new DbResult(true, $1));"
);

content = content.replace(
    /getDefaultMock\.mockResolvedValue\(\{\s*ok:\s*true,\s*value:\s*(\{[^}]+\}),\s*\}\);/,
    "getDefaultMock.mockResolvedValue(new DbResult(true, $1));"
);

fs.writeFileSync(f, content);
console.log('Fixed plan-task-ui-positive mock values');

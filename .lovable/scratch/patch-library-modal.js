const fs = require('fs');
let f = 'standalone-scripts/macro-controller/src/ui/__tests__/prompt-library-modal.test.ts';
let content = fs.readFileSync(f, 'utf8');

content = content.replace(/const mocks = vi\.hoisted\(\(\) => \(\{\n/, "const mocks = vi.hoisted(() => ({\n    DbResult,\n");

fs.writeFileSync(f, content);
console.log('Patched mock correctly in prompt-library-modal.test.ts');

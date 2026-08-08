const fs = require('fs');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.test.ts') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}
const files = walk('standalone-scripts/macro-controller/src');
let count = 0;
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes('new DbResult') && !content.includes("import { DbResult }") && !content.includes("import {DbResult}") && !content.includes("import { DbResult,") && !content.includes(", DbResult }")) {
        // Find the relative path to standalone-scripts/macro-controller/src/db/prompt-db
        // Let's just use a naive approach: count directory depth
        const depth = f.split('/').length - 'standalone-scripts/macro-controller/src'.split('/').length - 1;
        let prefix = depth === 0 ? './' : '../'.repeat(depth);
        let importStatement = `import { DbResult } from '${prefix}db/prompt-db';\n`;
        content = importStatement + content;
        fs.writeFileSync(f, content);
        count++;
        console.log('Added import to ' + f);
    }
});
console.log('Fixed imports in ' + count + ' files');

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
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    
    // Replace import { DbResult } from '.../db/prompt-db' with .../db/db-result
    // We can just regex replace `import { DbResult } from '(.*?)/prompt-db'`
    let original = content;
    
    // First, if it has `import { DbResult } from '.../prompt-db'`, we can just split it.
    // Sometimes it's `import { DbResult, listPromptsByRole } from '.../prompt-db'`
    // That is harder to regex. 
    // Actually, I can just do a regex for `DbResult` in the import list.
});

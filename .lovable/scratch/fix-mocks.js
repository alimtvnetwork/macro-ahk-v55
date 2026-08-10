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
    if (content.includes('{ ok: true') || content.includes('{ ok: false')) {
        let original = content;
        content = content.replace(/\{ ok: true, value: (.*?) \}/g, 'new DbResult(true, $1)');
        content = content.replace(/\{ ok: true \}/g, 'new DbResult(true, undefined)');
        content = content.replace(/\{ ok: false, error: (.*?) \}/g, 'new DbResult(false, undefined, $1)');
        if (original !== content) {
            if (!content.includes('DbResult')) {
                // we might need to import DbResult
                // Let's just do a naive prepend or append it after the last import.
                content = "import { DbResult } from '../../db/prompt-db';\n" + content;
            }
            fs.writeFileSync(f, content);
            console.log('Fixed ' + f);
        }
    }
});

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
    if (content.includes('DbResult')) {
        // Does it import DbResult from somewhere other than db-result?
        // Match import { ... DbResult ... } from '...';
        const regex = /import\s*\{([^}]*DbResult[^}]*)\}\s*from\s*'([^']+)';/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            if (!match[2].endsWith('/db-result') && !match[2].endsWith('/prompt-revision-db')) {
                console.log(`File ${f} imports DbResult from ${match[2]}`);
            }
        }
    }
});

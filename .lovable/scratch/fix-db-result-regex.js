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
    
    // Replace "import { DbResult } from '../../db/prompt-db';"
    // and "import { DbResult } from '../db/prompt-db';"
    // or anything matching DbResult from prompt-db
    if (content.includes('DbResult') && content.includes('/prompt-db')) {
        let original = content;
        
        // This is a naive but effective replacement for single-import lines:
        content = content.replace(/import\s*\{\s*DbResult\s*\}\s*from\s*'([^']+)\/prompt-db';/g, "import { DbResult } from '$1/db-result';");
        
        // What if DbResult is part of a list? 
        // e.g. import { DbResult, other } from '../../db/prompt-db';
        // Let's just remove DbResult from the list, and add a new import below it.
        const multiImportRegex = /import\s*\{([^}]*DbResult[^}]*)\}\s*from\s*'([^']+)\/prompt-db';/g;
        content = content.replace(multiImportRegex, (match, p1, p2) => {
            // If it was just { DbResult }, it would have been caught by the first regex (unless spaced weirdly).
            // Let's remove DbResult from p1
            let newP1 = p1.replace(/DbResult,?\s*/g, '').replace(/,\s*$/, '').trim();
            if (newP1.length === 0) {
                return `import { DbResult } from '${p2}/db-result';`;
            } else {
                return `import { ${newP1} } from '${p2}/prompt-db';\nimport { DbResult } from '${p2}/db-result';`;
            }
        });
        
        if (content !== original) {
            fs.writeFileSync(f, content);
            count++;
            console.log('Fixed imports in ' + f);
        }
    }
});
console.log('Fixed imports in ' + count + ' files');

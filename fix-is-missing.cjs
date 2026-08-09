const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory() && !file.includes('node_modules')) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
            results.push(file);
        }
    });
    return results;
}

const files = [
    ...walk('src'),
    ...walk('standalone-scripts')
];

let changed = 0;
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;

    // Replace const isMissingIsOk = !foo.isOk; if (isMissingIsOk) -> if (!foo.isOk)
    content = content.replace(/const isMissingIsOk\s*=\s*!(.*?);\s*if\s*\(isMissingIsOk\)/g, 'if (!)');
    // Just in case it's on the same line
    content = content.replace(/const isMissingIsOk\s*=\s*!(.*?);\s*if\s*\(isMissingIsOk\)\s*\{/g, 'if (!) {');

    // Also do isMissingOk
    content = content.replace(/const isMissingOk\s*=\s*!(.*?);\s*if\s*\(isMissingOk\)/g, 'if (!)');

    // Catch any loose declarations
    content = content.replace(/const isMissingIsOk\s*=\s*!(.*?);/g, 'const isMissingIsOk = !;'); // wait, if it's used elsewhere?
    
    // Actually, let's just do a blanket regex: 
    // const isMissingIsOk = !<expr>;
    // if (isMissingIsOk)
    
    if (content !== original) {
        fs.writeFileSync(f, content);
        changed++;
    }
});
console.log('Fixed ' + changed + ' files.');

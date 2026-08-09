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

    // The injected logger from the previous agent
    content = content.replace(/logError\(\s*ERROR_CONTEXT_AUTOCATCH,\s*ERROR_MSG_UNHANDLED,\s*([a-zA-Z0-9_]+)\s*\);/g, 'console.error();');
    content = content.replace(/RiseupAsiaMacroExt\.Logger\.error\(/g, 'console.error(');

    if (content !== original) {
        fs.writeFileSync(f, content);
        changed++;
    }
});
console.log('Fixed ' + changed + ' logger files.');

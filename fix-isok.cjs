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

    content = content.replace(/\.isOk/g, '.ok');

    if (content !== original) {
        fs.writeFileSync(f, content);
        changed++;
    }
});
console.log('Fixed ' + changed + ' isOk files.');

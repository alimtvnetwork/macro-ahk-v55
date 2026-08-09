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
        } else if (file.endsWith('.test.ts')) {
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

    // Fix assertions: expect(foo.isSuccess) -> expect(foo.ok)
    content = content.replace(/\.isSuccess/g, '.ok');
    
    // Fix mocks: { isSuccess: true } -> { ok: true, isFail: false }
    content = content.replace(/\{\s*ok:\s*true\s*\}/g, '{ ok: true, isFail: false }');
    content = content.replace(/\{\s*ok:\s*false\s*(,?)/g, '{ ok: false, isFail: true');

    if (content !== original) {
        fs.writeFileSync(f, content);
        changed++;
    }
});
console.log('Fixed ' + changed + ' test files.');

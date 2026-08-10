const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.test.ts') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('standalone-scripts/macro-controller/src');
let changedCount = 0;

for (const f of files) {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;

    // Replace .isSuccess with .ok
    content = content.replace(/\.isSuccess/g, '.ok');

    // Replace .isFail assertions
    // expect(r.isFail).toBe(true) -> expect(r.ok).toBe(false)
    content = content.replace(/expect\(([^)]+)\.isFail\)\.toBe\(true\)/g, "expect($1.ok).toBe(false)");
    
    // expect(r.isFail).toBe(false) -> expect(r.ok).toBe(true)
    content = content.replace(/expect\(([^)]+)\.isFail\)\.toBe\(false\)/g, "expect($1.ok).toBe(true)");

    // if (r.isFail) -> if (!r.ok)
    // Wait, replacing `.isFail` everywhere else is risky if we just do `!r.ok`.
    // Let's replace r.isFail with !r.ok manually by capturing the variable.
    // e.g. `foo.isFail` -> `!foo.ok`
    content = content.replace(/(\w+)\.isFail/g, "!$1.ok");

    if (content !== original) {
        fs.writeFileSync(f, content);
        changedCount++;
    }
}

console.log('Fixed .isSuccess and .isFail in ' + changedCount + ' files.');

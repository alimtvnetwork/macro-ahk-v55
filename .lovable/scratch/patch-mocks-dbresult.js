const fs = require('fs');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.test.ts')) {
            results.push(file);
        }
    });
    return results;
}
const files = walk('standalone-scripts/macro-controller/src');
let count = 0;
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    
    // Look for vi.mock('...prompt-db', () => ({
    // or vi.mock('...prompt-db', () => { return {
    const regex1 = /vi\.mock\('([^']+prompt-db)',\s*\(\)\s*=>\s*\(\{\n/g;
    const regex2 = /vi\.mock\('([^']+prompt-db)',\s*\(\)\s*=>\s*\{\s*return\s*\{\n/g;
    const regex3 = /vi\.mock\('([^']+prompt-db)',\s*\(\)\s*=>\s*\(\{\s*(?!\s*DbResult)/g; // inline version
    
    let original = content;
    
    // Simplest approach: just search for vi.mock('...prompt-db', and if it returns an object, add DbResult: require('.../db-result').DbResult
    // But since DbResult is already imported in these files, we can just add `DbResult,` to the object.
    
    if (content.match(/vi\.mock\('[^']+prompt-db'/)) {
        // Just inject DbResult if it has vi.mock
        content = content.replace(/(vi\.mock\('[^']+prompt-db',\s*\(\)\s*=>\s*(?:\(\{|\{\s*return\s*\{))/g, "$1\n    DbResult,");
        
        // Let's also check if DbResult is imported. If not, we don't inject it because it would cause ReferenceError.
        // Or we can just import it dynamically: DbResult: class DbResult { get ok() { return this.isSuccess; } } 
        // No, we can just inject `DbResult: (await importActual('...')).DbResult` -> not possible in sync factory.
        
        // Wait, if I just add `DbResult,` it assumes DbResult is imported. We ALREADY imported DbResult in all these files!
        
        if (content !== original) {
            fs.writeFileSync(f, content);
            count++;
            console.log('Patched mock in ' + f);
        }
    }
});
console.log('Patched ' + count + ' files');

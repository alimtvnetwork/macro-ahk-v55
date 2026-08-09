const fs = require('fs');
const path = require('path');
const rootDir = path.join(__dirname, '../../');

let dbFiles = [];

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === '.lovable' || file === 'dist' || file === 'build') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.mjs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('query(') || content.includes('sql') || content.includes('sqlite') || content.includes('DbResult') || content.includes('SqlBridge')) {
                dbFiles.push(fullPath);
            }
        }
    }
}
walk(rootDir);
console.log('DB files:', dbFiles.length, dbFiles.slice(0, 10));

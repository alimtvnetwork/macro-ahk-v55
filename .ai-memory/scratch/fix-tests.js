const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const diffOut = execSync('git diff --name-only', { encoding: 'utf8' });
const files = diffOut.split('\n').filter(f => f.startsWith('src/background/recorder') || f.startsWith('src/components/options'));

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  if (file.includes('payload-builders.ts')) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/isFail/g, 'Ok');
    fs.writeFileSync(file, code);
    continue;
  }
  
  let code = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Revert `.isFail` to `.Ok === false`
  if (code.includes('.isFail')) {
    code = code.replace(/\.isFail/g, '.Ok === false');
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, code);
    console.log('Fixed', file);
  }
}

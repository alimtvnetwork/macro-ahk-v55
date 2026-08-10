const fs = require('fs');
const lines = fs.readFileSync('out.txt', 'utf8').split('\n');
const toFix = {};
for (const line of lines) {
  const m = line.match(/^([^:]+)\((\d+),\d+\): error TS2554: Expected 2-3 arguments, but got 4./);
  if (m) {
    const file = m[1];
    const lineNum = parseInt(m[2], 10) - 1;
    if (!toFix[file]) toFix[file] = [];
    toFix[file].push(lineNum);
  }
}
for (const file in toFix) {
  const content = fs.readFileSync(file, 'utf8').split('\n');
  for (const lineNum of toFix[file]) {
    content[lineNum] = content[lineNum].replace(/logError\((.*?),\s*(.*?),\s*(.*?),\s*(.*?)\)/, 'logError($1, $3, $4)');
  }
  fs.writeFileSync(file, content.join('\n'));
  console.log('Fixed logError in ' + file);
}

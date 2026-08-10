const fs = require('fs');

const log = fs.readFileSync('tsc-errors.txt', 'utf8');
const lines = log.split('\n');

const fixes = {};

for (const line of lines) {
  const match2724 = line.match(/^(.*?)\(\d+,\d+\): error TS2724: .*? has no exported member named '(.*?)'\. Did you mean '(.*?)'\?/);
  if (match2724) {
    const file = match2724[1];
    const oldName = match2724[2];
    const newName = match2724[3];
    if (!fixes[file]) fixes[file] = {};
    fixes[file][oldName] = newName;
  }
  
  const match2305 = line.match(/^(.*?)\(\d+,\d+\): error TS2305: Module .*? has no exported member '(.*?)'\./);
  if (match2305) {
    const file = match2305[1];
    const oldName = match2305[2];
    
    let newName = oldName + 'Type';
    
    if (oldName.includes('SemanticSemantic')) {
      const parts = oldName.match(/SemanticSemantic([a-zA-Z0-9]+?)(?:Enum\d*)?$/);
      if (parts && parts[1]) {
        // e.g. SemanticSemanticSideEnum -> SideType
        // wait, parts[1] might be Side
        newName = parts[1] + 'Type';
      }
    } else if (oldName.endsWith('Enum')) {
      newName = oldName.replace('Enum', 'Type');
    }
    
    if (!fixes[file]) fixes[file] = {};
    fixes[file][oldName] = newName;
  }
}

for (const file of Object.keys(fixes)) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  for (const [oldName, newName] of Object.entries(fixes[file])) {
    const regex = new RegExp(`\\b${oldName}\\b`, 'g');
    content = content.replace(regex, newName);
  }
  fs.writeFileSync(file, content);
  console.log(`Fixed ${file} by replacing ${Object.entries(fixes[file]).map(([k,v]) => k + '->' + v).join(', ')}`);
}
